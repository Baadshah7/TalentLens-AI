import os
import shutil
import docx
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from dependencies import get_current_user, get_current_admin
from utils import log_action
from parser import parse_resume_full, extract_name_from_filename, check_file_corrupted
from scoring import score_candidate

router = APIRouter(prefix="/candidates", tags=["candidates"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

def check_file_signature(file_path: str, ext: str) -> bool:
    """Verifies file magic headers to prevent disguised uploads (e.g. EXE renamed to PDF)."""
    try:
        with open(file_path, "rb") as f:
            header = f.read(4)
        if ext == ".pdf":
            return header.startswith(b"%PDF")
        elif ext == ".docx":
            return header.startswith(b"PK\x03\x04")
        elif ext == ".txt":
            # Just verify it's readable text
            with open(file_path, "r", encoding="utf-8", errors="strict") as tf:
                _ = tf.read(512)
            return True
    except Exception:
        return False
    return True

def save_parsed_resume_to_db(candidate: models.Candidate, parsed_data: dict, db: Session):
    """Saves all parsed resume subcomponents into candidate relational tables."""
    # Update candidate base details
    if parsed_data.get("Name"):
        candidate.Name = parsed_data["Name"]
    if parsed_data.get("Email"):
        candidate.Email = parsed_data["Email"]
    if parsed_data.get("Phone"):
        candidate.Phone = parsed_data["Phone"]
    if parsed_data.get("Location"):
        candidate.Location = parsed_data["Location"]
        
    db.commit()

    # 1. Save Skills
    for sk in parsed_data.get("skills", []):
        skill_entry = models.CandidateSkill(
            Candidate_ID=candidate.Candidate_ID,
            Skill=sk["Skill"],
            Skill_Level=sk["Skill_Level"],
            Evidence_Text=sk["Evidence_Text"]
        )
        db.add(skill_entry)
        
    # 2. Save Experience
    for ex in parsed_data.get("experiences", []):
        exp_entry = models.CandidateExperience(
            Candidate_ID=candidate.Candidate_ID,
            Company=ex["Company"],
            Role=ex["Role"],
            Duration_Months=ex["Duration_Months"],
            Description=ex["Description"],
            Is_Relevant=ex["Is_Relevant"]
        )
        db.add(exp_entry)
        
    # 3. Save Education
    for ed in parsed_data.get("educations", []):
        edu_entry = models.CandidateEducation(
            Candidate_ID=candidate.Candidate_ID,
            Degree=ed["Degree"],
            Institution=ed["Institution"],
            Graduation_Year=ed["Graduation_Year"]
        )
        db.add(edu_entry)
        
    # 4. Save Projects
    for pr in parsed_data.get("projects", []):
        proj_entry = models.CandidateProject(
            Candidate_ID=candidate.Candidate_ID,
            Project_Name=pr["Project_Name"],
            Technologies=pr["Technologies"],
            Description=pr["Description"]
        )
        db.add(proj_entry)
        
    # 5. Save Certifications
    for cr in parsed_data.get("certifications", []):
        cert_entry = models.CandidateCertification(
            Candidate_ID=candidate.Candidate_ID,
            Certification_Name=cr["Certification_Name"],
            Issuing_Org=cr["Issuing_Org"]
        )
        db.add(cert_entry)
        
    db.commit()

@router.post("/upload/{job_id}")
def upload_resumes(
    job_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify job exists
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Target job description not found")

    # Secure uploads directory outside public web root
    upload_dir = os.path.join("uploads", str(job_id))
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    
    for file in files:
        filename = file.filename
        _, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        # 1. Validate file extension
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": filename,
                "status": "Rejected",
                "error": f"Invalid file type. Only PDF, DOCX, and TXT are allowed."
            })
            continue

        # 2. Save temporary contents to check size (Enforces max 10MB limit)
        file_path = os.path.join(upload_dir, filename)
        
        try:
            size = 0
            is_oversized = False
            with open(file_path, "wb") as buffer:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_FILE_SIZE:
                        is_oversized = True
                        break
                    buffer.write(chunk)
            
            if is_oversized:
                if os.path.exists(file_path):
                    os.remove(file_path)
                results.append({
                    "filename": filename,
                    "status": "Rejected",
                    "error": "File size exceeds the maximum limit of 10MB."
                })
                continue
                
            # 3. Check file signature header check
            is_valid_header = check_file_signature(file_path, ext)
            is_corrupted = check_file_corrupted(file_path, ext) or not is_valid_header
            processing_status = "Failed" if is_corrupted else "Pending"
            
            # Extract candidate name from filename (initial fallback)
            candidate_name = extract_name_from_filename(filename)
            
            # 4. Insert candidate row
            candidate = models.Candidate(
                Name=candidate_name,
                Email=None,
                Phone=None,
                Location=None,
                Resume_File_Path=file_path,
                Processing_Status=processing_status,
                Job_ID=job_id
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)

            # 5. NLP Parsing & Similarity Evaluation
            overall_score = 0.0
            error_details = None
            
            if not is_corrupted:
                try:
                    # Run full parser
                    parsed_data = parse_resume_full(file_path, filename)
                    
                    # Store relational data
                    save_parsed_resume_to_db(candidate, parsed_data, db)
                    
                    # Update status
                    candidate.Processing_Status = "Parsed"
                    db.commit()
                    
                    # Trigger Scoring Engine
                    score_res = score_candidate(candidate.Candidate_ID, job_id, db)
                    overall_score = score_res.Overall_Score
                    
                except Exception as parse_err:
                    print(f"Failed parsing/scoring candidate {candidate.Candidate_ID}: {parse_err}")
                    candidate.Processing_Status = "Failed"
                    db.commit()
                    is_corrupted = True
                    error_details = f"Parsing failure: {str(parse_err)}"
            else:
                error_details = "File magic number signature mismatch or corrupted structure."

            # Log to Audit log
            details = f"Processed resume '{filename}' for job ID {job_id}. Overall Match Score: {overall_score}%."
            if is_corrupted:
                details += f" FAILED: {error_details}"
            else:
                details += " SUCCESS."
                
            log_action(
                db, 
                user_id=current_user.User_ID, 
                action="Candidate Processing", 
                details=details
            )

            results.append({
                "candidate_id": candidate.Candidate_ID,
                "filename": filename,
                "candidate_name": candidate.Name,
                "status": "Uploaded",
                "processing_status": candidate.Processing_Status,
                "overall_score": overall_score,
                "error": error_details
            })

        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            results.append({
                "filename": filename,
                "status": "Rejected",
                "error": f"Internal processing error: {str(e)}"
            })

    return {"results": results}

@router.get("/job/{job_id}", response_model=List[schemas.CandidateResponse])
def get_candidates_by_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    candidates = db.query(models.Candidate).filter(models.Candidate.Job_ID == job_id).all()
    
    response_list = []
    for c in candidates:
        res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == c.Candidate_ID).first()
        score = res.Overall_Score if res else None
        decision = c.recruiter_decision.Decision if c.recruiter_decision else None
        
        is_blind = job.Blind_Mode and not c.Is_Identity_Revealed
        response_list.append({
            "Candidate_ID": c.Candidate_ID,
            "Name": f"Candidate #{c.Candidate_ID}" if is_blind else c.Name,
            "Email": "[HIDDEN]" if is_blind else c.Email,
            "Phone": "[HIDDEN]" if is_blind else c.Phone,
            "Location": "[HIDDEN]" if is_blind else c.Location,
            "Resume_File_Path": c.Resume_File_Path,
            "Upload_Date": c.Upload_Date,
            "Processing_Status": c.Processing_Status,
            "Job_ID": c.Job_ID,
            "Overall_Score": score,
            "Is_Identity_Revealed": c.Is_Identity_Revealed,
            "Decision": decision
        })
    return response_list

