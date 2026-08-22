from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import scoring


def test_evidence_explanation_distinguishes_match_types_and_uses_parsed_data(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'evidence.db'}")
    models.Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    db = session_factory()

    user = models.User(Name="Recruiter", Email="evidence@example.com", PasswordHash="hash")
    db.add(user)
    db.commit()
    job = models.Job(
        Job_Title="Backend Engineer",
        Department="Engineering",
        Description="Build Python FastAPI services",
        Required_Skills=["Python", "FastAPI", "Rust"],
        Preferred_Skills=[],
        Certifications=[],
        Job_Type="Full-time",
        Location="Remote",
        Created_By=user.User_ID,
        Min_Education="Bachelor's",
    )
    db.add(job)
    db.commit()
    candidate = models.Candidate(
        Name="Candidate Name",
        Resume_File_Path="resume.txt",
        Processing_Status="Parsed",
        Job_ID=job.Job_ID,
    )
    db.add(candidate)
    db.commit()
    db.add_all([
        models.CandidateSkill(
            Candidate_ID=candidate.Candidate_ID,
            Skill="Python",
            Skill_Level="Expert",
            Evidence_Text="Built Python APIs for internal services.",
        ),
        models.CandidateExperience(
            Candidate_ID=candidate.Candidate_ID,
            Role="Backend Engineer",
            Company="Example Systems",
            Duration_Months=24,
            Description="Designed FastAPI services and automated deployments.",
            Is_Relevant=True,
        ),
        models.CandidateProject(
            Candidate_ID=candidate.Candidate_ID,
            Project_Name="Service Platform",
            Technologies=["Python", "FastAPI"],
            Description="Built an API platform for workflow automation.",
        ),
    ])
    db.commit()

    def embedding(text, *_args, **_kwargs):
        return [1.0, 0.0] if text.lower() == "rust" else [0.0, 1.0]

    monkeypatch.setattr(scoring, "get_embedding", embedding)
    explanation, confidence = scoring.build_evidence_explanation(
        candidate,
        job,
        {
            "required_skills": 66.67,
            "preferred_skills": 100.0,
            "experience": 100.0,
            "education": 0.0,
            "projects": 90.0,
            "certifications": 100.0,
            "completeness": 40.0,
            "semantic_fit": 80.0,
        },
        24,
        db,
    )

    matches = {item["requirement"]: item for item in explanation["evidence"]["required_skills"]}
    assert matches["Python"]["match_type"] == "exact"
    assert matches["FastAPI"]["match_type"] == "related"
    assert matches["Rust"]["match_type"] == "missing"
    assert "Rust" in explanation["missing_skills"]
    assert "FastAPI services" in explanation["evidence"]["experience"][0]["evidence"]
    assert explanation["evidence"]["projects"][0]["project"] == "Service Platform"
    assert confidence in {"High", "Medium", "Low"}

    flattened = str(explanation)
    assert "Candidate Name" not in flattened
    assert "evidence@example.com" not in flattened
    db.close()
    engine.dispose()
