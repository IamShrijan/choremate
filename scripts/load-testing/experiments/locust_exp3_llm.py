"""
Experiment 3 — Async LLM Queue Scaling (polling-based measurement).

SSE was not reliable through the ALB+nginx+ElastiCache stack in this
deployment.  This script uses Celery's Redis result backend instead:

  1. POST /ai-chatbot/chat  → returns task_id instantly (~80ms)
              ↓
  2. Poll GET /ai-chatbot/task/{task_id} every 1s until ready=true
              ↓
  3. Record end-to-end "LLM Processing Delay" = time until task done

This is scientifically equivalent to SSE — it measures from job submission
to job completion.  The poll add ~0.5s measurement error (avg) which is
negligible vs the 3-60s actual completion times we expect.

Paper metrics:
  - "API Trigger" p50 should be ~80ms regardless of worker count  ← async decoupling proof
  - "LLM Processing Delay" p50/p99 should drop as workers scale    ← scaling proof
"""
import locust_plugins  # enables /stats/prometheus endpoint for Grafana
import time
from locust import HttpUser, task, constant, events


class Exp3LlmQueueUser(HttpUser):
    # Zero wait → continuous load → reveals queue backlog effect
    wait_time = constant(0)

    def on_start(self):
        with self.client.post(
            "/auth/login",
            json={"email": "roommate1@choremate.local", "password": "pass123"},
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                self.token = resp.json().get("access_token")
                self.client.headers.update({"Authorization": f"Bearer {self.token}"})
                resp.success()
            else:
                resp.failure(f"Login failed: {resp.text}")

    @task(4)
    def async_llm_queue_test(self):
        """
        Dispatch a mock LLM job to Celery via SQS, then poll for completion.
        Measures true end-to-end processing time without SSE.
        """
        # ── Step 1: Dispatch job (should return in ~80ms asynchronously) ──────
        trigger_time = time.time()
        with self.client.post(
            "/ai-chatbot/chat",
            json={"message": "Who is the fairest roommate of them all?"},
            name="POST /ai-chatbot/chat (API Trigger)",
            catch_response=True,
        ) as resp:
            if resp.status_code not in (200, 202):
                resp.failure(f"Chat trigger failed: {resp.status_code} {resp.text[:200]}")
                return
            body = resp.json()
            if body.get("status") == "error":
                resp.failure(f"Chat error: {body.get('error','unknown')[:200]}")
                return
            task_id = body.get("task_id")
            if not task_id:
                resp.failure("No task_id in response")
                return
            resp.success()

        # ── Step 2: Poll result backend until task completes ──────────────────
        poll_interval = 1.0   # seconds between polls
        max_wait = 120        # 2 minutes max — enough for deep queues
        deadline = time.time() + max_wait

        while time.time() < deadline:
            time.sleep(poll_interval)
            with self.client.get(
                f"/ai-chatbot/task/{task_id}",
                name="GET /ai-chatbot/task/{id} (Poll)",
                catch_response=True,
            ) as poll_resp:
                if poll_resp.status_code != 200:
                    poll_resp.failure(f"Poll failed: {poll_resp.status_code}")
                    continue
                poll_resp.success()
                data = poll_resp.json()
                if data.get("ready"):
                    # Task complete — record total end-to-end latency
                    latency_ms = int((time.time() - trigger_time) * 1000)
                    events.request.fire(
                        request_type="Worker Compute",
                        name="LLM Processing Delay",
                        response_time=latency_ms,
                        response_length=0,
                        context={},
                        exception=None if data.get("status") == "SUCCESS"
                                  else Exception(f"Task {data.get('status')}"),
                    )
                    return

        # Timed out waiting for task
        events.request.fire(
            request_type="Worker Compute",
            name="LLM Processing Delay",
            response_time=max_wait * 1000,
            response_length=0,
            context={},
            exception=Exception(f"Task {task_id} not ready after {max_wait}s"),
        )

    @task(1)
    def tracking_queue_depth(self):
        """Periodically sample SQS queue depth for the paper chart."""
        with self.client.get("/admin/queue-depth", name="GET /admin/queue-depth"):
            pass
