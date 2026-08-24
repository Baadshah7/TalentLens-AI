import os
from celery import Celery
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Check if Redis is running, fallback to eager execution if not
always_eager = False
try:
    r = redis.from_url(REDIS_URL, socket_timeout=1.0)
    r.ping()
except Exception:
    always_eager = True
    print("WARNING: Redis is not reachable. Falling back to eager mode (synchronous task execution).")

celery_app = Celery(
    "talentlens",
    broker=REDIS_URL if not always_eager else None,
    backend=REDIS_URL if not always_eager else None,
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_always_eager=always_eager,
)