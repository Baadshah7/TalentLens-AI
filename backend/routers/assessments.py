import os
import random
import datetime
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas
from dependencies import get_current_user, get_current_admin
from auth import create_access_token

router = APIRouter(prefix="/assessments", tags=["assessments"])


# ==========================================
# Legacy Flat Assessments (Compatibility)
# ==========================================

def _authorize_candidate_results(candidate_id: int, db: Session, current_user: models.User) -> models.Candidate:
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if current_user.Role == "Admin":
        return candidate

    job = db.query(models.Job).filter(models.Job.Job_ID == candidate.Job_ID).first()
    recruiter_owns_job = (
        current_user.Role == "Recruiter"
        and job is not None
        and job.Created_By == current_user.User_ID
    )
    candidate_owns_record = (
        current_user.Role == "Candidate"
        and bool(candidate.Email)
        and candidate.Email.lower() == current_user.Email.lower()
    )
    if not recruiter_owns_job and not candidate_owns_record:
        raise HTTPException(status_code=403, detail="Not authorized to view these assessment results")
    return candidate


@router.post('/tests/', response_model=schemas.TestResponse)
def create_test(payload: schemas.TestCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
def get_test(test_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    test = db.query(models.AssessmentTest).filter(models.AssessmentTest.Test_ID == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail='Test not found')

    questions = db.query(models.AssessmentQuestion).filter(models.AssessmentQuestion.Test_ID == test.Test_ID).all()
    return {
        'Test_ID': test.Test_ID,
        'Title': test.Title,
        'Job_ID': test.Job_ID,
        'Duration_Sec': test.Duration_Sec,
        'Questions': questions
    }


@router.post('/tests/{test_id}/submit', response_model=schemas.SubmitResponse)
def submit_test(test_id: int, payload: schemas.SubmitRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
def get_test_results(test_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
def get_candidate_results(candidate_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _authorize_candidate_results(candidate_id, db, current_user)

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


# ==========================================
# Candidate Authentication (Magic OTP Link)
# ==========================================

@router.post('/candidate/login/request')
def request_candidate_otp(payload: schemas.CandidateLoginRequest, db: Session = Depends(get_db)):
    email = payload.Email.strip().lower()
    
    # Validate candidate email exists in candidate directory
    candidate = db.query(models.Candidate).filter(models.Candidate.Email.ilike(email)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate email address not found in screening directory")
        
    otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    
    existing_otp = db.query(models.CandidateOTP).filter(models.CandidateOTP.Email == email).first()
    if existing_otp:
        existing_otp.OTP_Code = otp_code
        existing_otp.Expires_At = expires_at
    else:
        new_otp = models.CandidateOTP(Email=email, OTP_Code=otp_code, Expires_At=expires_at)
        db.add(new_otp)
        
    db.commit()
    
    # Print to console log for local development access
    print("\n" + "="*55)
    print(f"CANDIDATE SIGN-IN OTP REQUEST LOGGED TO SERVER CONSOLE:")
    print(f"Candidate: {candidate.Name}")
    print(f"Email    : {email}")
    print(f"OTP Code : {otp_code}")
    print("="*55 + "\n")
    
    return {"message": "Verification code logged to server console (OTP sent successfully)"}


@router.post('/candidate/login/verify', response_model=schemas.CandidateTokenResponse)
def verify_candidate_otp(payload: schemas.CandidateLoginVerify, db: Session = Depends(get_db)):
    email = payload.Email.strip().lower()
    
    otp_entry = db.query(models.CandidateOTP).filter(
        models.CandidateOTP.Email == email,
        models.CandidateOTP.OTP_Code == payload.OTP_Code
    ).first()
    
    if not otp_entry:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    if otp_entry.Expires_At < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
        
    candidate = db.query(models.Candidate).filter(models.Candidate.Email.ilike(email)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
        
    db.delete(otp_entry)
    db.commit()
    
    # Generate token
    token = create_access_token({
        "sub": candidate.Email,
        "user_id": candidate.Candidate_ID,
        "role": "Candidate"
    })
    
    # Unlock Level 1 of Beginner for all domains
    initialize_candidate_progress(candidate.Candidate_ID, db)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "Candidate_ID": candidate.Candidate_ID,
        "Email": candidate.Email,
        "Name": candidate.Name,
        "Role": "Candidate"
    }


def initialize_candidate_progress(candidate_id: int, db: Session):
    domains = db.query(models.AssessmentDomain).filter(models.AssessmentDomain.Is_Active == True).all()
    for d in domains:
        beginner_track = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == d.Domain_ID,
            models.AssessmentTrack.Name == "Beginner"
        ).first()
        if beginner_track:
            lvl1 = db.query(models.AssessmentSubLevel).filter(
                models.AssessmentSubLevel.Track_ID == beginner_track.Track_ID,
                models.AssessmentSubLevel.Level_Number == 1
            ).first()
            if lvl1:
                progress = db.query(models.CandidateProgress).filter(
                    models.CandidateProgress.Candidate_ID == candidate_id,
                    models.CandidateProgress.Sub_Level_ID == lvl1.Sub_Level_ID
                ).first()
                if not progress:
                    new_prog = models.CandidateProgress(
                        Candidate_ID=candidate_id,
                        Sub_Level_ID=lvl1.Sub_Level_ID,
                        Is_Unlocked=True,
                        Is_Completed=False
                    )
                    db.add(new_prog)
    db.commit()


# ==========================================
# Multi-Level Assessments Engine endpoints
# ==========================================

def is_sublevel_unlocked(candidate_id: int, sl: models.AssessmentSubLevel, db: Session) -> bool:
    track = sl.track
    if not track:
        return False
        
    # Level 1 of Beginner is always unlocked
    if track.Name == "Beginner" and sl.Level_Number == 1:
        return True
        
    # Check if user has explicit progress record showing unlocked
    prog = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == candidate_id,
        models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
    ).first()
    if prog and prog.Is_Unlocked:
        return True
        
    # If same track Level > 1: check if prev level is completed
    if sl.Level_Number > 1:
        prev_sl = db.query(models.AssessmentSubLevel).filter(
            models.AssessmentSubLevel.Track_ID == track.Track_ID,
            models.AssessmentSubLevel.Level_Number == sl.Level_Number - 1
        ).first()
        if prev_sl:
            prev_prog = db.query(models.CandidateProgress).filter(
                models.CandidateProgress.Candidate_ID == candidate_id,
                models.CandidateProgress.Sub_Level_ID == prev_sl.Sub_Level_ID
            ).first()
            return prev_prog is not None and prev_prog.Is_Completed
        return False
        
    # If Level 1 of Intermediate: check if all 5 Beginner levels are completed
    if track.Name == "Intermediate":
        beg_track = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == track.Domain_ID,
            models.AssessmentTrack.Name == "Beginner"
        ).first()
        if beg_track:
            beg_levels = db.query(models.AssessmentSubLevel.Sub_Level_ID).filter(
                models.AssessmentSubLevel.Track_ID == beg_track.Track_ID
            ).all()
            beg_ids = [b[0] for b in beg_levels]
            completed_beg = db.query(models.CandidateProgress).filter(
                models.CandidateProgress.Candidate_ID == candidate_id,
                models.CandidateProgress.Sub_Level_ID.in_(beg_ids),
                models.CandidateProgress.Is_Completed == True
            ).count()
            return len(beg_ids) > 0 and completed_beg == len(beg_ids)
        return False
        
    # If Level 1 of Advanced: check if all 5 Intermediate levels are completed
    if track.Name == "Advanced":
        int_track = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == track.Domain_ID,
            models.AssessmentTrack.Name == "Intermediate"
        ).first()
        if int_track:
            int_levels = db.query(models.AssessmentSubLevel.Sub_Level_ID).filter(
                models.AssessmentSubLevel.Track_ID == int_track.Track_ID
            ).all()
            int_ids = [i[0] for i in int_levels]
            completed_int = db.query(models.CandidateProgress).filter(
                models.CandidateProgress.Candidate_ID == candidate_id,
                models.CandidateProgress.Sub_Level_ID.in_(int_ids),
                models.CandidateProgress.Is_Completed == True
            ).count()
            return len(int_ids) > 0 and completed_int == len(int_ids)
        return False
        
    return False


def unlock_next_sublevel(candidate_id: int, sl: models.AssessmentSubLevel, db: Session):
    track = sl.track
    if not track:
        return
        
    # 1. Level < 5 -> Unlock Level + 1
    if sl.Level_Number < 5:
        next_sl = db.query(models.AssessmentSubLevel).filter(
            models.AssessmentSubLevel.Track_ID == track.Track_ID,
            models.AssessmentSubLevel.Level_Number == sl.Level_Number + 1
        ).first()
        if next_sl:
            unlock_level_record(candidate_id, next_sl.Sub_Level_ID, db)
            
    # 2. Level 5 of Beginner -> Unlock Level 1 of Intermediate
    elif sl.Level_Number == 5 and track.Name == "Beginner":
        int_track = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == track.Domain_ID,
            models.AssessmentTrack.Name == "Intermediate"
        ).first()
        if int_track:
            next_sl = db.query(models.AssessmentSubLevel).filter(
                models.AssessmentSubLevel.Track_ID == int_track.Track_ID,
                models.AssessmentSubLevel.Level_Number == 1
            ).first()
            if next_sl:
                unlock_level_record(candidate_id, next_sl.Sub_Level_ID, db)
                
    # 3. Level 5 of Intermediate -> Unlock Level 1 of Advanced
    elif sl.Level_Number == 5 and track.Name == "Intermediate":
        adv_track = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == track.Domain_ID,
            models.AssessmentTrack.Name == "Advanced"
        ).first()
        if adv_track:
            next_sl = db.query(models.AssessmentSubLevel).filter(
                models.AssessmentSubLevel.Track_ID == adv_track.Track_ID,
                models.AssessmentSubLevel.Level_Number == 1
            ).first()
            if next_sl:
                unlock_level_record(candidate_id, next_sl.Sub_Level_ID, db)


