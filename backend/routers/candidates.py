import os
import shutil
import docx
import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from dependencies import get_current_user
from utils import log_action
from parser import parse_resume_full, extract_name_from_filename, check_file_corrupted
from scoring import score_candidate

router = APIRouter(prefix="/candidates", tags=["candidates"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

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

    upload_dir = os.path.join("uploads", str(job_id))
    os.makedirs(upload_dir, exist_ok=True)

    results = []
    
    for file in files:
        filename = file.filename
        _, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        # 1. Validate extension
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": filename,
                "status": "Rejected",
                "error": f"Invalid file type. Only PDF, DOCX, and TXT are allowed."
            })
            continue

        # 2. Save temporary contents to check size
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
                
            # 3. Check for file corruption
            is_corrupted = check_file_corrupted(file_path, ext)
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
                error_details = "File structure is corrupted or unreadable."

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
    for c in candidates:
        res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == c.Candidate_ID).first()
        c.Overall_Score = res.Overall_Score if res else None
    return candidates

@router.get("/{candidate_id}/detail", response_model=schemas.CandidateDetailResponse)
def get_candidate_details(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    return candidate

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
