from sqlalchemy.orm import Session
import models
import datetime

def log_action(db: Session, user_id: int, action: str, details: str = None):
    try:
        audit_log = models.AuditLog(
            User_ID=user_id,
            Action=action,
            Timestamp=datetime.datetime.utcnow(),
            Details=details
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        # Prevent database issues with logging from crashing the primary request
        db.rollback()
        print(f"Failed to log action: {e}")
