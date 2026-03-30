from datetime import datetime, timedelta
import os
import logging
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Warn loudly if the default key is in use — this means SSM injection failed in ECS.
if SECRET_KEY == "super-secret-key-change-me":
    logger.warning(
        "⚠️  SECRET_KEY is using the insecure default value. "
        "Set the SECRET_KEY environment variable (via SSM in ECS) before deploying."
    )

# NOTE: TOKEN_BLACKLIST is in-memory and per-process.
# In a multi-task ECS deployment this means a logout on task A is NOT visible to task B.
# Accepted limitation for now — tokens expire after ACCESS_TOKEN_EXPIRE_MINUTES anyway.
# For a production fix: replace with a shared Redis SET or DynamoDB TTL item.
TOKEN_BLACKLIST: set = set()

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def blacklist_token(token: str):
    """Add token to in-memory blacklist (best-effort in multi-task deployments)."""
    TOKEN_BLACKLIST.add(token)


def is_token_blacklisted(token: str) -> bool:
    return token in TOKEN_BLACKLIST


def decode_access_token(token: str) -> Optional[dict]:
    try:
        if is_token_blacklisted(token):
            return None
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

