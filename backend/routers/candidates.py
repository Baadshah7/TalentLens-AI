import os
import shutil
import docx
import pdfplumber
import io
import csv
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func, and_, or_
from typing import List, Optional
from database import get_db
import models
import schemas
from dependencies import get_current_user, get_current_admin
from utils import log_action
from parser import parse_resume_full, extract_name_from_filename, check_file_corrupted
from scoring import score_candidate

# ReportLab imports for PDF Generation
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

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
            with open(file_path, "r", encoding="utf-8", errors="strict") as tf:
                _ = tf.read(512)
            return True
    except Exception:
        return False
    return True

def save_parsed_resume_to_db(candidate: models.Candidate, parsed_data: dict, db: Session):
    """Saves all parsed resume subcomponents into candidate relational tables."""
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
        
        if ext not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": filename,
                "status": "Rejected",
                "error": f"Invalid file type. Only PDF, DOCX, and TXT are allowed."
            })
            continue

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
                
            is_valid_header = check_file_signature(file_path, ext)
            is_corrupted = check_file_corrupted(file_path, ext) or not is_valid_header
            processing_status = "Failed" if is_corrupted else "Pending"
            
            candidate_name = extract_name_from_filename(filename)
            
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

            overall_score = 0.0
            error_details = None
            
            if not is_corrupted:
                try:
                    parsed_data = parse_resume_full(file_path, filename)
                    save_parsed_resume_to_db(candidate, parsed_data, db)
                    
                    candidate.Processing_Status = "Parsed"
                    db.commit()
                    
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
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    recommendation: Optional[str] = None,
    skills: Optional[str] = None,
    decision_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
        
    # Construct base query joining relational subscores & decisions for filtering (Phase 5)
    query = db.query(models.Candidate).filter(models.Candidate.Job_ID == job_id)
    query = query.outerjoin(models.ScreeningResult, models.Candidate.Candidate_ID == models.ScreeningResult.Candidate_ID)
    query = query.outerjoin(models.RecruiterDecision, models.Candidate.Candidate_ID == models.RecruiterDecision.Candidate_ID)

    # 1. Filter Score Range
    if min_score is not None:
        query = query.filter(models.ScreeningResult.Overall_Score >= min_score)
    if max_score is not None:
        query = query.filter(models.ScreeningResult.Overall_Score <= max_score)

    # 2. Filter Recommendation Category
    if recommendation:
        recs = [r.strip() for r in recommendation.split(",") if r.strip()]
        if recs:
            query = query.filter(models.ScreeningResult.Explanation['recommendation'].as_string().in_(recs))

    # 3. Filter Specific Skill Keywords
    if skills:
        skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
        if skill_list:
            query = query.filter(models.Candidate.skills.any(func.lower(models.CandidateSkill.Skill).in_(skill_list)))

    # 4. Filter Recruiter Decision
    if decision_status:
        statuses = [ds.strip() for ds in decision_status.split(",") if ds.strip()]
        if statuses:
            clauses = []
            if "No Decision" in statuses:
                clauses.append(models.RecruiterDecision.Decision == None)
            filtered_decisions = [s for s in statuses if s != "No Decision"]
            if filtered_decisions:
                clauses.append(models.RecruiterDecision.Decision.in_(filtered_decisions))
            query = query.filter(or_(*clauses))

    candidates = query.all()
    
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
    
    # Pre-load interviews list for detailed response serialization
    itvs = db.query(models.Interview).filter(models.Interview.Candidate_ID == candidate_id).all()
    itv_responses = []
    for i in itvs:
        itv_responses.append({
            "Interview_ID": i.Interview_ID,
            "Candidate_ID": i.Candidate_ID,
            "Job_ID": i.Job_ID,
            "Scheduled_By": i.Scheduled_By,
            "Interview_DateTime": i.Interview_DateTime,
            "Mode": i.Mode,
            "Notes": i.Notes,
            "Status": i.Status,
            "Created_At": i.Created_At,
            "Candidate_Name": f"Candidate #{candidate_id}" if is_blind else candidate.Name,
            "Job_Title": job.Job_Title if job else "Unknown"
        })

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
        "recruiter_decision": candidate.recruiter_decision,
        "interviews": itv_responses
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
    
    details = f"Recruiter revealed identity of Candidate #{candidate_id} ('{candidate.Name}'). Reason: {request.Reason}"
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Candidate Identity Revealed",
        details=details
    )
    
    return get_candidate_details(candidate_id, db, current_user)

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

