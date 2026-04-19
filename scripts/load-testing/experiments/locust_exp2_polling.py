"""
Experiment 2 (Polling arm) — Naive REST Polling Notification Delivery.

Each user polls GET /notifications/ every 1 second. When a new SYSTEM_BURST
notification appears, the embedded timestamp in `message` lets us calculate
the exact delivery latency:

    latency = poll_time - float(notification.message)

Burst notifications are triggered MANUALLY in a separate terminal:
    curl -X POST $ALB/admin/trigger-burst?count=50
    curl -X POST $ALB/admin/trigger-burst?count=200
    curl -X POST $ALB/admin/trigger-burst?count=1000

Paper metrics captured:
  - "Notification Delivery Latency" (ms): time from burst to client poll detection
  - Server load visible via "GET /notifications/ (POLLING)" req/s
"""
import locust_plugins
import time
from locust import HttpUser, task, constant, events


class Exp2PollingUser(HttpUser):
    wait_time = constant(1)   # poll every 1 second (aggressive naive polling)

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
        # Track notification IDs we've already reported latency for
        self.seen_ids = set()

    @task
    def poll_notifications(self):
        """
        Poll the notifications list and compute delivery latency for any
        new SYSTEM_BURST notifications we haven't seen yet.
        """
        now = time.time()

        with self.client.get(
            "/notifications/",
            name="GET /notifications/ (POLLING)",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Poll failed: {resp.status_code}")
                return
            resp.success()

            for notif in resp.json():
                nid = notif.get("id")
                if nid in self.seen_ids:
                    continue   # already measured

                if notif.get("notification_type") == "SYSTEM_BURST":
                    self.seen_ids.add(nid)
                    try:
                        burst_time = float(notif["message"])   # timestamp embedded by trigger-burst
                        latency_ms = max(0, int((now - burst_time) * 1000))
                        events.request.fire(
                            request_type="Polling",
                            name="Notification Delivery Latency",
                            response_time=latency_ms,
                            response_length=0,
                            context={},
                            exception=None,
                        )
                    except (ValueError, TypeError):
                        pass   # malformed message — skip
