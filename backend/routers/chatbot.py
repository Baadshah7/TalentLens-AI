from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
import models
import schemas
from dependencies import get_current_user
from chatbot import generate_interview_questions, coach_feedback

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.post('/generate/interviewer')
def generate_interviewer_questions(job_id: int, candidate_id: Optional[int] = None, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')

    candidate = None
    if candidate_id:
        candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()

    # Convert ORM to dict light-weight
    job_dict = {
        'Job_Title': job.Job_Title,
        'Required_Skills': job.Required_Skills or [],
        'Preferred_Skills': job.Preferred_Skills or []
    }

    cand_dict = None
    if candidate:
        cand_dict = {
            'Name': candidate.Name,
            'skills': [s.Skill for s in candidate.skills],
            'projects': [p.Project_Name for p in candidate.projects]
        }

    questions = generate_interview_questions(job_dict, cand_dict)
    return {'questions': questions}


@router.post('/generate/coach')
def generate_coach_feedback(body: schemas.ChatbotQuery):
    question = body.question
    sample_answer = body.sample_answer
    if not question:
        raise HTTPException(status_code=400, detail='Question is required')
    fb = coach_feedback(sample_answer or '', question)
    return fb


@router.post('/coach/sessions', response_model=schemas.CoachSessionResponse)
def create_coach_session(
    body: schemas.CoachSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    result = coach_feedback(body.sample_answer, body.question)
    session = models.CoachSession(
        User_ID=current_user.User_ID,
        Question=body.question,
        Sample_Answer=body.sample_answer,
        Feedback=result["feedback"],
        Suggestions=result["suggestions"],
        Star_Analysis=result["star_analysis"],
        Star_Score=result["star_score"]
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get('/coach/sessions', response_model=list[schemas.CoachSessionResponse])
def list_coach_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return (
        db.query(models.CoachSession)
        .filter(models.CoachSession.User_ID == current_user.User_ID)
        .order_by(models.CoachSession.Created_At.desc())
        .limit(50)
        .all()
    )
