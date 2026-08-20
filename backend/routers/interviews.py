from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from datetime import datetime
from database import get_db
import models
import schemas
from dependencies import get_current_user
from utils import log_action
from fastapi import WebSocket, WebSocketDisconnect
from realtime import manager

router = APIRouter(prefix="/interviews", tags=["interviews"])

@router.post("/", response_model=schemas.InterviewResponse)
def schedule_interview(
    interview_data: schemas.InterviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == interview_data.Candidate_ID).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    job = db.query(models.Job).filter(models.Job.Job_ID == interview_data.Job_ID).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    new_interview = models.Interview(
        Candidate_ID=interview_data.Candidate_ID,
        Job_ID=interview_data.Job_ID,
        Scheduled_By=current_user.User_ID,
        Interview_DateTime=interview_data.Interview_DateTime,
        Mode=interview_data.Mode,
        Notes=interview_data.Notes,
        Status="Scheduled"
    )
    db.add(new_interview)
    db.commit()
    db.refresh(new_interview)

    # Log to Audit Log
    details = f"Scheduled {new_interview.Mode} interview for Candidate #{new_interview.Candidate_ID} on {new_interview.Interview_DateTime}."
    log_action(db, user_id=current_user.User_ID, action="Interview Scheduled", details=details)

    is_blind = job.Blind_Mode and not candidate.Is_Identity_Revealed
    return {
        "Interview_ID": new_interview.Interview_ID,
        "Candidate_ID": new_interview.Candidate_ID,
        "Job_ID": new_interview.Job_ID,
        "Scheduled_By": new_interview.Scheduled_By,
        "Interview_DateTime": new_interview.Interview_DateTime,
        "Mode": new_interview.Mode,
        "Notes": new_interview.Notes,
        "Status": new_interview.Status,
        "Created_At": new_interview.Created_At,
        "Candidate_Name": f"Candidate #{candidate.Candidate_ID}" if is_blind else candidate.Name,
        "Job_Title": job.Job_Title
    }

@router.get("/", response_model=List[schemas.InterviewResponse])
def list_interviews(
    upcoming: Optional[bool] = None,
    job_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Interview)
    
    if job_id is not None:
        query = query.filter(models.Interview.Job_ID == job_id)
        
    now_time = datetime.utcnow()
    if upcoming is not None:
        if upcoming:
            query = query.filter(models.Interview.Interview_DateTime >= now_time).order_by(asc(models.Interview.Interview_DateTime))
        else:
            query = query.filter(models.Interview.Interview_DateTime < now_time).order_by(desc(models.Interview.Interview_DateTime))
    else:
        query = query.order_by(asc(models.Interview.Interview_DateTime))
        
    interviews = query.all()
    
    response = []
    for i in interviews:
        cand = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == i.Candidate_ID).first()
        job = db.query(models.Job).filter(models.Job.Job_ID == i.Job_ID).first()
        
        is_blind = job.Blind_Mode and not cand.Is_Identity_Revealed if (job and cand) else False
        name = f"Candidate #{cand.Candidate_ID}" if is_blind else (cand.Name if cand else "Unknown")
        title = job.Job_Title if job else "Unknown"
        
        response.append({
            "Interview_ID": i.Interview_ID,
            "Candidate_ID": i.Candidate_ID,
            "Job_ID": i.Job_ID,
            "Scheduled_By": i.Scheduled_By,
            "Interview_DateTime": i.Interview_DateTime,
            "Mode": i.Mode,
            "Notes": i.Notes,
            "Status": i.Status,
            "Created_At": i.Created_At,
            "Candidate_Name": name,
            "Job_Title": title
        })
    return response

@router.put("/{id}", response_model=schemas.InterviewResponse)
def update_interview(
    id: int,
    interview_data: schemas.InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    interview = db.query(models.Interview).filter(models.Interview.Interview_ID == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    old_dt = interview.Interview_DateTime
    old_status = interview.Status
    
    interview.Interview_DateTime = interview_data.Interview_DateTime
    interview.Mode = interview_data.Mode
    interview.Notes = interview_data.Notes
    interview.Status = interview_data.Status
    
    db.commit()
    db.refresh(interview)
    
    # Log update
    details = f"Updated Interview #{id}. Status: {old_status} -> {interview.Status}. Date/Time: {old_dt} -> {interview.Interview_DateTime}."
    log_action(db, user_id=current_user.User_ID, action="Interview Updated", details=details)
    
    cand = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == interview.Candidate_ID).first()
    job = db.query(models.Job).filter(models.Job.Job_ID == interview.Job_ID).first()
    
    is_blind = job.Blind_Mode and not cand.Is_Identity_Revealed if (job and cand) else False
    name = f"Candidate #{cand.Candidate_ID}" if is_blind else (cand.Name if cand else "Unknown")
    
    return {
        "Interview_ID": interview.Interview_ID,
        "Candidate_ID": interview.Candidate_ID,
        "Job_ID": interview.Job_ID,
        "Scheduled_By": interview.Scheduled_By,
        "Interview_DateTime": interview.Interview_DateTime,
        "Mode": interview.Mode,
        "Notes": interview.Notes,
        "Status": interview.Status,
        "Created_At": interview.Created_At,
        "Candidate_Name": name,
        "Job_Title": job.Job_Title if job else "Unknown"
    }

@router.delete("/{id}")
def delete_interview(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    interview = db.query(models.Interview).filter(models.Interview.Interview_ID == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    cand_id = interview.Candidate_ID
    db.delete(interview)
    db.commit()
    
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Interview Deleted",
        details=f"Recruiter deleted interview session #{id} for Candidate #{cand_id}."
    )
    return {"message": "Interview deleted successfully"}


@router.websocket('/ws/{room_id}')
async def interview_ws(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for live interview rooms.

    Path: /interviews/ws/{room_id}
    Simple behavior: accept connection, broadcast incoming text/json to all room participants.
    """
    await manager.connect(room_id, websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
            except Exception:
                break
            # echo/broadcast to room
            await manager.broadcast_text(room_id, data)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(room_id, websocket)
