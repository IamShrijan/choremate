import re

with open("backend/app/api/routes/chatbot.py", "r") as f:
    text = f.read()

# Update ChatMessage
text = text.replace(
    'class ChatMessage(BaseModel):\n    message: str = Field(..., description="User\'s message to the AI chatbot")',
    'class ChatMessage(BaseModel):\n    message: str = Field(..., description="User\'s message to the AI chatbot")\n    use_mock: bool = Field(False, description="Force the mock LLM to be used for this request")'
)

# Update task.delay
text = text.replace(
    '        task = process_chat_message_task.delay(\n            current_user.id,\n            message.message,\n            None  # conversation_id  — NOT SUPPORTED, so always None\n        )',
    '        task = process_chat_message_task.delay(\n            current_user.id,\n            message.message,\n            None,  # conversation_id\n            message.use_mock\n        )'
)

with open("backend/app/api/routes/chatbot.py", "w") as f:
    f.write(text)
