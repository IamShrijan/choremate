import locust_plugins  # enables /stats/prometheus endpoint for Grafana
from locust import HttpUser, task, between

class Exp1ApiLoadUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        """Authenticate as one of the pre-seeded users."""
        login_data = {
            "email": "roommate1@choremate.local",
            "password": "pass123"
        }
        with self.client.post("/auth/login", json=login_data, catch_response=True) as response:
            if response.status_code == 200:
                self.token = response.json().get("access_token")
                self.client.headers.update({"Authorization": f"Bearer {self.token}"})
                response.success()
            else:
                response.failure(f"Login failed: {response.text}")
                
    @task(3)
    def fetch_dashboard(self):
        self.client.get("/stats/dashboard", name="GET /stats/dashboard")

    @task(3)
    def fetch_fairness_report(self):
        self.client.get("/stats/fairness-report", name="GET /stats/fairness-report")

    @task(3)
    def fetch_my_tickets(self):
        self.client.get("/chores/my-tickets", name="GET /chores/my-tickets")