@router.get("/{candidate_id}/detail", response_model=schemas.CandidateDetailResponse)
def get_candidate_details(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    job = db.query(models.Job).filter(models.Job.Job_ID == candidate.Job_ID).first()
    is_blind = job.Blind_Mode and not candidate.Is_Identity_Revealed

    return {
        "Candidate_ID": candidate.Candidate_ID,
        "Name": f"Candidate #{candidate.Candidate_ID}" if is_blind else candidate.Name,
        "Email": "[HIDDEN]" if is_blind else candidate.Email,
        "Phone": "[HIDDEN]" if is_blind else candidate.Phone,
        "Location": "[HIDDEN]" if is_blind else candidate.Location,
        "Resume_File_Path": candidate.Resume_File_Path,
        "Upload_Date": candidate.Upload_Date,
        "Processing_Status": candidate.Processing_Status,
        "Job_ID": candidate.Job_ID,
        "Is_Identity_Revealed": candidate.Is_Identity_Revealed,
        "skills": candidate.skills,
        "experiences": candidate.experiences,
        "educations": candidate.educations,
        "projects": candidate.projects,
        "certifications": candidate.certifications,
        "screening_results": candidate.screening_results,
        "recruiter_decision": candidate.recruiter_decision
    }

@router.post("/{candidate_id}/rescore", response_model=schemas.ScreeningResultResponse)
def rescore_candidate_endpoint(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    try:
        score_res = score_candidate(candidate_id, candidate.Job_ID, db)
        
        # Log to Audit Log
        log_action(
            db, 
            user_id=current_user.User_ID, 
            action="Candidate Rescored", 
            details=f"Recruiter rescored candidate '{candidate.Name}' (ID: {candidate_id}). New score: {score_res.Overall_Score}%."
        )
        
        return score_res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Re-scoring operation failed: {str(e)}"
        )

@router.post("/{candidate_id}/reveal", response_model=schemas.CandidateDetailResponse)
def reveal_candidate_identity(
    candidate_id: int,
    request: schemas.RevealRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    candidate.Is_Identity_Revealed = True
    db.commit()
    db.refresh(candidate)
    
    # Log reveal action with reason
    details = f"Recruiter revealed identity of Candidate #{candidate_id} ('{candidate.Name}'). Reason: {request.Reason}"
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Candidate Identity Revealed",
        details=details
    )
    
    return {
        "Candidate_ID": candidate.Candidate_ID,
        "Name": candidate.Name,
        "Email": candidate.Email,
        "Phone": candidate.Phone,
        "Location": candidate.Location,
        "Resume_File_Path": candidate.Resume_File_Path,
        "Upload_Date": candidate.Upload_Date,
        "Processing_Status": candidate.Processing_Status,
        "Job_ID": candidate.Job_ID,
        "Is_Identity_Revealed": candidate.Is_Identity_Revealed,
        "skills": candidate.skills,
        "experiences": candidate.experiences,
        "educations": candidate.educations,
        "projects": candidate.projects,
        "certifications": candidate.certifications,
        "screening_results": candidate.screening_results,
        "recruiter_decision": candidate.recruiter_decision
    }

# Phase 4 Download Endpoint (Authenticated)
@router.get("/{candidate_id}/download")
def download_resume(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    file_path = candidate.Resume_File_Path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file not found on disk")
        
    return FileResponse(
        path=file_path,
        filename=os.path.basename(file_path),
        media_type="application/octet-stream"
    )

# Phase 4 Admin Data Deletion
@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)  # Strictly Admin-only
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    # Delete resume file from disk
    file_path = candidate.Resume_File_Path
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Failed deleting file {file_path}: {e}")
            
    candidate_name = candidate.Name
    db.delete(candidate)
    db.commit()
    
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Candidate Deleted",
        details=f"Admin permanently deleted candidate '{candidate_name}' (ID: {candidate_id}) and all extracted metadata."
    )
    
    return {"message": f"Candidate {candidate_id} permanently deleted successfully"}

