from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from dependencies import get_current_user
from utils import log_action

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

@router.post("/", response_model=schemas.JobResponse)
def create_job(
    job_data: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Create the job
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
        Created_By=current_user.User_ID
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Process and save skill/category weights
    weights_dict = DEFAULT_WEIGHTS.copy()
    if job_data.Weights:
        # Override with any incoming values, ensuring total matches 100 or close (we can validate in frontend or backend, backend just stores it)
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

    # Log action
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
    # Recruiter and Admin can list all jobs
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
    
    # Update fields
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

    # Update weights if provided
    if job_data.Weights:
        # Delete existing weights
        db.query(models.JobSkillWeight).filter(models.JobSkillWeight.Job_ID == job_id).delete()
        
        # Add new ones
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

    # Log action
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

    # Log action
    log_action(
        db,
        user_id=current_user.User_ID,
        action="Job Deleted",
        details=f"Job Title: '{job_title}' (ID: {job_id}) deleted by {current_user.Name}"
    )

    return {"message": "Job deleted successfully"}
