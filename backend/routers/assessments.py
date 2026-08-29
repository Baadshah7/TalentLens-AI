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
        tracks = db.query(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == d.Domain_ID
        ).all()
        for track in tracks:
            lvl1 = db.query(models.AssessmentSubLevel).filter(
                models.AssessmentSubLevel.Track_ID == track.Track_ID,
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
        
    # Level 1 of any track is always unlocked by default
    if sl.Level_Number == 1:
        return True
        
    # Check if user has explicit progress record showing unlocked
    prog = db.query(models.CandidateProgress).filter(
        models.CandidateProgress.Candidate_ID == candidate_id,
        models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
    ).first()
    if prog and prog.Is_Unlocked:
        return True
        
    # If Level N > 1: check if previous level (Level N-1) is completed
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
        
    return False


def unlock_next_sublevel(candidate_id: int, sl: models.AssessmentSubLevel, db: Session):
    track = sl.track
    if not track:
        return
        
    # Unlock Level + 1 in the same track/domain
    if sl.Level_Number < 5:
        next_sl = db.query(models.AssessmentSubLevel).filter(
            models.AssessmentSubLevel.Track_ID == track.Track_ID,
            models.AssessmentSubLevel.Level_Number == sl.Level_Number + 1
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
    
    cand_id = None
    if current_user:
        cand_id = _get_effective_candidate_id(current_user, db)
    
    for d in domains:
        sub_levels = db.query(models.AssessmentSubLevel).join(models.AssessmentTrack).filter(
            models.AssessmentTrack.Domain_ID == d.Domain_ID
        ).order_by(models.AssessmentSubLevel.Level_Number.asc()).all()
        
        comp_count = 0
        total_correct = 0
        level_scores = []
        
        for sl in sub_levels:
            is_unlocked = False
            is_completed = False
            best_score = 0.0
            best_correct = 0
            q_cnt = sl.Question_Count or 20
            
            if cand_id:
                prog = db.query(models.CandidateProgress).filter(
                    models.CandidateProgress.Candidate_ID == cand_id,
                    models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
                ).first()
                is_unlocked = is_sublevel_unlocked(cand_id, sl, db)
                if prog:
                    is_completed = prog.Is_Completed
                    best_score = prog.Best_Score_Percent or 0.0
                    best_correct = int(round((best_score / 100.0) * q_cnt))
                    if is_completed:
                        comp_count += 1
            else:
                is_unlocked = (sl.Level_Number == 1)
                
            total_correct += best_correct
            level_scores.append({
                "level": sl.Level_Number,
                "name": sl.Name,
                "best_score": best_score,
                "correct_count": best_correct,
                "total_questions": q_cnt,
                "is_completed": is_completed,
                "is_unlocked": is_unlocked
            })
            
        total_q_count = sum(sl.Question_Count or 20 for sl in sub_levels) or 100
        completion_percent = (comp_count / len(sub_levels) * 100.0) if sub_levels else 0.0
        total_score_percent = (total_correct / total_q_count * 100.0) if total_q_count > 0 else 0.0
        
        out.append({
            "Domain_ID": d.Domain_ID,
            "Name": d.Name,
            "Icon_Slug": d.Icon_Slug,
            "Description": d.Description,
            "Is_Active": d.Is_Active,
            "Completion_Percentage": completion_percent,
            "Total_Score_Correct": total_correct,
            "Total_Score_Percent": total_score_percent,
            "Max_Score_Possible": total_q_count,
            "Level_Scores": level_scores
        })
        
    return out


@router.get('/domains/{domain_id}/tracks', response_model=List[schemas.TrackResponse])
def get_domain_tracks(domain_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    domain = db.query(models.AssessmentDomain).filter(models.AssessmentDomain.Domain_ID == domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    cand_id = _get_effective_candidate_id(current_user, db) if current_user else None

    tracks = db.query(models.AssessmentTrack).filter(
        models.AssessmentTrack.Domain_ID == domain_id
    ).order_by(models.AssessmentTrack.Order_Index.asc()).all()
    
    out = []
    for t in tracks:
        sub_levels = db.query(models.AssessmentSubLevel).filter(
            models.AssessmentSubLevel.Track_ID == t.Track_ID
        ).order_by(models.AssessmentSubLevel.Level_Number.asc()).all()
        
        sl_responses = []
        total_correct = 0
        comp_count = 0
        total_q_count = 0

        for sl in sub_levels:
            is_unlocked = False
            is_completed = False
            best_score = 0.0
            best_correct = 0
            
            q_cnt = sl.Question_Count or 20
            total_q_count += q_cnt
            
            if cand_id:
                prog = db.query(models.CandidateProgress).filter(
                    models.CandidateProgress.Candidate_ID == cand_id,
                    models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
                ).first()
                is_unlocked = is_sublevel_unlocked(cand_id, sl, db)
                if prog:
                    is_completed = prog.Is_Completed
                    best_score = prog.Best_Score_Percent or 0.0
                    best_correct = int(round((best_score / 100.0) * q_cnt))
                    if is_completed:
                        comp_count += 1
            else:
                is_unlocked = (sl.Level_Number == 1)
                
            total_correct += best_correct
            
            sl_responses.append({
                "Sub_Level_ID": sl.Sub_Level_ID,
                "Track_ID": sl.Track_ID,
                "Level_Number": sl.Level_Number,
                "Name": sl.Name,
                "Question_Count": q_cnt,
                "Pass_Threshold_Percent": sl.Pass_Threshold_Percent,
                "Time_Limit_Minutes": sl.Time_Limit_Minutes,
                "Is_Unlocked": is_unlocked,
                "Is_Completed": is_completed,
                "Best_Score": best_score,
                "Best_Correct_Count": best_correct
            })
            
        total_domain_percent = (total_correct / total_q_count * 100.0) if total_q_count > 0 else 0.0

        out.append({
            "Track_ID": t.Track_ID,
            "Domain_ID": t.Domain_ID,
            "Name": t.Name,
            "Order_Index": t.Order_Index,
            "Sub_Levels": sl_responses,
            "Total_Domain_Score_Correct": total_correct,
            "Total_Domain_Score_Percent": total_domain_percent,
            "Max_Possible_Domain_Score": total_q_count,
            "Completed_Levels_Count": comp_count
        })
        
    return out


def _get_effective_candidate_id(current_user, db: Session) -> int:
    if getattr(current_user, 'Role', '') == "Candidate" and hasattr(current_user, 'Candidate_ID'):
        return current_user.Candidate_ID
    
    # For Admin or Recruiter testing, retrieve or create a linked candidate profile
    cand_email = getattr(current_user, 'Email', 'admin@talentlens.ai').strip().lower()
    candidate = db.query(models.Candidate).filter(models.Candidate.Email.ilike(cand_email)).first()
    if candidate:
        return candidate.Candidate_ID
    
    first_cand = db.query(models.Candidate).first()
    if first_cand:
        return first_cand.Candidate_ID
    
    # Fallback create
    demo = models.Candidate(
        Name=f"{getattr(current_user, 'Name', 'Admin')} (Demo)",
        Email=cand_email,
        Job_ID=1,
        Resume_File_Path="demo_resume.pdf",
        Processing_Status="Completed"
    )
    db.add(demo)
    db.commit()
    db.refresh(demo)
    return demo.Candidate_ID


def _generate_default_questions_for_sublevel(sl: models.AssessmentSubLevel, db: Session):
    """
    Generates and PERSISTS a set of default published questions for a sub-level.
    Called when a level has zero published questions (fallback seeding).
    """
    track = sl.track
    domain = track.domain if track else None
    domain_name = domain.Name if domain else "General Software"
    track_name = track.Name if track else "Beginner"
    lvl = sl.Level_Number
    
    templates = {
        "Machine Learning": [
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What is the primary purpose of cross-validation in model training?",
                "options": ["To decrease total execution speed", "To evaluate generalization and prevent overfitting", "To increase feature dimensionality", "To replace hyperparameter optimization"],
                "correct": 1,
                "exp": "Cross-validation divides datasets into folds to accurately measure generalization error on unseen data."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] Which activation function mitigates the vanishing gradient problem in deep networks?",
                "options": ["Sigmoid", "Tanh", "ReLU (Rectified Linear Unit)", "Step Function"],
                "correct": 2,
                "exp": "ReLU provides a constant gradient of 1 for positive inputs, avoiding gradient saturation common in Sigmoid/Tanh."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] In L1 regularization (Lasso), what unique effect occurs to feature coefficients?",
                "options": ["Coefficients grow exponentially", "Coefficients are driven exactly to zero for feature selection", "Coefficients equal L2 norms", "Bias term is set to infinity"],
                "correct": 1,
                "exp": "L1 penalty adds absolute values of coefficients, producing sparse models by setting irrelevant feature weights to 0."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What metric is best suited for evaluating highly imbalanced fraud detection classifiers?",
                "options": ["Standard Accuracy", "Precision-Recall AUC / F1-Score", "Mean Absolute Error", "R-Squared Score"],
                "correct": 1,
                "exp": "Accuracy is misleading on imbalanced data. PR-AUC and F1 measure true positive trade-offs without skew."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What mechanism enables Transformer models to process sequential tokens in parallel?",
                "options": ["Recurrent LSTM loops", "Multi-Head Self-Attention", "Convolutional Max-Pooling", "Random Forest Ensembles"],
                "correct": 1,
                "exp": "Self-attention computes token pairwise relationships simultaneously across matrix multiplications."
            }
        ],
        "Web Development": [
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] In React 18+, how does `useEffect` cleanup execution function upon component unmount?",
                "options": ["Runs before state updates occur", "Returns a cleanup callback executed before re-running or unmounting", "Forces synchronous DOM redraw", "Triggers automatic garbage collection"],
                "correct": 1,
                "exp": "Returning a function inside useEffect defines cleanup logic that runs before component destruction or re-renders."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] Which HTTP status code represents an unauthorized request due to missing/invalid JWT tokens?",
                "options": ["200 OK", "401 Unauthorized", "403 Forbidden", "500 Internal Server Error"],
                "correct": 1,
                "exp": "401 Unauthorized specifies that valid client authentication credentials are missing or expired."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What is the primary benefit of using CSS Grid over traditional Flexbox layout?",
                "options": ["Flexbox handles 2D matrix layouts better", "CSS Grid provides native 2D layout control (rows and columns simultaneously)", "Flexbox eliminates browser reflows", "CSS Grid disables responsive media queries"],
                "correct": 1,
                "exp": "CSS Grid is designed for two-dimensional grid layouts, whereas Flexbox is primarily one-dimensional."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What security defense prevents Cross-Site Scripting (XSS) attacks in React rendered templates?",
                "options": ["Automatic JSX string escaping", "Disabling CORS headers", "Using inline eval scripts", "Using raw innerHTML"],
                "correct": 0,
                "exp": "React automatically escapes embedded values in JSX before rendering to prevent malicious HTML injection."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What technique optimizes web performance by splitting application bundles dynamically?",
                "options": ["Server-Side Polling", "Code Splitting & Dynamic `import()`", "CSS Minification only", "WebSockets streaming"],
                "correct": 1,
                "exp": "Dynamic import statements allow bundlers like Vite/Webpack to create smaller chunks loaded on demand."
            }
        ],
        "Cybersecurity": [
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What is the primary defense against SQL Injection vulnerabilities in backend APIs?",
                "options": ["Input length truncation", "Parameterized queries / Prepared Statements", "Encrypting client passwords", "Disabling HTTPS"],
                "correct": 1,
                "exp": "Parameterized queries keep user data separate from SQL command code, preventing string execution attacks."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] In asymmetric cryptography (RSA/ECC), which key is used to decrypt data encrypted with a Public Key?",
                "options": ["The same Public Key", "The Recipient's Private Key", "A shared TLS secret", "The Sender's HMAC key"],
                "correct": 1,
                "exp": "Data encrypted with a public key can only be decrypted by the corresponding paired private key."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What security mechanism blocks unauthorized Cross-Origin API requests in web browsers?",
                "options": ["CORS (Cross-Origin Resource Sharing)", "DNSSEC", "Bcrypt hashing", "TCP Handshake"],
                "correct": 0,
                "exp": "Browser CORS enforcement restricts web applications from making domain-crossing requests without server consent."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What does the principle of Least Privilege dictate in IAM security design?",
                "options": ["Users receive full root permissions by default", "Users are granted only minimum permissions required to perform their specific tasks", "Passwords must be reset hourly", "All API routes must be public"],
                "correct": 1,
                "exp": "Least Privilege minimizes attack surfaces by restricting authorization to exact operational requirements."
            },
            {
                "text": f"[{domain_name} - {track_name} L{lvl}] What attack vector involves intercepting or modifying communication between two network nodes?",
                "options": ["Buffer Overflow", "Man-in-the-Middle (MitM)", "SQL Injection", "Distributed Denial of Service (DDoS)"],
                "correct": 1,
                "exp": "MitM attacks position the attacker in the active communication channel to eavesdrop or tamper with payload data."
            }
        ]
    }

    q_pool = templates.get(domain_name, [
        {
            "text": f"[{domain_name} - {track_name} L{lvl}] Which architectural pattern decouples core components into modular microservices?",
            "options": ["Monolithic Architecture", "Microservices Architecture", "Single Executable Binary", "Database Trigger Architecture"],
            "correct": 1,
            "exp": "Microservices decompose application domains into independently deployable, specialized services."
        },
        {
            "text": f"[{domain_name} - {track_name} L{lvl}] What key characteristic defines idempotent REST API methods like GET, PUT, and DELETE?",
            "options": ["Making multiple identical requests produces the same side effect as a single request", "Requests must fail on retry", "Requests modify database schema automatically", "Responses are never cached"],
            "correct": 0,
            "exp": "Idempotency guarantees that executing an operation repeatedly results in the same state as executing it once."
        },
        {
            "text": f"[{domain_name} - {track_name} L{lvl}] In database management, what does the ACID 'Isolation' property guarantee?",
            "options": ["Data is backed up across regions", "Concurrent transactions execute without interfering with one another", "All queries execute in under 1ms", "Disk storage is encrypted"],
            "correct": 1,
            "exp": "Isolation ensures that uncommitted transactions are invisible to other concurrent transactions."
        },
        {
            "text": f"[{domain_name} - {track_name} L{lvl}] What is the main purpose of containerization platforms like Docker?",
            "options": ["To compile code to machine binary", "To package applications with runtime dependencies in isolated environments", "To replace relational databases", "To generate frontend UI templates"],
            "correct": 1,
            "exp": "Containers encapsulate code, libraries, and runtime dependencies to guarantee consistent execution across hosts."
        },
        {
            "text": f"[{domain_name} - {track_name} L{lvl}] Which algorithm complexity represents constant-time execution regardless of input size?",
            "options": ["O(N)", "O(N log N)", "O(1)", "O(2^N)"],
            "correct": 2,
            "exp": "O(1) indicates fixed execution overhead independent of array or data structure size."
        }
    ])
    
    # Insert default published questions and commit so they are queryable
    created = []
    for item in q_pool:
        new_q = models.AssessmentQuestionNew(
            Sub_Level_ID=sl.Sub_Level_ID,
            Domain_ID=domain.Domain_ID if domain else 1,
            Question_Text=item["text"],
            Options=item["options"],
            Correct_Option_Index=item["correct"],
            Explanation=item["exp"],
            Difficulty_Tag=track_name,
            Is_Published=True
        )
        db.add(new_q)
        created.append(new_q)

    sl.Question_Count = len(created)
    try:
        db.commit()
        for q in created:
            db.refresh(q)
    except Exception as e:
        db.rollback()
        print(f"Warning: failed to persist default questions for sub-level {sl.Sub_Level_ID}: {e}")
    return created


