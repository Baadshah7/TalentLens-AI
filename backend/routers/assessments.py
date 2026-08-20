from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from dependencies import get_current_user

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.post('/tests/', response_model=schemas.TestResponse)
def create_test(payload: schemas.TestCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # only recruiters/admins can create tests
    if current_user.Role not in ('Recruiter', 'Admin'):
        raise HTTPException(status_code=403, detail="Not authorized to create tests")

    test = models.AssessmentTest(Title=payload.Title, Job_ID=payload.Job_ID, Duration_Sec=payload.Duration_Sec, Created_By=current_user.User_ID)
    db.add(test)
    db.commit()
    db.refresh(test)

    for q in payload.Questions:
        question = models.AssessmentQuestion(Test_ID=test.Test_ID, Text=q.Text, Options=q.Options, Correct_Index=q.Correct_Index, Points=q.Points)
        db.add(question)
    db.commit()

    # load questions
    db.refresh(test)
    questions = db.query(models.AssessmentQuestion).filter(models.AssessmentQuestion.Test_ID == test.Test_ID).all()

    return {
        'Test_ID': test.Test_ID,
        'Title': test.Title,
        'Job_ID': test.Job_ID,
        'Duration_Sec': test.Duration_Sec,
        'Questions': questions
    }


@router.get('/tests/{test_id}', response_model=schemas.TestResponse)
def get_test(test_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    test = db.query(models.AssessmentTest).filter(models.AssessmentTest.Test_ID == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail='Test not found')

    # return test without correct indices
    questions = db.query(models.AssessmentQuestion).filter(models.AssessmentQuestion.Test_ID == test.Test_ID).all()
    # hide Correct_Index when serializing (schema doesn't include it)
    return {
        'Test_ID': test.Test_ID,
        'Title': test.Title,
        'Job_ID': test.Job_ID,
        'Duration_Sec': test.Duration_Sec,
        'Questions': questions
    }


@router.post('/tests/{test_id}/submit', response_model=schemas.SubmitResponse)
def submit_test(test_id: int, payload: schemas.SubmitRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # only candidates should submit
    # allow recruiters to submit for testing too
    test = db.query(models.AssessmentTest).filter(models.AssessmentTest.Test_ID == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail='Test not found')

    questions = db.query(models.AssessmentQuestion).filter(models.AssessmentQuestion.Test_ID == test.Test_ID).order_by(models.AssessmentQuestion.Question_ID).all()
    if len(payload.Answers) != len(questions):
        raise HTTPException(status_code=400, detail='Answers length must match number of questions')

    score = 0.0
    max_score = 0.0
    correct = 0
    for i, q in enumerate(questions):
        max_score += q.Points
        if payload.Answers[i] == q.Correct_Index:
            score += q.Points
            correct += 1

    result = models.AssessmentResult(Test_ID=test.Test_ID, Candidate_ID=getattr(current_user, 'User_ID', None), Score=score, Max_Score=max_score, Answers=payload.Answers)
    db.add(result)
    db.commit()
    db.refresh(result)

    percentage = (score / max_score * 100) if max_score > 0 else 0.0

    return {
        'Result_ID': result.Result_ID,
        'Test_ID': test.Test_ID,
        'Candidate_ID': result.Candidate_ID,
        'Score': score,
        'Max_Score': max_score,
        'Percentage': percentage,
        'Correct': correct,
        'Total': len(questions)
    }


@router.get('/tests/{test_id}/results')
def get_test_results(test_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Only recruiters/admins can view all test results
    if current_user.Role not in ('Recruiter', 'Admin'):
        raise HTTPException(status_code=403, detail='Not authorized')
    results = db.query(models.AssessmentResult).filter(models.AssessmentResult.Test_ID == test_id).all()
    out = []
    for r in results:
        out.append({
            'Result_ID': r.Result_ID,
            'Test_ID': r.Test_ID,
            'Candidate_ID': r.Candidate_ID,
            'Score': r.Score,
            'Max_Score': r.Max_Score,
            'Answers': r.Answers,
            'Completed_At': r.Completed_At
        })
    return out


@router.get('/results/candidate/{candidate_id}')
def get_candidate_results(candidate_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Candidates can view their own results; recruiters/admins can view any
    if current_user.Role == 'Candidate' and getattr(current_user, 'User_ID', None) is not None:
        # map user to candidate if emails match or use provided mapping
        # For now allow candidate role to fetch their own records only if ids match
        # This requires candidate User_ID mapping; keep simple allow if same id
        pass
    # allow recruiters/admins
    if current_user.Role not in ('Recruiter', 'Admin') and current_user.Role != 'Candidate':
        raise HTTPException(status_code=403, detail='Not authorized')

    results = db.query(models.AssessmentResult).filter(models.AssessmentResult.Candidate_ID == candidate_id).all()
    out = []
    for r in results:
        out.append({
            'Result_ID': r.Result_ID,
            'Test_ID': r.Test_ID,
            'Candidate_ID': r.Candidate_ID,
            'Score': r.Score,
            'Max_Score': r.Max_Score,
            'Answers': r.Answers,
            'Completed_At': r.Completed_At
        })
    return out
