import importlib
import sys

import pytest
from sqlalchemy import inspect


@pytest.fixture
def database_module(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    sys.modules.pop("database", None)
    module = importlib.import_module("database")
    yield module
    sys.modules.pop("database", None)


def test_database_url_is_environment_driven(database_module):
    assert database_module.SQLALCHEMY_DATABASE_URL == "sqlite:///:memory:"
    assert database_module.engine.url.get_backend_name() == "sqlite"


def test_schema_contains_core_tables_and_foreign_keys(database_module):
    import models

    models.Base.metadata.create_all(bind=database_module.engine)
    tables = inspect(database_module.engine).get_table_names()

    assert "users" in tables
    assert "candidates" in tables
    assert "assessment_results" in tables
    assert "resume_processing_tasks" in tables

    candidate_foreign_keys = inspect(database_module.engine).get_foreign_keys("candidates")
    assert any(
        foreign_key["referred_table"] == "jobs"
        and foreign_key["options"].get("ondelete") == "CASCADE"
        for foreign_key in candidate_foreign_keys
    )