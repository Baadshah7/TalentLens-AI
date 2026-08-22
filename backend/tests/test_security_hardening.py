import importlib
import os
import sys
from datetime import timedelta

import pytest

os.environ["APP_ENV"] = "development"
import auth
import models
from dependencies import ensure_job_access
from fastapi import HTTPException


def test_production_requires_explicit_jwt_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    sys.modules.pop("auth", None)
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        importlib.import_module("auth")
    monkeypatch.setenv("APP_ENV", "development")
    sys.modules.pop("auth", None)
    importlib.import_module("auth")


def test_expired_jwt_is_rejected():
    token = auth.create_access_token({"sub": "user@example.com", "user_id": 1}, timedelta(seconds=-1))
    assert auth.decode_access_token(token) is None


def test_recruiter_cannot_access_another_recruiters_job():
    job = models.Job(Created_By=10)
    other_recruiter = models.User(User_ID=11, Role="Recruiter")
    with pytest.raises(HTTPException) as error:
        ensure_job_access(job, other_recruiter)
    assert error.value.status_code == 404


def test_admin_can_access_recruiter_job():
    job = models.Job(Created_By=10)
    admin = models.User(User_ID=11, Role="Admin")
    ensure_job_access(job, admin)


def test_upload_storage_uses_safe_basename():
    assert os.path.basename(r"..\..\secrets.txt") == "secrets.txt"