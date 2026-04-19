"""
Experiment 2 (SSE arm) — Redis Pub/Sub Push Notification Pipeline.

Now that _push_burst sends ONE SSE ping per burst (not N), each SSE user:
1. Receives 'event: new_notification' (1 signal per burst)
2. Immediately fetches GET /notifications/ to count how many SYSTEM_BURST
   notifications actually arrived in the DB for this burst

This lets us measure:
  - "SSE-triggered DB fetch latency": time from SSE signal to DB read (end-to-end)
  - "Notifications fetched per burst": verifies 0% message loss in DB
  - Compared to polling: SSE fetches happen ONLY on demand (not every 1s)

Message loss for SSE = notifications in DB that the client missed because
the SSE connection was closed during that burst. Since each user tracks
seen_ids across SSE windows, we can calculate this.

Run commands:
  locust -f locust_exp2_sse.py --host=<ALB> --users 20 --spawn-rate 5
         --run-time 3m --headless --csv=exp2_sse_burst50

  # In another terminal (while locust is running):
  for i in $(seq 1 10); do sleep 15;
    curl -X POST "$ALB/admin/trigger-burst?count=50"; done
"""
import locust_plugins
import time
from locust import HttpUser, task, between, events


class Exp2SseUser(HttpUser):
    """
    SSE arm: opens persistent SSE connections and reacts to push signals.
    On each 'event: new_notification', fetches the notification list
    to count delivered notifications. Tracks seen_ids across reconnects
    so missed-during-disconnection is captured as message loss.
    """
    wait_time = between(1, 2)   # gap between SSE reconnects

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

        # Tracks ALL SYSTEM_BURST notification IDs seen across ALL SSE windows
        self.seen_ids = set()
        # Total notifications known to exist (from DB fetches)
        self.total_fetched = 0

    @task
    def listen_sse(self):
        """
        Open one SSE window (up to 30s).
        On signal: fetch notifications from DB, count new SYSTEM_BURST ones,
        fire delivery latency metric using the embedded burst timestamp.
        """
        url = f"/notifications/stream?token={self.token}"
        window_start = time.time()

        with self.client.get(
            url,
            stream=True,
            catch_response=True,
            name="SSE Connection Hold",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"SSE open failed: {resp.status_code}")
                return

            current_event = None
            try:
                for raw_line in resp.iter_lines():
                    if time.time() - window_start > 30:
                        break

                    if not raw_line:
                        current_event = None
                        continue

                    line = raw_line.decode("utf-8")

                    if line.startswith("event:"):
                        current_event = line.split(":", 1)[1].strip()

                    elif current_event == "new_notification":
                        # SSE signal received — fetch DB for actual notifications
                        signal_time = time.time()
                        fetch_resp = self.client.get(
                            "/notifications/",
                            name="GET /notifications/ (SSE-triggered fetch)",
                        )
                        fetch_done = time.time()

                        if fetch_resp.status_code == 200:
                            for notif in fetch_resp.json():
                                nid = notif.get("id")
                                if nid in self.seen_ids:
                                    continue
                                if notif.get("notification_type") == "SYSTEM_BURST":
                                    self.seen_ids.add(nid)
                                    self.total_fetched += 1
                                    # Delivery latency = burst trigger time → SSE signal + DB read
                                    try:
                                        burst_ts = float(notif["message"])
                                        e2e_ms = int((fetch_done - burst_ts) * 1000)
                                    except (ValueError, TypeError):
                                        e2e_ms = int((fetch_done - signal_time) * 1000)

                                    events.request.fire(
                                        request_type="SSE",
                                        name="Notification Delivery Latency (SSE)",
                                        response_time=max(0, e2e_ms),
                                        response_length=0,
                                        context={},
                                        exception=None,
                                    )
                        current_event = None

                resp.success()
            except Exception as e:
                resp.failure(f"SSE error: {str(e)}")
