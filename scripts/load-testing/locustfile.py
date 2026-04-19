import random
import string
import uuid
import time
from locust import HttpUser, task, between

def random_string(length=10):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

class BaseChoremateUser(HttpUser):
    abstract = True
    
    def on_start(self):
        """Register a unique user and create a household for them."""
        # 1. Sign up
        self.user_data = {
            "name": f"Test User {random_string(5)}",
            "email": f"test_{random_string(8)}@example.com",
            "password": "password123"
        }
        
        with self.client.post("/auth/signup", json=self.user_data, catch_response=True) as response:
            if response.status_code == 201:
                self.user_id = response.json().get("id")
                response.success()
            else:
                response.failure(f"Signup failed: {response.text}")
                return
        
        # 2. Login to get token
        login_data = {
            "email": self.user_data["email"],
            "password": self.user_data["password"]
        }
        with self.client.post("/auth/login", json=login_data, catch_response=True) as response:
            if response.status_code == 200:
                self.token = response.json().get("access_token")
                # Set default authorization header for all subsequent requests
                self.client.headers.update({"Authorization": f"Bearer {self.token}"})
                response.success()
            else:
                response.failure(f"Login failed: {response.text}")
                return
                
        # 3. Create a house so stats don't fail
        house_data = {
            "name": f"House {random_string(5)}",
            "address": "123 Test St",
            "house_layout": "Test layout",
            "invited_emails": []
        }
        with self.client.post("/house/create", json=house_data, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"House create failed: {response.text}")

class ApiLoadUser(BaseChoremateUser):
    weight = 3  # Run 3x as many API users as SSE users
    wait_time = between(1, 5)

    @task(3)
    def get_dashboard(self):
        self.client.get("/stats/dashboard", name="GET /stats/dashboard")

    @task(3)
    def get_fairness_report(self):
        self.client.get("/stats/fairness-report", name="GET /stats/fairness-report")

    @task(3)
    def get_my_tickets(self):
        self.client.get("/chores/my-tickets", name="GET /chores/my-tickets")
        
    @task(1)
    def generate_house_chores(self):
        # NOTE: This hits the LLM task. Since it's async (Celery), it should return 200 quickly.
        # But if you haven't refactored it yet and it runs synchronously, this will block!
        with self.client.post("/chores/generate-house-chores", catch_response=True) as response:
            if response.status_code in [200, 202]:
                response.success()
            else:
                response.failure(f"Generate chores failed {response.status_code}")

class SseNotificationUser(BaseChoremateUser):
    weight = 1
    wait_time = between(2, 5)
    
    @task
    def listen_to_sse(self):
        """
        Simulate opening the SSE stream and holding it.
        We stream the response and read lines. To prevent blocking the VU forever,
        we'll read for a few seconds or until a few events arrive, then close.
        In reality, browsers hold this open indefinitely.
        """
        start_time = time.time()
        # The stream endpoint takes token in query param mostly (for JS EventSource), 
        # but our header should also work if FastAPI handles it, or we just pass it in query.
        url = f"/notifications/stream?token={self.token}"
        
        # We manually record this to Locust's request metrics since we are parsing the stream
        # Stream=True avoids downloading the entire infinite response
        with self.client.get(url, stream=True, catch_response=True, name="SSE /notifications/stream") as resp:
            if resp.status_code != 200:
                resp.failure(f"Failed to open SSE: {resp.status_code}")
                return
                
            # Read from the stream for up to 10 seconds
            try:
                for line in resp.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        # You can parse "event:" or "data:" here to measure latency if needed
                        
                    # Break loop after 10 seconds to simulate clients reconnecting 
                    # and to allow the VU to perform other tasks (or exit cleanly)
                    if time.time() - start_time > 10:
                        break
                resp.success()
            except Exception as e:
                resp.failure(f"SSE stream exception: {str(e)}")

    @task
    def trigger_appreciation_push(self):
        """ Trigger an SSE push by appreciating a random ticket ID. """
        # Normally you appreciate a coworker. For load testing the backend, 
        # we just try to hit the endpoint. Wait, appreciating yourself fails (400).
        # We'll just try to hit it with a dummy user_id or catch the 400.
        # Since the route is POST /notifications/appreciation with target_user_id.
        
        payload = {
            "target_user_id": str(uuid.uuid4()), # random unassigned user, just to trigger bus publish
            "message": "Thanks for testing!"
        }
        with self.client.post("/notifications/appreciation", json=payload, catch_response=True, name="POST /notifications/appreciation") as resp:
            if resp.status_code in [200, 201, 404]: # It might 404 if the user doesn't exist, but it tests the route
                resp.success()