# Phase 4 Recruiter Review Decision
@router.post("/{candidate_id}/decision", response_model=schemas.RecruiterDecisionResponse)
def submit_recruiter_decision(
    candidate_id: int,
    decision_data: schemas.RecruiterDecisionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    score_res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == candidate_id).first()
    ai_recommendation = "Low Match"
    if score_res and score_res.Explanation:
        ai_recommendation = score_res.Explanation.get("recommendation", "Low Match")
        
    # Validate AI Recommendations conflict
    new_dec = decision_data.Decision
    is_conflict = False
    if ai_recommendation == "Low Match" and new_dec in {"Shortlist", "Interview", "Select"}:
        is_conflict = True
    elif ai_recommendation == "Strong Match" and new_dec == "Reject":
        is_conflict = True
        
    if is_conflict and (not decision_data.Reason or len(decision_data.Reason.strip()) < 3):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Conflict detected: Recruiter decision ({new_dec}) contradicts AI recommendation ({ai_recommendation}). A mandatory reason must be provided."
        )

    # Overwrite decision (if exists) or create new
    decision = db.query(models.RecruiterDecision).filter(models.RecruiterDecision.Candidate_ID == candidate_id).first()
    
    old_decision = "None"
    if decision:
        old_decision = decision.Decision
        decision.Decision = new_dec
        decision.Reason = decision_data.Reason
        decision.Recruiter_ID = current_user.User_ID
        import datetime
        decision.Timestamp = datetime.datetime.utcnow()
    else:
        decision = models.RecruiterDecision(
            Candidate_ID=candidate_id,
            Recruiter_ID=current_user.User_ID,
            Decision=new_dec,
            Reason=decision_data.Reason
        )
        db.add(decision)
        
    db.commit()
    db.refresh(decision)
    
    # Audit log trail showing transition
    details = f"Recruiter changed Candidate #{candidate_id} ({candidate.Name}) decision from '{old_decision}' to '{new_dec}' (AI Recommendation was: {ai_recommendation})."
    if decision_data.Reason:
        details += f" Reason: {decision_data.Reason}"
        
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Candidate Decision",
        details=details
    )
    
    return decision