def unlock_level_record(candidate_id: int, sub_level_id: int, db: Session):
    prog = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == candidate_id,
        models.CandidateProgress.Sub_Level_ID == sub_level_id
    ).first()
    if not prog:
        prog = models.CandidateProgress(
            Candidate_ID=candidate_id,
            Sub_Level_ID=sub_level_id,
            Is_Unlocked=True,
            Is_Completed=False
        )
        db.add(prog)
    else:
        prog.Is_Unlocked = True


@router.get('/domains', response_model=List[schemas.DomainResponse])
def list_domains(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    domains = db.query(models.AssessmentDomain).filter(models.AssessmentDomain.Is_Active == True).all()
    out = []
    
    for d in domains:
        sub_level_ids = db.query(models.AssessmentSubLevel.Sub_Level_ID).join(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == d.Domain_ID
        ).all()
        sub_level_ids = [s[0] for s in sub_level_ids]
        
        comp_count = 0
        if current_user.Role == "Candidate":
            comp_count = db.query(models.CandidateProgress).filter(
                models.CandidateProgress.Candidate_ID == current_user.Candidate_ID,
                models.CandidateProgress.Sub_Level_ID.in_(sub_level_ids),
                models.CandidateProgress.Is_Completed == True
            ).count()
            
        completion_percent = (comp_count / len(sub_level_ids) * 100.0) if sub_level_ids else 0.0
        
        out.append({
            "Domain_ID": d.Domain_ID,
            "Name": d.Name,
            "Icon_Slug": d.Icon_Slug,
            "Description": d.Description,
            "Is_Active": d.Is_Active,
            "Completion_Percentage": completion_percent
        })
        
    return out


@router.get('/domains/{domain_id}/tracks', response_model=List[schemas.TrackResponse])
def get_domain_tracks(domain_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    domain = db.query(models.AssessmentDomain).filter(models.AssessmentDomain.Domain_ID == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    tracks = db.query(models.AssessmentTrack).filter(
        models.AssessmentTrack.Domain_ID == domain_id
    ).order_by(models.AssessmentTrack.Order_Index.asc()).all()
    
    out = []
    for t in tracks:
        sub_levels = db.query(models.AssessmentSubLevel).filter(
            models.AssessmentSubLevel.Track_ID == t.Track_ID
        ).order_by(models.AssessmentSubLevel.Level_Number.asc()).all()
        
        sl_responses = []
        for sl in sub_levels:
            is_unlocked = False
            is_completed = False
            best_score = 0.0
            
            if current_user.Role == "Candidate":
                prog = db.query(models.CandidateProgress).filter(
                    models.CandidateProgress.Candidate_ID == current_user.Candidate_ID,
                    models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
                ).first()
                is_unlocked = is_sublevel_unlocked(current_user.Candidate_ID, sl, db)
                if prog:
                    is_completed = prog.Is_Completed
                    best_score = prog.Best_Score_Percent
            else:
                is_unlocked = True
                is_completed = False
                best_score = 0.0
                
            sl_responses.append({
                "Sub_Level_ID": sl.Sub_Level_ID,
                "Track_ID": sl.Track_ID,
                "Level_Number": sl.Level_Number,
                "Name": sl.Name,
                "Question_Count": sl.Question_Count,
                "Pass_Threshold_Percent": sl.Pass_Threshold_Percent,
                "Time_Limit_Minutes": sl.Time_Limit_Minutes,
                "Is_Unlocked": is_unlocked,
                "Is_Completed": is_completed,
                "Best_Score": best_score
            })
            
        out.append({
            "Track_ID": t.Track_ID,
            "Domain_ID": t.Domain_ID,
            "Name": t.Name,
            "Order_Index": t.Order_Index,
            "Sub_Levels": sl_responses
        })
        
    return out


@router.get('/sub-levels/{sub_level_id}/questions', response_model=List[schemas.QuestionNewResponse])
def get_sub_level_questions(sub_level_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    sl = db.query(models.AssessmentSubLevel).filter(models.AssessmentSubLevel.Sub_Level_ID == sub_level_id).first()
    if not sl:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    if current_user.Role == "Candidate":
        if not is_sublevel_unlocked(current_user.Candidate_ID, sl, db):
            raise HTTPException(status_code=403, detail="This level is locked. Complete the prerequisite levels to unlock it.")
            
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id
    ).all()
    
    # Shuffle options and question order for candidates to prevent simple memorization on retries
    if current_user.Role == "Candidate":
        q_copy = []
        for q in questions:
            opts = list(q.Options)
            # Find correct option value to trace index shift
            correct_val = opts[q.Correct_Option_Index]
            random.shuffle(opts)
            new_correct_idx = opts.index(correct_val)
            
            # Use temporary object with shuffled options
            q_copy.append(models.AssessmentQuestionNew(
                Question_ID=q.Question_ID,
                Sub_Level_ID=q.Sub_Level_ID,
                Question_Text=q.Question_Text,
                Options=opts,
                Correct_Option_Index=new_correct_idx
            ))
        random.shuffle(q_copy)
        return q_copy
        
    return questions


@router.post('/sub-levels/{sub_level_id}/attempts', response_model=schemas.AttemptStartResponse)
def start_sub_level_attempt(sub_level_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.Role != "Candidate":
        raise HTTPException(status_code=403, detail="Only candidates can attempt assessments")
        
    sl = db.query(models.AssessmentSubLevel).filter(models.AssessmentSubLevel.Sub_Level_ID == sub_level_id).first()
    if not sl:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    if not is_sublevel_unlocked(current_user.Candidate_ID, sl, db):
        raise HTTPException(status_code=403, detail="Level is locked")
        
    attempt_count = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == current_user.Candidate_ID,
        models.AssessmentAttemptNew.Sub_Level_ID == sub_level_id
    ).count()
    
    attempt = models.AssessmentAttemptNew(
        Candidate_ID=current_user.Candidate_ID,
        Sub_Level_ID=sub_level_id,
        Attempt_Number=attempt_count + 1,
        Started_At=datetime.datetime.utcnow()
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return attempt


@router.post('/attempts/{attempt_id}/submit', response_model=schemas.AttemptSubmitResponse)
def submit_sub_level_attempt(attempt_id: int, payload: schemas.AttemptSubmitRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.Role != "Candidate":
        raise HTTPException(status_code=403, detail="Only candidates can submit assessments")
        
    attempt = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Attempt_ID == attempt_id,
        models.AssessmentAttemptNew.Candidate_ID == current_user.Candidate_ID
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt session not found")
        
    if attempt.Submitted_At:
        raise HTTPException(status_code=400, detail="This attempt session was already submitted")
        
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == attempt.Sub_Level_ID
    ).all()
    
    correct_count = 0
    incorrect_count = 0
    skipped_count = 0
    
    # Map submitted answers
    ans_map = {ans.Question_ID: ans.Selected_Option_Index for ans in payload.Answers}
    
    for q in questions:
        selected = ans_map.get(q.Question_ID)
        
        is_correct = False
        if selected is None or selected == -1:
            skipped_count += 1
            selected = None
        elif selected == q.Correct_Option_Index:
            correct_count += 1
            is_correct = True
        else:
            incorrect_count += 1
            
        ans_entry = models.AttemptAnswerNew(
            Attempt_ID=attempt.Attempt_ID,
            Question_ID=q.Question_ID,
            Selected_Option_Index=selected,
            Is_Correct=is_correct
        )
        db.add(ans_entry)
        
    total_q = len(questions)
    score_pct = (correct_count / total_q * 100.0) if total_q > 0 else 0.0
    
    sl = attempt.sub_level
    is_passed = score_pct >= (sl.Pass_Threshold_Percent or 70.0)
    
    attempt.Submitted_At = datetime.datetime.utcnow()
    attempt.Score_Percent = score_pct
    attempt.Correct_Count = correct_count
    attempt.Incorrect_Count = incorrect_count
    attempt.Skipped_Count = skipped_count
    attempt.Time_Taken_Seconds = payload.Time_Taken_Seconds
    attempt.Is_Passed = is_passed
    
    # Save candidate progress cache
    prog = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == current_user.Candidate_ID,
        models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
    ).first()
    
    if not prog:
        prog = models.CandidateProgress(
            Candidate_ID=current_user.Candidate_ID,
            Sub_Level_ID=sl.Sub_Level_ID,
            Is_Unlocked=True,
            Best_Score_Percent=score_pct,
            Is_Completed=is_passed,
            Attempts_Count=1,
            Last_Attempted_At=datetime.datetime.utcnow()
        )
        db.add(prog)
    else:
        prog.Attempts_Count += 1
        prog.Last_Attempted_At = datetime.datetime.utcnow()
        if score_pct > prog.Best_Score_Percent:
            prog.Best_Score_Percent = score_pct
        if is_passed:
            prog.Is_Completed = True
            
    if is_passed:
        unlock_next_sublevel(current_user.Candidate_ID, sl, db)
        
    db.commit()
    db.refresh(attempt)
    
    return attempt


@router.get('/attempts/{attempt_id}/results', response_model=schemas.AttemptDetailResponse)
def get_attempt_results(attempt_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    attempt = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Attempt_ID == attempt_id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    if current_user.Role == "Candidate" and attempt.Candidate_ID != current_user.Candidate_ID:
        raise HTTPException(status_code=403, detail="Not authorized to view these results")
        
    answers = db.query(models.AttemptAnswerNew).filter(
        models.AttemptAnswerNew.Attempt_ID == attempt_id
    ).all()
    
    ans_details = []
    for ans in answers:
        q = db.query(models.AssessmentQuestionNew).filter(
            models.AssessmentQuestionNew.Question_ID == ans.Question_ID
        ).first()
        if q:
            ans_details.append({
                "Question_ID": q.Question_ID,
                "Question_Text": q.Question_Text,
                "Options": q.Options,
                "Selected_Option_Index": ans.Selected_Option_Index,
                "Correct_Option_Index": q.Correct_Option_Index,
                "Is_Correct": ans.Is_Correct,
                "Explanation": q.Explanation
            })
            
    return {
        "Attempt_ID": attempt.Attempt_ID,
        "Sub_Level_ID": attempt.Sub_Level_ID,
        "Started_At": attempt.Started_At,
        "Submitted_At": attempt.Submitted_At,
        "Score_Percent": attempt.Score_Percent,
        "Correct_Count": attempt.Correct_Count,
        "Incorrect_Count": attempt.Incorrect_Count,
        "Skipped_Count": attempt.Skipped_Count,
        "Time_Taken_Seconds": attempt.Time_Taken_Seconds,
        "Is_Passed": attempt.Is_Passed,
        "Answers": ans_details
    }


@router.get('/users/progress-summary', response_model=schemas.ProgressSummaryResponse)
def get_user_progress_summary(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.Role != "Candidate":
        return {"total_attempts": 0, "completed_levels": 0, "xp": 0, "streak": 0, "achievements": []}
        
    total_attempts = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == current_user.Candidate_ID,
        models.AssessmentAttemptNew.Submitted_At != None
    ).count()
    
    completed_levels = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == current_user.Candidate_ID,
        models.CandidateProgress.Is_Completed == True
    ).count()
    
    progresses = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == current_user.Candidate_ID,
        models.CandidateProgress.Is_Completed == True
    ).all()
    
    xp = 0
    for p in progresses:
        sl = db.query(models.AssessmentSubLevel).filter(models.AssessmentSubLevel.Sub_Level_ID == p.Sub_Level_ID).first()
        if sl:
            track = sl.track
            if track:
                if track.Name == "Beginner":
                    xp += 100
                elif track.Name == "Intermediate":
                    xp += 200
                elif track.Name == "Advanced":
                    xp += 300
                    
    streak = 1
    achievements = []
    if completed_levels >= 1:
        achievements.append("First Milestone")
    if completed_levels >= 5:
        achievements.append("Fast Learner")
        
    perfect_attempts = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == current_user.Candidate_ID,
        models.AssessmentAttemptNew.Score_Percent == 100.0
    ).count()
    if perfect_attempts > 0:
        achievements.append("Perfect Score Master")
        
    return {
        "total_attempts": total_attempts,
        "completed_levels": completed_levels,
        "xp": xp,
        "streak": streak,
        "achievements": achievements
    }


@router.get('/candidate/{candidate_id}/attempts')
def list_candidate_attempts(
    candidate_id: int, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    if current_user.Role == "Candidate" and current_user.Candidate_ID != candidate_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.Role == "Recruiter":
        cand = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
        if not cand:
            raise HTTPException(status_code=404, detail="Candidate not found")
        job = db.query(models.Job).filter(models.Job.Job_ID == cand.Job_ID).first()
        if not job or (current_user.Role != "Admin" and job.Created_By != current_user.User_ID):
            raise HTTPException(status_code=403, detail="Not authorized")
            
    attempts = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == candidate_id,
        models.AssessmentAttemptNew.Submitted_At != None
    ).order_by(models.AssessmentAttemptNew.Submitted_At.desc()).all()
    
    out = []
    for a in attempts:
        sl = a.sub_level
        track = sl.track if sl else None
        dom = track.domain if track else None
        out.append({
            "Attempt_ID": a.Attempt_ID,
            "Domain_Name": dom.Name if dom else "General",
            "Track_Name": track.Name if track else "Beginner",
            "Level_Number": sl.Level_Number if sl else 1,
            "Submitted_At": a.Submitted_At,
            "Score_Percent": a.Score_Percent,
            "Is_Passed": a.Is_Passed,
            "Attempt_Number": a.Attempt_Number
        })
    return out


# ==========================================
# Admin Assessment Authoring & Generation
# ==========================================

@router.post('/admin/generate-questions', response_model=schemas.QuestionNewAdminList)
async def generate_assessment_questions(
    sub_level_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    sub_level = db.query(models.AssessmentSubLevel).filter(
        models.AssessmentSubLevel.Sub_Level_ID == sub_level_id
    ).first()
    if not sub_level:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    track = sub_level.track
    domain = track.domain if track else None
    
    domain_name = domain.Name if domain else "General"
    difficulty = track.Name if track else "Beginner"
    level_num = sub_level.Level_Number
    
    system_prompt = (
        "You are an expert technical interviewer. You must generate exactly 25 multiple-choice questions (MCQs) for the "
        f"domain '{domain_name}' and difficulty tier '{difficulty}' (Level {level_num}/5).\n"
        "Beginner track must request fundamental/definitional questions.\n"
        "Intermediate should request applied/scenario-based questions.\n"
        "Advanced should request deep/edge-case/architecture-level questions.\n"
        "Format your output STRICTLY as a JSON object matching this schema. Output ONLY valid JSON, do not include any markdown fences, headers, explanation, or conversational prose:\n"
        "{\n"
        "  \"questions\": [\n"
        "    {\n"
        "      \"question_text\": \"Question text here.\",\n"
        "      \"options\": [\"Option 0\", \"Option 1\", \"Option 2\", \"Option 3\"],\n"
        "      \"correct_option_index\": 0,\n"
        "      \"explanation\": \"Short explanation of the correct answer.\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )
    
    user_prompt = f"Generate exactly 25 MCQs for {domain_name} ({difficulty} Level {level_num})."
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY environment variable not set. Generating mock questions...")
        mock_questions = []
        for i in range(1, 26):
            mock_questions.append({
                "Question_Text": f"Mock Question {i}: What is the primary characteristic of {domain_name} at the {difficulty} level?",
                "Options": [
                    f"Option A - Foundational concept for {domain_name}",
                    f"Option B - Secondary concept for {difficulty} tier",
                    f"Option C - Architectural consideration",
                    f"Option D - None of the above"
                ],
                "Correct_Option_Index": random.randint(0, 3),
                "Explanation": f"This is a mock explanation for Question {i} because ANTHROPIC_API_KEY is not set."
            })
        return {"Questions": mock_questions}
        
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 4000,
                "messages": [
                    {"role": "user", "content": f"{system_prompt}\n\n{user_prompt}"}
                ]
            }
            
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
                timeout=60.0
            )
            
            if response.status_code != 200:
                print(f"Claude API Error: {response.text}")
                raise HTTPException(status_code=502, detail="Failed to generate questions via Claude API")
                
            res_json = response.json()
            content_text = res_json["content"][0]["text"].strip()
            
            if content_text.startswith("```"):
                lines = content_text.split("\n")
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                content_text = "\n".join(lines).strip()
                
            data = json.loads(content_text)
            questions_list = data.get("questions", [])
            
            if len(questions_list) < 25:
                raise ValueError(f"Returned only {len(questions_list)} questions instead of 25")
                
            final_list = []
            for q in questions_list[:25]:
                final_list.append({
                    "Question_Text": q["question_text"],
                    "Options": q["options"],
                    "Correct_Option_Index": q["correct_option_index"],
                    "Explanation": q.get("explanation", "")
                })
                
            return {"Questions": final_list}
            
    except Exception as e:
        print(f"Failed to generate questions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Question generation failed: {str(e)}. Please retry or verify your Claude API key."
        )


@router.post('/admin/publish-questions')
def publish_assessment_questions(
    sub_level_id: int,
    payload: schemas.QuestionNewAdminList,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    sl = db.query(models.AssessmentSubLevel).filter(
        models.AssessmentSubLevel.Sub_Level_ID == sub_level_id
    ).first()
    if not sl:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    track = sl.track
    domain = track.domain if track else None
    if not domain:
        raise HTTPException(status_code=404, detail="Associated domain not found")
        
    if len(payload.Questions) != 25:
        raise HTTPException(status_code=400, detail="A level must contain exactly 25 questions to be published")
        
    try:
        db.query(models.AssessmentQuestionNew).filter(
            models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id
        ).delete()
        
        for q in payload.Questions:
            new_q = models.AssessmentQuestionNew(
                Sub_Level_ID=sub_level_id,
                Domain_ID=domain.Domain_ID,
                Question_Text=q.Question_Text,
                Options=q.Options,
                Correct_Option_Index=q.Correct_Option_Index,
                Explanation=q.Explanation,
                Difficulty_Tag=track.Name
            )
            db.add(new_q)
            
        db.commit()
        return {"message": f"Successfully published 25 questions to {domain.Name} - {track.Name} - Level {sl.Level_Number}."}
        
    except Exception as e:
        db.rollback()
        print(f"Failed to publish questions: {e}")
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")


@router.get('/admin/sub-levels/{sub_level_id}/questions', response_model=schemas.QuestionNewAdminList)
def get_admin_sub_level_questions(
    sub_level_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id
    ).all()
    
    formatted = []
    for q in questions:
        formatted.append({
            "Question_ID": q.Question_ID,
            "Question_Text": q.Question_Text,
            "Options": q.Options,
            "Correct_Option_Index": q.Correct_Option_Index,
            "Explanation": q.Explanation
        })
        
    return {"Questions": formatted}



# ==========================================
# Database Auto-Seeding Trigger
# ==========================================

def seed_assessments_db(db: Session):
    existing = db.query(models.AssessmentDomain).first()
    if existing:
        return
        
    domains_data = [
        {"name": "Machine Learning", "icon": "brain", "desc": "Fundamentals, scenario applications, and advanced system design for ML algorithms, frameworks, and architecture."},
        {"name": "Web Development", "icon": "code", "desc": "HTML/CSS, React, Node.js, routing, security, state management, and modern responsive app architecture."},
        {"name": "Cybersecurity", "icon": "shield", "desc": "Network security, cryptography, penetration testing, secure coding, and identity management."},
        {"name": "App Development", "icon": "smartphone", "desc": "Flutter, React Native, Swift, Kotlin, state management, offline storage, and mobile platform optimizations."},
        {"name": "Data Science", "icon": "database", "desc": "Data analytics, Pandas, SQL, data warehousing, visualization, statistical testing, and ETL pipelines."},
        {"name": "Artificial Intelligence", "icon": "sparkles", "desc": "Neural networks, Deep Learning, NLP, Large Language Models, prompt engineering, and AI safety."},
        {"name": "Non-Technical / Aptitude", "icon": "scale", "desc": "Logical reasoning, quantitative analysis, data interpretation, verbal ability, and problem solving."}
    ]
    
    print("Auto-seeding default assessment domains, tracks, and sublevels...")
    for d in domains_data:
        domain = models.AssessmentDomain(Name=d["name"], Icon_Slug=d["icon"], Description=d["desc"])
        db.add(domain)
        db.commit()
        db.refresh(domain)
        
        for idx, track_name in enumerate(["Beginner", "Intermediate", "Advanced"]):
            track = models.AssessmentTrack(Domain_ID=domain.Domain_ID, Name=track_name, Order_Index=idx)
            db.add(track)
            db.commit()
            db.refresh(track)
            
            for level_num in range(1, 6):
                sub_level = models.AssessmentSubLevel(
                    Track_ID=track.Track_ID,
                    Level_Number=level_num,
                    Name=f"Level {level_num}",
                    Question_Count=25,
                    Pass_Threshold_Percent=70.0,
                    Time_Limit_Minutes=25 + (level_num * 5)
                )
                db.add(sub_level)
            db.commit()
    print("Auto-seeding completed.")
