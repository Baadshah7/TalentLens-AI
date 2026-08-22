from datetime import datetime

from celery import Task
from sqlalchemy.exc import OperationalError

from celery_app import celery_app
from database import SessionLocal
import models
from processing import process_resume_task


class ResumeProcessingTask(Task):
    autoretry_for = (ConnectionError, OperationalError)
    retry_backoff = True
    max_retries = 3

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Persist a terminal failure if Celery exhausts transient retries."""
        db = SessionLocal()
        try:
            task = db.query(models.ResumeProcessingTask).filter(
                models.ResumeProcessingTask.Task_ID == task_id
            ).first()
            if task and task.Status in {"PENDING", "PROCESSING"}:
                candidate = db.query(models.Candidate).filter(
                    models.Candidate.Candidate_ID == task.Candidate_ID
                ).first()
                if candidate:
                    candidate.Processing_Status = "Failed"
                task.Status = "FAILED"
                task.Completed_At = datetime.utcnow()
                task.Error_Message = "Resume processing failed after temporary service retries."
                db.commit()
        finally:
            db.close()


@celery_app.task(
    name="talentlens.process_resume",
    bind=True,
    base=ResumeProcessingTask,
    acks_late=True,
)
def process_resume(self, task_id: str):
    process_resume_task(task_id)