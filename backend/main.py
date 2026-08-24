import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine
from routers import auth, jobs, candidates, dashboard, interviews, chatbot
from routers import assessments

# Create missing database tables for the configured database.
models.Base.metadata.create_all(bind=engine)

# Auto-seed multi-level assessment tables
from database import SessionLocal
from routers.assessments import seed_assessments_db
db_seed = SessionLocal()
try:
    seed_assessments_db(db_seed)
finally:
    db_seed.close()

app = FastAPI(
    title="TalentLens AI - Backend Services",
    description="Backend services for AI-powered resume screening and recruitment support",
    version="1.0.0"
)

app_env = os.environ.get("APP_ENV", "development").lower()
configured_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if app_env in {"production", "prod"} and not configured_origins.strip():
    raise RuntimeError("CORS_ALLOWED_ORIGINS must be configured in production")
if not configured_origins:
    configured_origins = "http://localhost:5173,http://127.0.0.1:5173"
allowed_origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(dashboard.router)
app.include_router(interviews.router)
app.include_router(chatbot.router)
app.include_router(assessments.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the TalentLens AI API Services"}
