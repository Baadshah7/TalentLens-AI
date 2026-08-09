from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from database import get_db
import models
import schemas
from dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    total_jobs = db.query(models.Job).count()
    total_candidates = db.query(models.Candidate).count()
    
    # In Phase 2, we query the actual candidate scores from ScreeningResult
    candidates_shortlisted = db.query(models.ScreeningResult).filter(models.ScreeningResult.Overall_Score >= 70.0).count()
    candidates_rejected = db.query(models.ScreeningResult).filter(models.ScreeningResult.Overall_Score < 50.0).count()
    candidates_under_review = db.query(models.ScreeningResult).filter(
        models.ScreeningResult.Overall_Score >= 50.0,
        models.ScreeningResult.Overall_Score < 70.0
    ).count()

    # Also count failed parses as rejected/failed candidates or add them to rejected
    failed_count = db.query(models.Candidate).filter(models.Candidate.Processing_Status == "Failed").count()
    candidates_rejected += failed_count

    return {
        "total_jobs": total_jobs,
        "total_candidates": total_candidates,
        "candidates_shortlisted": candidates_shortlisted,
        "candidates_rejected": candidates_rejected,
        "candidates_under_review": candidates_under_review
    }

@router.get("/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_recent_audit_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    logs = db.query(
        models.AuditLog.Log_ID,
        models.AuditLog.User_ID,
        models.AuditLog.Action,
        models.AuditLog.Timestamp,
        models.AuditLog.Details,
        models.User.Name.label("User_Name")
    ).outerjoin(
        models.User, models.AuditLog.User_ID == models.User.User_ID
    ).order_by(
        desc(models.AuditLog.Timestamp)
    ).limit(20).all()
    
    return [
        {
            "Log_ID": log.Log_ID,
            "User_ID": log.User_ID,
            "Action": log.Action,
            "Timestamp": log.Timestamp,
            "Details": log.Details,
            "User_Name": log.User_Name or "System"
        }
        for log in logs
    ]