@router.get('/sub-levels/{sub_level_id}/questions', response_model=List[schemas.QuestionNewResponse])
def get_sub_level_questions(sub_level_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    sl = db.query(models.AssessmentSubLevel).filter(models.AssessmentSubLevel.Sub_Level_ID == sub_level_id).first()
    if not sl:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    cand_id = _get_effective_candidate_id(current_user, db)
    if getattr(current_user, 'Role', '') == "Candidate":
        if not is_sublevel_unlocked(cand_id, sl, db):
            raise HTTPException(status_code=403, detail="This level is locked. Complete the prerequisite levels to unlock it.")
            
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id,
        models.AssessmentQuestionNew.Is_Published == True
    ).all()
    
    # Auto-seed default questions if level has zero published questions
    if not questions:
        questions = _generate_default_questions_for_sublevel(sl, db)

    # NOTE: Option/question shuffling is intentionally done client-side (frontend) to keep
    # original Correct_Option_Index intact for server-side grading. The frontend tracks
    # a shuffleMap and submits the original (pre-shuffle) Selected_Option_Index on submit.
    return questions


@router.post('/sub-levels/{sub_level_id}/attempts', response_model=schemas.AttemptStartResponse)
def start_sub_level_attempt(sub_level_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    sl = db.query(models.AssessmentSubLevel).filter(models.AssessmentSubLevel.Sub_Level_ID == sub_level_id).first()
    if not sl:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    cand_id = _get_effective_candidate_id(current_user, db)
    
    if getattr(current_user, 'Role', '') == "Candidate" and not is_sublevel_unlocked(cand_id, sl, db):
        raise HTTPException(status_code=403, detail="Level is locked")
        
    attempt_count = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == cand_id,
        models.AssessmentAttemptNew.Sub_Level_ID == sub_level_id
    ).count()
    
    attempt = models.AssessmentAttemptNew(
        Candidate_ID=cand_id,
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
    cand_id = _get_effective_candidate_id(current_user, db)
        
    attempt = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Attempt_ID == attempt_id,
        models.AssessmentAttemptNew.Candidate_ID == cand_id
    ).first()
    if not attempt:
        # Fallback to any attempt ID if Admin/Recruiter testing
        attempt = db.query(models.AssessmentAttemptNew).filter(
            models.AssessmentAttemptNew.Attempt_ID == attempt_id
        ).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt session not found")
        
    if attempt.Submitted_At:
        raise HTTPException(status_code=400, detail="This attempt session was already submitted")
        
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == attempt.Sub_Level_ID,
        models.AssessmentQuestionNew.Is_Published == True
    ).all()
    if not questions:
        sl = attempt.sub_level
        if sl:
            questions = _generate_default_questions_for_sublevel(sl, db)
    
    correct_count = 0
    incorrect_count = 0
    skipped_count = 0
    
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
        models.CandidateProgress.Candidate_ID == cand_id,
        models.CandidateProgress.Sub_Level_ID == sl.Sub_Level_ID
    ).first()
    
    if not prog:
        prog = models.CandidateProgress(
            Candidate_ID=cand_id,
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
        unlock_next_sublevel(cand_id, sl, db)
        
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

    # Calculate daily streak from consecutive activity days in submitted attempts
    streak = 0
    submitted_attempts = db.query(models.AssessmentAttemptNew).filter(
        models.AssessmentAttemptNew.Candidate_ID == current_user.Candidate_ID,
        models.AssessmentAttemptNew.Submitted_At != None
    ).order_by(models.AssessmentAttemptNew.Submitted_At.desc()).all()

    if submitted_attempts:
        today = datetime.datetime.utcnow().date()
        last_attempt_date = submitted_attempts[0].Submitted_At.date()
        # Streak is active if the last attempt was today or yesterday
        if (today - last_attempt_date).days <= 1:
            streak = 1
            seen_dates = {last_attempt_date}
            prev_date = last_attempt_date
            for attempt in submitted_attempts[1:]:
                attempt_date = attempt.Submitted_At.date()
                if attempt_date in seen_dates:
                    continue
                seen_dates.add(attempt_date)
                if (prev_date - attempt_date).days == 1:
                    streak += 1
                    prev_date = attempt_date
                else:
                    break

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
    auto_publish: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    sl_val = db.query(models.AssessmentSubLevel).filter(
        models.AssessmentSubLevel.Sub_Level_ID == sub_level_id
    ).first()
    if not sl_val:
        raise HTTPException(status_code=404, detail="SubLevel not found")
        
    track = sl_val.track
    domain = track.domain if track else None
    
    domain_name = domain.Name if domain else "General"
    difficulty = track.Name if track else "Beginner"
    level_num = sl_val.Level_Number
    
    system_prompt = (
        "You are an expert technical interviewer. You must generate exactly 20 multiple-choice questions (MCQs) for the "
        f"domain '{domain_name}' at Level {level_num}/5.\n"
        "Level 1-2: fundamental/definitional questions (easy to medium).\n"
        "Level 3: applied/scenario-based questions (medium).\n"
        "Level 4-5: deep/edge-case/architecture-level questions (hard).\n"
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
    
    user_prompt = f"Generate exactly 20 MCQs for {domain_name} (Level {level_num}/5)."
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    final_list = []
    
    if not api_key:
        print("ANTHROPIC_API_KEY environment variable not set. Generating mock questions...")
        for i in range(1, 21):
            final_list.append({
                "Question_Text": f"Mock Question {i}: What is the primary characteristic of {domain_name} at Level {level_num}?",
                "Options": [
                    f"Option A - Foundational concept for {domain_name}",
                    f"Option B - Secondary concept for Level {level_num}",
                    f"Option C - Architectural consideration",
                    f"Option D - None of the above"
                ],
                "Correct_Option_Index": random.randint(0, 3),
                "Explanation": f"This is a mock explanation for Question {i} because ANTHROPIC_API_KEY is not set."
            })
    else:
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
                
                if len(questions_list) < 20:
                    raise ValueError(f"Returned only {len(questions_list)} questions instead of 20")
                    
                for q in questions_list[:20]:
                    final_list.append({
                        "Question_Text": q["question_text"],
                        "Options": q["options"],
                        "Correct_Option_Index": q["correct_option_index"],
                        "Explanation": q.get("explanation", "")
                    })
        except Exception as e:
            print(f"Failed to generate questions: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Question generation failed: {str(e)}. Please retry or verify your Claude API key."
            )
            
    # Auto-publish or Draft database persistence
    try:
        if auto_publish:
            # Delete previous draft & published questions
            db.query(models.AssessmentQuestionNew).filter(
                models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id
            ).delete()
            for q in final_list:
                new_q = models.AssessmentQuestionNew(
                    Sub_Level_ID=sub_level_id,
                    Domain_ID=domain.Domain_ID if domain else 1,
                    Question_Text=q["Question_Text"],
                    Options=q["Options"],
                    Correct_Option_Index=q["Correct_Option_Index"],
                    Explanation=q["Explanation"],
                    Difficulty_Tag=track.Name if track else "Beginner",
                    Is_Published=True
                )
                db.add(new_q)
        else:
            # Delete draft questions only
            db.query(models.AssessmentQuestionNew).filter(
                models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id,
                models.AssessmentQuestionNew.Is_Published == False
            ).delete()
            for q in final_list:
                new_q = models.AssessmentQuestionNew(
                    Sub_Level_ID=sub_level_id,
                    Domain_ID=domain.Domain_ID if domain else 1,
                    Question_Text=q["Question_Text"],
                    Options=q["Options"],
                    Correct_Option_Index=q["Correct_Option_Index"],
                    Explanation=q["Explanation"],
                    Difficulty_Tag=track.Name if track else "Beginner",
                    Is_Published=False
                )
                db.add(new_q)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")

    return {"Questions": final_list}


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
        
    if len(payload.Questions) < 1:
        raise HTTPException(status_code=400, detail="A level must contain at least 1 question to be published")
        
    try:
        # Delete previous draft & published questions for this sublevel
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
                Difficulty_Tag=track.Name,
                Is_Published=True
            )
            db.add(new_q)
            
        sl.Question_Count = len(payload.Questions)
        db.commit()
        return {"message": f"Successfully published {len(payload.Questions)} questions to {domain.Name} - {track.Name} - Level {sl.Level_Number}."}
        
    except Exception as e:
        db.rollback()
        print(f"Failed to publish questions: {e}")
        raise HTTPException(status_code=500, detail=f"Database commit failed: {str(e)}")


@router.post('/admin/seed-all-questions')
def seed_all_domain_questions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    sub_levels = db.query(models.AssessmentSubLevel).all()
    count_seeded = 0
    for sl in sub_levels:
        pub_count = db.query(models.AssessmentQuestionNew).filter(
            models.AssessmentQuestionNew.Sub_Level_ID == sl.Sub_Level_ID,
            models.AssessmentQuestionNew.Is_Published == True
        ).count()
        if pub_count == 0:
            _generate_default_questions_for_sublevel(sl, db)
            count_seeded += 1
            
    return {"message": f"Successfully seeded/published question banks for {count_seeded} assessment levels across all domains."}


@router.get('/admin/sub-levels/{sub_level_id}/questions', response_model=schemas.QuestionNewAdminList)
def get_admin_sub_level_questions(
    sub_level_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    # Retrieve draft questions if available, otherwise live published questions
    questions = db.query(models.AssessmentQuestionNew).filter(
        models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id,
        models.AssessmentQuestionNew.Is_Published == False
    ).all()
    
    if not questions:
        questions = db.query(models.AssessmentQuestionNew).filter(
            models.AssessmentQuestionNew.Sub_Level_ID == sub_level_id,
            models.AssessmentQuestionNew.Is_Published == True
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


@router.get('/admin/domain-stats')
def get_admin_domain_stats(db: Session = Depends(get_db), current_user = Depends(get_current_admin)):
    """
    Returns rich per-domain analytics for the admin assessment dashboard.
    Includes question bank health, attempt stats, pass rates, and candidate engagement.
    """
    domains = db.query(models.AssessmentDomain).all()
    out = []

    for d in domains:
        sub_levels = (
            db.query(models.AssessmentSubLevel)
            .join(models.AssessmentTrack)
            .filter(models.AssessmentTrack.Domain_ID == d.Domain_ID)
            .order_by(models.AssessmentSubLevel.Level_Number.asc())
            .all()
        )

        levels_data = []
        total_attempts = 0
        total_passed = 0
        total_unique_candidates = set()

        for sl in sub_levels:
            pub_count = db.query(models.AssessmentQuestionNew).filter(
                models.AssessmentQuestionNew.Sub_Level_ID == sl.Sub_Level_ID,
                models.AssessmentQuestionNew.Is_Published == True
            ).count()

            attempts = db.query(models.AssessmentAttemptNew).filter(
                models.AssessmentAttemptNew.Sub_Level_ID == sl.Sub_Level_ID,
                models.AssessmentAttemptNew.Submitted_At != None
            ).all()

            attempt_count = len(attempts)
            passed_count = sum(1 for a in attempts if a.Is_Passed)
            unique_cands = set(a.Candidate_ID for a in attempts)
            total_unique_candidates.update(unique_cands)

            avg_score = 0.0
            if attempts:
                scores = [a.Score_Percent for a in attempts if a.Score_Percent is not None]
                avg_score = sum(scores) / len(scores) if scores else 0.0

            total_attempts += attempt_count
            total_passed += passed_count

            levels_data.append({
                "Sub_Level_ID": sl.Sub_Level_ID,
                "Level_Number": sl.Level_Number,
                "Level_Name": sl.Name,
                "Question_Count": pub_count,
                "Attempt_Count": attempt_count,
                "Passed_Count": passed_count,
                "Pass_Rate": round((passed_count / attempt_count * 100) if attempt_count > 0 else 0.0, 1),
                "Avg_Score": round(avg_score, 1),
                "Unique_Candidates": len(unique_cands),
                "Is_Live": pub_count > 0,
            })

        overall_pass_rate = round((total_passed / total_attempts * 100) if total_attempts > 0 else 0.0, 1)
        levels_live = sum(1 for lv in levels_data if lv["Is_Live"])

        out.append({
            "Domain_ID": d.Domain_ID,
            "Domain_Name": d.Name,
            "Icon_Slug": d.Icon_Slug,
            "Description": d.Description,
            "Is_Active": d.Is_Active,
            "Total_Levels": len(sub_levels),
            "Levels_Live": levels_live,
            "Total_Attempts": total_attempts,
            "Total_Passed": total_passed,
            "Overall_Pass_Rate": overall_pass_rate,
            "Unique_Candidates": len(total_unique_candidates),
            "Levels": levels_data,
        })

    return out


@router.get('/admin/sub-levels-status')
def get_sub_levels_status(db: Session = Depends(get_db), current_user = Depends(get_current_admin)):
    domains = db.query(models.AssessmentDomain).all()
    out = []
    for d in domains:
        for t in d.tracks:
            for sl in t.sub_levels:
                pub_count = db.query(models.AssessmentQuestionNew).filter(
                    models.AssessmentQuestionNew.Sub_Level_ID == sl.Sub_Level_ID,
                    models.AssessmentQuestionNew.Is_Published == True
                ).count()
                
                draft_count = db.query(models.AssessmentQuestionNew).filter(
                    models.AssessmentQuestionNew.Sub_Level_ID == sl.Sub_Level_ID,
                    models.AssessmentQuestionNew.Is_Published == False
                ).count()
                
                out.append({
                    "Sub_Level_ID": sl.Sub_Level_ID,
                    "Domain_ID": d.Domain_ID,
                    "Domain_Name": d.Name,
                    "Track_Name": t.Name,
                    "Level_Number": sl.Level_Number,
                    "Level_Name": sl.Name,
                    "Question_Count": pub_count,
                    "Draft_Count": draft_count
                })
    return out



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
    
    level_names = {
        1: "Level 1: Fundamentals",
        2: "Level 2: Intermediate",
        3: "Level 3: Applied Scenarios",
        4: "Level 4: Advanced Architecture",
        5: "Level 5: Master Case Studies"
    }

    print("Auto-seeding default assessment domains, core tracks, and sublevels (20Q/level, 60% pass)...")
    for d in domains_data:
        domain = models.AssessmentDomain(Name=d["name"], Icon_Slug=d["icon"], Description=d["desc"])
        db.add(domain)
        db.commit()
        db.refresh(domain)
        
        # Single Core Track per domain — 5 sequential levels with 20 questions each
        track = models.AssessmentTrack(Domain_ID=domain.Domain_ID, Name="Core Track", Order_Index=0)
        db.add(track)
        db.commit()
        db.refresh(track)
        
        for level_num in range(1, 6):
            sub_level = models.AssessmentSubLevel(
                Track_ID=track.Track_ID,
                Level_Number=level_num,
                Name=level_names[level_num],
                Question_Count=20,
                Pass_Threshold_Percent=60.0,
                Time_Limit_Minutes=20
            )
            db.add(sub_level)
        db.commit()
    print("Auto-seeding completed: 7 domains x 1 Core Track x 5 Levels x 20Q.")
