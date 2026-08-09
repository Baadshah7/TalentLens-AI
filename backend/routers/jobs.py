from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from dependencies import get_current_user
from utils import log_action
from ethical import audit_codebase_compliance

router = APIRouter(prefix="/jobs", tags=["jobs"])

DEFAULT_WEIGHTS = {
    "required_skills": 35.0,
    "preferred_skills": 15.0,
    "experience": 15.0,
    "education": 10.0,
    "projects": 10.0,
    "certifications": 5.0,
    "completeness": 5.0,
    "semantic_fit": 5.0
}

@router.get("/ethical-check")
def ethical_screening_check(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Audits database schema structure and parser components for compliance validation."""
    return audit_codebase_compliance()

@router.post("/", response_model=schemas.JobResponse)
def create_job(
    job_data: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_job = models.Job(
        Job_Title=job_data.Job_Title,
        Department=job_data.Department,
        Description=job_data.Description,
        Required_Skills=job_data.Required_Skills,
        Preferred_Skills=job_data.Preferred_Skills,
        Min_Experience=job_data.Min_Experience,
        Min_Education=job_data.Min_Education,
        Certifications=job_data.Certifications,
        Job_Type=job_data.Job_Type,
        Location=job_data.Location,
        Created_By=current_user.User_ID,
        Blind_Mode=job_data.Blind_Mode,
        Strong_Threshold=job_data.Strong_Threshold,
        Good_Threshold=job_data.Good_Threshold,
        Potential_Threshold=job_data.Potential_Threshold
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    weights_dict = DEFAULT_WEIGHTS.copy()
    if job_data.Weights:
        for cat, w in job_data.Weights.items():
            if cat in weights_dict:
                weights_dict[cat] = w

    for category, weight in weights_dict.items():
        weight_entry = models.JobSkillWeight(
            Job_ID=new_job.Job_ID,
            Category=category,
            Weight=weight
        )
        db.add(weight_entry)
    
    db.commit()
    db.refresh(new_job)

    log_action(
        db,
        user_id=current_user.User_ID,
        action="Job Created",
        details=f"Job Title: '{new_job.Job_Title}' (ID: {new_job.Job_ID}) created by {current_user.Name}"
    )

    return new_job

@router.get("/", response_model=List[schemas.JobResponse])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Job).all()

@router.get("/{job_id}", response_model=schemas.JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    return job

@router.put("/{job_id}", response_model=schemas.JobResponse)
def update_job(
    job_id: int,
    job_data: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    
    job.Job_Title = job_data.Job_Title
    job.Department = job_data.Department
    job.Description = job_data.Description
    job.Required_Skills = job_data.Required_Skills
    job.Preferred_Skills = job_data.Preferred_Skills
    job.Min_Experience = job_data.Min_Experience
    job.Min_Education = job_data.Min_Education
    job.Certifications = job_data.Certifications
    job.Job_Type = job_data.Job_Type
    job.Location = job_data.Location
    
    # Update thresholds and blind mode
    job.Blind_Mode = job_data.Blind_Mode
    job.Strong_Threshold = job_data.Strong_Threshold
    job.Good_Threshold = job_data.Good_Threshold
    job.Potential_Threshold = job_data.Potential_Threshold

    if job_data.Weights:
        db.query(models.JobSkillWeight).filter(models.JobSkillWeight.Job_ID == job_id).delete()
        
        weights_dict = DEFAULT_WEIGHTS.copy()
        for cat, w in job_data.Weights.items():
            if cat in weights_dict:
                weights_dict[cat] = w

        for category, weight in weights_dict.items():
            weight_entry = models.JobSkillWeight(
                Job_ID=job_id,
                Category=category,
                Weight=weight
            )
            db.add(weight_entry)
            
    db.commit()
    db.refresh(job)

    log_action(
        db,
        user_id=current_user.User_ID,
        action="Job Updated",
        details=f"Job Title: '{job.Job_Title}' (ID: {job.Job_ID}) updated by {current_user.Name}"
    )

    return job

@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    job_title = job.Job_Title
    db.delete(job)
    db.commit()

    log_action(
        db,
        user_id=current_user.User_ID,
        action="Job Deleted",
        details=f"Job Title: '{job_title}' (ID: {job_id}) deleted by {current_user.Name}"
    )

    return {"message": "Job deleted successfully"}

@router.post("/{job_id}/what-if", response_model=schemas.WhatIfResponse)
def what_if_preview(
    job_id: int,
    request: schemas.WhatIfRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Calculates in-memory score variations for candidates without committing changes to DB."""
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")
    
    candidates = db.query(models.Candidate).filter(
        models.Candidate.Job_ID == job_id,
        models.Candidate.Processing_Status == "Parsed"
    ).all()
    
    from scoring import compute_skill_scores
    
    previews = []
    for c in candidates:
        res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == c.Candidate_ID).first()
        if not res:
            continue
            
        # Recalculate skill matching in-memory using the preview requirements
        new_req_score, new_pref_score = compute_skill_scores(c.Candidate_ID, request.Required_Skills, request.Preferred_Skills, db)
        
        new_sub_scores = {
            "required_skills": new_req_score,
            "preferred_skills": new_pref_score,
            "experience": res.Experience_Score,
            "education": res.Education_Score,
            "projects": res.Project_Score,
            "certifications": res.Certification_Score,
            "completeness": res.Completeness_Score,
            "semantic_fit": res.Semantic_Score
        }
        
        # Calculate new overall score
        new_overall = 0.0
        total_w = 0.0
        for cat, score in new_sub_scores.items():
            w = request.Weights.get(cat, 0.0)
            new_overall += (score * w)
            total_w += w
            
        if total_w > 0:
            new_overall = round(new_overall / total_w, 2)
        else:
            new_overall = round(sum(new_sub_scores.values()) / len(new_sub_scores), 2)
            
        is_blind = job.Blind_Mode and not c.Is_Identity_Revealed
        display_name = f"Candidate #{c.Candidate_ID}" if is_blind else c.Name
        
        previews.append({
            "Candidate_ID": c.Candidate_ID,
            "Name": display_name,
            "Old_Score": res.Overall_Score,
            "New_Score": new_overall,
            "Old_Rank": 0,
            "New_Rank": 0
        })
        
    # Sort by old score to find old ranks
    previews.sort(key=lambda x: x["Old_Score"], reverse=True)
    for idx, p in enumerate(previews):
        p["Old_Rank"] = idx + 1
        
    # Sort by new score to find new ranks
    previews.sort(key=lambda x: x["New_Score"], reverse=True)
    for idx, p in enumerate(previews):
        p["New_Rank"] = idx + 1
        
    return {
        "Job_ID": job_id,
        "candidates": previews
    }
