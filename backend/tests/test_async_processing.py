from pathlib import Path
from types import SimpleNamespace
from datetime import datetime

import models
import processing
import pytest
from fastapi import HTTPException
from routers.candidates import get_processing_status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def make_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'async.db'}")
    models.Base.metadata.create_all(engine)
    return sessionmaker(bind=engine), engine


def create_task(session_factory, tmp_path):
    db = session_factory()
    user = models.User(Name="Recruiter", Email="async@example.com", PasswordHash="hash")
    db.add(user)
    db.commit()
    job = models.Job(
        Job_Title="Backend Engineer",
        Department="Engineering",
        Description="Python FastAPI backend",
        Required_Skills=["Python"],
        Preferred_Skills=[],
        Certifications=[],
        Job_Type="Full-time",
        Location="Remote",
        Created_By=user.User_ID,
    )
    db.add(job)
    db.commit()
    resume_path = Path(tmp_path) / "resume.txt"
    resume_path.write_text("Jane Doe\nEmail: jane@example.com\nSkills\nPython", encoding="utf-8")
    candidate = models.Candidate(
        Name="Jane Doe",
        Resume_File_Path=str(resume_path),
        Processing_Status="Pending",
        Job_ID=job.Job_ID,
    )
    db.add(candidate)
    db.commit()
    task = models.ResumeProcessingTask(
        Task_ID="async-task",
        Candidate_ID=candidate.Candidate_ID,
        Submitted_By=user.User_ID,
    )
    db.add(task)
    db.commit()
    candidate_id = candidate.Candidate_ID
    db.close()
    return candidate_id


def test_worker_success_updates_task_and_candidate(monkeypatch, tmp_path):
    session_factory, engine = make_session(tmp_path)
    candidate_id = create_task(session_factory, tmp_path)
    monkeypatch.setattr(processing, "SessionLocal", session_factory)
    monkeypatch.setattr(processing, "parse_resume_full", lambda *_: {
        "Name": "Jane Doe", "Email": "jane@example.com", "Phone": None,
        "Location": None, "skills": [], "experiences": [], "educations": [],
        "projects": [], "certifications": [],
    })
    monkeypatch.setattr(processing, "score_candidate", lambda *_: None)

    processing.process_resume_task("async-task")

    db = session_factory()
    task = db.get(models.ResumeProcessingTask, "async-task")
    candidate = db.get(models.Candidate, candidate_id)
    assert task.Status == "COMPLETED"
    assert candidate.Processing_Status == "Parsed"
    db.close()
    engine.dispose()


def test_worker_failure_marks_task_failed_and_hides_error(monkeypatch, tmp_path):
    session_factory, engine = make_session(tmp_path)
    candidate_id = create_task(session_factory, tmp_path)
    monkeypatch.setattr(processing, "SessionLocal", session_factory)
    monkeypatch.setattr(processing, "parse_resume_full", lambda *_: (_ for _ in ()).throw(RuntimeError("secret path")))

    processing.process_resume_task("async-task")

    db = session_factory()
    task = db.get(models.ResumeProcessingTask, "async-task")
    candidate = db.get(models.Candidate, candidate_id)
    assert task.Status == "FAILED"
    assert task.Error_Message == "Resume processing failed. Please verify the file and try again."
    assert "secret path" not in task.Error_Message
    assert candidate.Processing_Status == "Failed"
    db.close()
    engine.dispose()


class FakeQuery:
    def __init__(self, value):
        self.value = value

    def filter(self, *_args):
        return self

    def first(self):
        return self.value


class FakeDB:
    def __init__(self, value):
        self.value = value

    def query(self, *_args):
        return FakeQuery(self.value)


def test_processing_status_is_private_to_submitter():
    task = SimpleNamespace(
        Task_ID="async-task",
        Candidate_ID=7,
        Submitted_By=10,
        Status="PENDING",
        Submitted_At=datetime.utcnow(),
        Completed_At=None,
        Error_Message=None,
    )
    owner = SimpleNamespace(User_ID=10, Role="Recruiter")
    other_recruiter = SimpleNamespace(User_ID=11, Role="Recruiter")

    assert get_processing_status("async-task", FakeDB(task), owner).Task_ID == "async-task"
    with pytest.raises(HTTPException) as error:
        get_processing_status("async-task", FakeDB(task), other_recruiter)
    assert error.value.status_code == 404