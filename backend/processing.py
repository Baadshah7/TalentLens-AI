import os
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

import models
from database import SessionLocal
from parser import parse_resume_full
from scoring import score_candidate
from utils import log_action


def save_parsed_resume_to_db(candidate: models.Candidate, parsed_data: dict, db: Session):
    if parsed_data.get("Name"):
        candidate.Name = parsed_data["Name"]
    if parsed_data.get("Email"):
        candidate.Email = parsed_data["Email"]
    if parsed_data.get("Phone"):
        candidate.Phone = parsed_data["Phone"]
    if parsed_data.get("Location"):
        candidate.Location = parsed_data["Location"]

    for sk in parsed_data.get("skills", []):
        db.add(models.CandidateSkill(
            Candidate_ID=candidate.Candidate_ID,
            Skill=sk["Skill"],
            Skill_Level=sk["Skill_Level"],
            Evidence_Text=sk["Evidence_Text"],
        ))
    for ex in parsed_data.get("experiences", []):
        db.add(models.CandidateExperience(
            Candidate_ID=candidate.Candidate_ID,
            Company=ex["Company"],
            Role=ex["Role"],
            Duration_Months=ex["Duration_Months"],
            Description=ex["Description"],
            Is_Relevant=ex["Is_Relevant"],
        ))
    for ed in parsed_data.get("educations", []):
        db.add(models.CandidateEducation(
            Candidate_ID=candidate.Candidate_ID,
            Degree=ed["Degree"],
            Institution=ed["Institution"],
            Graduation_Year=ed["Graduation_Year"],
        ))
    for pr in parsed_data.get("projects", []):
        db.add(models.CandidateProject(
            Candidate_ID=candidate.Candidate_ID,
            Project_Name=pr["Project_Name"],
            Technologies=pr["Technologies"],
            Description=pr["Description"],
        ))
    for cr in parsed_data.get("certifications", []):
        db.add(models.CandidateCertification(
            Candidate_ID=candidate.Candidate_ID,
            Certification_Name=cr["Certification_Name"],
            Issuing_Org=cr["Issuing_Org"],
        ))


def process_resume_task(task_id: str) -> None:
    db = SessionLocal()
    task = None
    try:
        task = db.query(models.ResumeProcessingTask).filter(
            models.ResumeProcessingTask.Task_ID == task_id
        ).first()
        if not task:
            return

        candidate = db.query(models.Candidate).filter(
            models.Candidate.Candidate_ID == task.Candidate_ID
        ).first()
        if not candidate:
            raise ValueError("Candidate record no longer exists")
        if task.Status == "COMPLETED":
            return

        task.Status = "PROCESSING"
        candidate.Processing_Status = "Processing"
        candidate.skills.clear()
        candidate.experiences.clear()
        candidate.educations.clear()
        candidate.projects.clear()
        candidate.certifications.clear()
        candidate.screening_results.clear()
        db.commit()

        parsed_data = parse_resume_full(candidate.Resume_File_Path, candidate.Name)
        save_parsed_resume_to_db(candidate, parsed_data, db)
        score_candidate(candidate.Candidate_ID, candidate.Job_ID, db)

        candidate.Processing_Status = "Parsed"
        task.Status = "COMPLETED"
        task.Completed_At = datetime.utcnow()
        db.commit()
        log_action(
            db,
            user_id=task.Submitted_By,
            action="Candidate Processing",
            details=f"Processed resume for job ID {candidate.Job_ID}.",
        )
    except OperationalError:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        task = db.query(models.ResumeProcessingTask).filter(
            models.ResumeProcessingTask.Task_ID == task_id
        ).first()
        if task:
            candidate = db.query(models.Candidate).filter(
                models.Candidate.Candidate_ID == task.Candidate_ID
            ).first()
            if candidate:
                candidate.skills.clear()
                candidate.experiences.clear()
                candidate.educations.clear()
                candidate.projects.clear()
                candidate.certifications.clear()
                candidate.screening_results.clear()
                candidate.Processing_Status = "Failed"
            task.Status = "FAILED"
            task.Error_Message = "Resume processing failed. Please verify the file and try again."
            task.Completed_At = datetime.utcnow()
            db.commit()
    finally:
        db.close()