@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
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

    # Overwrite decision or create new
    decision = db.query(models.RecruiterDecision).filter(models.RecruiterDecision.Candidate_ID == candidate_id).first()
    
    old_decision = "None"
    if decision:
        old_decision = decision.Decision
        decision.Decision = new_dec
        decision.Reason = decision_data.Reason
        decision.Recruiter_ID = current_user.User_ID
        decision.Timestamp = datetime.utcnow()
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

    # Audit details
    details = f"Recruiter changed Candidate #{candidate_id} ({candidate.Name}) decision from '{old_decision}' to '{new_dec}' (AI Recommendation: {ai_recommendation})."
    if decision_data.Reason:
        details += f" Reason: {decision_data.Reason}"
        
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Candidate Decision",
        details=details
    )

    # Phase 5: Create Interview record if status is Interview
    if new_dec == "Interview":
        if not decision_data.Interview_DateTime or not decision_data.Mode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workflow error: Decision set to 'Interview' but scheduling 'Interview_DateTime' or 'Mode' are missing."
            )
        
        # Schedule the interview session
        interview = models.Interview(
            Candidate_ID=candidate_id,
            Job_ID=candidate.Job_ID,
            Scheduled_By=current_user.User_ID,
            Interview_DateTime=decision_data.Interview_DateTime,
            Mode=decision_data.Mode,
            Notes=decision_data.Notes,
            Status="Scheduled"
        )
        db.add(interview)
        db.commit()

        log_action(
            db,
            user_id=current_user.User_ID,
            action="Interview Scheduled",
            details=f"Scheduled {interview.Mode} interview for Candidate #{candidate_id} on {interview.Interview_DateTime}."
        )
    
    return decision

