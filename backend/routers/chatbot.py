from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
import models
import schemas
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
def generate_coach_feedback(question: str, sample_answer: Optional[str] = None):
    if not question:
        raise HTTPException(status_code=400, detail='Question is required')
    fb = coach_feedback(sample_answer or '', question)
    return fb
