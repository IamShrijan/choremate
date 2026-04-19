import json
import urllib.request
import urllib.error
import time

ALB_URL = "http://choremate-frontend-alb-1131566111.us-east-1.elb.amazonaws.com"

def make_request(path, method, data=None, token=None):
    url = f"{ALB_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode()}")
        return None

# 1. Login
print("Logging in...")
login_resp = make_request("/api/auth/login", "POST", {"email": "roommate1@choremate.local", "password": "pass123"})
if not login_resp: exit(1)
token = login_resp.get("access_token")

# 2. Ask question to trigger LLM
print("Sending chat (use_mock=True)...")
chat_resp = make_request("/api/ai-chatbot/chat", "POST", {"message": "hello mock!", "use_mock": True}, token)
print(chat_resp)

print("Waiting for Celery...")
time.sleep(5)

# 3. Read History to get the traceback
print("Fetching conversations...")
conv = make_request("/api/ai-chatbot/conversations", "GET", token=token)
if conv:
    for msg in conv:
        if msg["created_by"] in ["system", "ai"]:
            print("====================")
            print("RESPONSE:", msg["content"])
            print("====================")