@router.post("/bulk-decision")
def submit_bulk_decisions(
    request: schemas.BulkDecisionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Applies bulk recruiter reviews across a selected list of candidates, validating conflicts batch-wise."""
    candidates = db.query(models.Candidate).filter(models.Candidate.Candidate_ID.in_(request.Candidate_IDs)).all()
    if len(candidates) != len(request.Candidate_IDs):
        raise HTTPException(status_code=404, detail="One or more selected Candidate IDs were not found in database.")

    conflicting_ids = []
    unscored_candidate_ids = []
    for c in candidates:
        res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == c.Candidate_ID).first()
        
        # Skip conflict checking for candidates with Processing_Status != "Parsed" (unscored or failed) or missing screening result/explanation
        if c.Processing_Status != "Parsed" or not res or not res.Explanation or "recommendation" not in res.Explanation:
            unscored_candidate_ids.append(c.Candidate_ID)
            continue
            
        ai_recommendation = res.Explanation.get("recommendation", "Low Match")
        
        is_conflict = False
        if ai_recommendation == "Low Match" and request.Decision in {"Shortlist", "Interview", "Select"}:
            is_conflict = True
        elif ai_recommendation == "Strong Match" and request.Decision == "Reject":
            is_conflict = True
            
        if is_conflict:
            conflicting_ids.append(f"Candidate #{c.Candidate_ID} ('{c.Name}')")

    if conflicting_ids and (not request.Reason or len(request.Reason.strip()) < 3):
        violators = ", ".join(conflicting_ids)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk override conflict: Recruiter decision ({request.Decision}) contradicts AI recommendations for: {violators}. A mandatory reason is required."
        )

    current_candidate = None
    try:
        # Perform updates stage-wise, committing only once at the end for transactional atomicity
        for c in candidates:
            current_candidate = c
            decision = db.query(models.RecruiterDecision).filter(models.RecruiterDecision.Candidate_ID == c.Candidate_ID).first()
            old_dec = "None"
            if decision:
                old_dec = decision.Decision
                decision.Decision = request.Decision
                decision.Reason = request.Reason
                decision.Recruiter_ID = current_user.User_ID
                decision.Timestamp = datetime.utcnow()
            else:
                decision = models.RecruiterDecision(
                    Candidate_ID=c.Candidate_ID,
                    Recruiter_ID=current_user.User_ID,
                    Decision=request.Decision,
                    Reason=request.Reason
                )
                db.add(decision)
            
            db.flush()

            details = f"Bulk Recruiter changed Candidate #{c.Candidate_ID} ({c.Name}) decision from '{old_dec}' to '{request.Decision}'."
            if request.Reason:
                details += f" Reason: {request.Reason}"
                
            log_action(db, user_id=current_user.User_ID, action="Candidate Decision", details=details)
            
        db.commit()
    except Exception as e:
        db.rollback()
        fail_cand = f"Candidate #{current_candidate.Candidate_ID} ('{current_candidate.Name}')" if current_candidate else "Unknown"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk update failed. Entire transaction rolled back. Error occurred while processing {fail_cand}: {str(e)}"
        )

    msg = f"Successfully updated recruiter decision to '{request.Decision}' for {len(candidates)} candidates."
    if unscored_candidate_ids:
        msg += f" Note: Candidate IDs {unscored_candidate_ids} were not yet scored; decisions applied without conflict check."
    return {"message": msg}

@router.get("/{candidate_id}/export-pdf")
def export_candidate_pdf(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Generates structured PDF candidate evaluations dynamically, respecting active Blind Mode redactions."""
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    job = db.query(models.Job).filter(models.Job.Job_ID == candidate.Job_ID).first()
    res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == candidate_id).first()
    dec = candidate.recruiter_decision
    itvs = db.query(models.Interview).filter(models.Interview.Candidate_ID == candidate_id).all()
    
    is_blind = job.Blind_Mode and not candidate.Is_Identity_Revealed if job else False
    name = f"Candidate #{candidate_id}" if is_blind else candidate.Name
    email = "[HIDDEN]" if is_blind else (candidate.Email or "Not Extracted")
    phone = "[HIDDEN]" if is_blind else (candidate.Phone or "Not Extracted")
    location = "[HIDDEN]" if is_blind else (candidate.Location or "Not Extracted")
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=12
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=20
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#334155'),
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#475569')
    )
    
    bold_body_style = ParagraphStyle(
        'BoldBodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    
    story = []
    
    story.append(Paragraph("TalentLens AI — Candidate Screening Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Target Requisition: {job.Job_Title if job else 'Unknown'}", subtitle_style))
    story.append(Spacer(1, 10))
    
    meta_data = [
        [Paragraph("Candidate Name:", bold_body_style), Paragraph(name, body_style), Paragraph("Position Applied:", bold_body_style), Paragraph(job.Job_Title if job else "N/A", body_style)],
        [Paragraph("Email Address:", bold_body_style), Paragraph(email, body_style), Paragraph("Department:", bold_body_style), Paragraph(job.Department if job else "N/A", body_style)],
        [Paragraph("Phone Number:", bold_body_style), Paragraph(phone, body_style), Paragraph("Job Type / Location:", bold_body_style), Paragraph(f"{job.Job_Type} / {job.Location}" if job else "N/A", body_style)],
        [Paragraph("Location:", bold_body_style), Paragraph(location, body_style), Paragraph("Ingestion Date:", bold_body_style), Paragraph(candidate.Upload_Date.strftime('%Y-%m-%d'), body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[100, 160, 100, 180])
    t_meta.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))
    
    overall_score = res.Overall_Score if res else 0.0
    rec_label = res.Explanation.get("recommendation", "Low Match") if (res and res.Explanation) else "Low Match"
    conf_level = res.Confidence_Level if res else "Low"
    
    score_data = [
        [Paragraph("Overall Match Score", bold_body_style), Paragraph(f"{overall_score}%", ParagraphStyle('Score', parent=title_style, fontSize=24, leading=28, textColor=colors.HexColor('#4F46E5'))),
         Paragraph("Evaluation Profile", bold_body_style), Paragraph(f"Recommendation: <b>{rec_label}</b><br/>AI Confidence: <b>{conf_level}</b>", body_style)]
    ]
    t_score = Table(score_data, colWidths=[130, 130, 110, 170])
    t_score.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EEF2F6')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(t_score)
    story.append(Spacer(1, 15))
    
    story.append(Paragraph("Fit Sub-Score Breakdown", section_heading))
    sub_headers = ["Evaluation Criteria", "Score", "Description"]
    sub_rows = [
        [Paragraph("Required Skills Alignment", body_style), f"{res.Skill_Score if res else 0.0}%", "Matches against core mandated requirements"],
        [Paragraph("Experience Match", body_style), f"{res.Experience_Score if res else 0.0}%", "Evaluation of relevant tenure duration"],
        [Paragraph("Education Match", body_style), f"{res.Education_Score if res else 0.0}%", "Matching degree hierarchy standards"],
        [Paragraph("Project Relevance", body_style), f"{res.Project_Score if res else 0.0}%", "Projects descriptions similarity check"],
        [Paragraph("Certifications Match", body_style), f"{res.Certification_Score if res else 0.0}%", "Matching specialized credentials"],
        [Paragraph("Profile Completeness", body_style), f"{res.Completeness_Score if res else 0.0}%", "Completeness of candidate profile sections"],
        [Paragraph("Semantic Fit (NLP)", body_style), f"{res.Semantic_Score if res else 0.0}%", "sentence-transformers direct vector proximity"]
    ]
    
    t_subs = Table([sub_headers] + sub_rows, colWidths=[160, 80, 300])
    t_subs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_subs)
    story.append(Spacer(1, 15))
    
    strengths = res.Explanation.get("strengths", []) if (res and res.Explanation) else []
    gaps = res.Explanation.get("gaps", []) if (res and res.Explanation) else []
    
    story.append(Paragraph("AI Matching Justification", section_heading))
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )
    
    story.append(Paragraph("<b>Candidate Key Strengths:</b>", bold_body_style))
    if strengths:
        for s in strengths:
            story.append(Paragraph(f"• {s}", bullet_style))
    else:
        story.append(Paragraph("No significant strengths detected by scoring rules.", bullet_style))
        
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Candidate Key Gaps / Improvement Areas:</b>", bold_body_style))
    if gaps:
        for g in gaps:
            story.append(Paragraph(f"• {g}", bullet_style))
    else:
        story.append(Paragraph("No significant gaps detected by scoring rules.", bullet_style))
        
    story.append(Spacer(1, 15))
    
    story.append(Paragraph("Hiring Workflow & Override Audit Details", section_heading))
    if dec:
        dec_data = [
            [Paragraph("Recruiter Review Decision:", bold_body_style), Paragraph(dec.Decision, ParagraphStyle('Dec', parent=bold_body_style, textColor=colors.HexColor('#059669') if dec.Decision in {'Shortlist', 'Select', 'Interview'} else colors.HexColor('#DC2626')))],
            [Paragraph("Justification Justification:", bold_body_style), Paragraph(dec.Reason or "No reason entered.", body_style)],
            [Paragraph("Decision Registered At:", bold_body_style), Paragraph(dec.Timestamp.strftime('%Y-%m-%d %H:%M:%S'), body_style)]
        ]
        t_dec = Table(dec_data, colWidths=[160, 380])
        t_dec.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F0FDF4') if dec.Decision in {'Shortlist', 'Select'} else colors.HexColor('#FFF1F2')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#A7F3D0') if dec.Decision in {'Shortlist', 'Select'} else colors.HexColor('#FECDD3')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_dec)
    else:
        story.append(Paragraph("No recruiter workflow decision has been registered yet (Candidate is currently under review).", body_style))
        
    story.append(Spacer(1, 15))
    
    if itvs:
        story.append(Paragraph("Scheduled Recruiting Interviews", section_heading))
        itv_headers = ["Status", "Date / Time", "Mode", "Justification / Notes"]
        itv_rows = []
        for i in itvs:
            itv_rows.append([
                i.Status,
                i.Interview_DateTime.strftime('%Y-%m-%d %H:%M'),
                i.Mode,
                Paragraph(i.Notes or "—", body_style)
            ])
        t_itvs = Table([itv_headers] + itv_rows, colWidths=[80, 110, 80, 270])
        t_itvs.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#475569')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')])
        ]))
        story.append(t_itvs)
        
    doc.build(story)
    
    # Log PDF export to AuditLog
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Export Report PDF",
        details=f"Recruiter exported screening report PDF for Candidate #{candidate_id} ('{name}')."
    )
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=screening_report_candidate_{candidate_id}.pdf"}
    )
