import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from routers.assessments import get_candidate_results
from dependencies import get_current_user


def make_assessment_fixture(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'assessment-auth.db'}")
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    user_a = models.User(Name="Recruiter A", Email="a@example.com", Role="Recruiter", PasswordHash="hash")
    user_b = models.User(Name="Recruiter B", Email="b@example.com", Role="Recruiter", PasswordHash="hash")
    candidate_user = models.User(Name="Candidate A", Email="candidate@example.com", Role="Candidate", PasswordHash="hash")
    admin = models.User(Name="Admin", Email="admin@example.com", Role="Admin", PasswordHash="hash")
    db.add_all([user_a, user_b, candidate_user, admin])
    db.commit()
    job_a = models.Job(Job_Title="Role A", Department="Engineering", Description="Role A", Job_Type="Full-time", Location="Remote", Created_By=user_a.User_ID)
    job_b = models.Job(Job_Title="Role B", Department="Engineering", Description="Role B", Job_Type="Full-time", Location="Remote", Created_By=user_b.User_ID)
    db.add_all([job_a, job_b])
    db.commit()
    candidate_a = models.Candidate(Name="Candidate A", Email="candidate@example.com", Resume_File_Path="a.txt", Job_ID=job_a.Job_ID, Processing_Status="Parsed")
    candidate_b = models.Candidate(Name="Candidate B", Email="other@example.com", Resume_File_Path="b.txt", Job_ID=job_b.Job_ID, Processing_Status="Parsed")
    db.add_all([candidate_a, candidate_b])
    db.commit()
    test_a = models.AssessmentTest(Title="Test A", Job_ID=job_a.Job_ID, Created_By=user_a.User_ID)
    test_b = models.AssessmentTest(Title="Test B", Job_ID=job_b.Job_ID, Created_By=user_b.User_ID)
    db.add_all([test_a, test_b])
    db.commit()
    result_a = models.AssessmentResult(Test_ID=test_a.Test_ID, Candidate_ID=candidate_a.Candidate_ID, Score=8, Max_Score=10, Answers=[1])
    result_b = models.AssessmentResult(Test_ID=test_b.Test_ID, Candidate_ID=candidate_b.Candidate_ID, Score=2, Max_Score=10, Answers=[0])
    db.add_all([result_a, result_b])
    db.commit()
    return db, user_a, user_b, candidate_user, admin, candidate_a, candidate_b


def test_owner_recruiter_can_view_authorized_candidate_results(tmp_path):
    db, user_a, _, _, _, candidate_a, _ = make_assessment_fixture(tmp_path)
    results = get_candidate_results(candidate_a.Candidate_ID, db, user_a)
    assert results[0]["Score"] == 8
    db.close()


def test_recruiter_cannot_view_candidate_from_another_job(tmp_path):
    db, user_a, _, _, _, _, candidate_b = make_assessment_fixture(tmp_path)
    with pytest.raises(HTTPException) as error:
        get_candidate_results(candidate_b.Candidate_ID, db, user_a)
    assert error.value.status_code == 403
    db.close()


def test_candidate_can_view_only_matching_email_results(tmp_path):
    db, _, _, candidate_user, _, candidate_a, candidate_b = make_assessment_fixture(tmp_path)
    assert get_candidate_results(candidate_a.Candidate_ID, db, candidate_user)[0]["Score"] == 8
    with pytest.raises(HTTPException) as error:
        get_candidate_results(candidate_b.Candidate_ID, db, candidate_user)
    assert error.value.status_code == 403
    db.close()


def test_admin_can_view_candidate_results(tmp_path):
    db, _, _, _, admin, _, candidate_b = make_assessment_fixture(tmp_path)
    assert get_candidate_results(candidate_b.Candidate_ID, db, admin)[0]["Score"] == 2
    db.close()


def test_missing_candidate_does_not_leak_results(tmp_path):
    db, user_a, _, _, _, _, _ = make_assessment_fixture(tmp_path)
    with pytest.raises(HTTPException) as error:
        get_candidate_results(99999, db, user_a)
    assert error.value.status_code == 404
    assert "assessment" not in error.value.detail.lower()
    db.close()


def test_unauthenticated_request_is_rejected():
    with pytest.raises(HTTPException) as error:
        get_current_user(None, None)
    assert error.value.status_code == 401