import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine, SessionLocal, SQLALCHEMY_DATABASE_URL
from routers import auth, jobs, candidates, dashboard, interviews, chatbot
from routers import assessments
from routers.assessments import seed_assessments_db


def _auto_seed_demo_data():
    """
    Auto-seed demo users, jobs, and candidates on fresh SQLite databases.

    On Hugging Face Spaces, the container filesystem resets on every restart,
    which wipes the SQLite file. This function re-seeds the database from
    the existing seed.py script so the app is always usable after cold start.

    This is skipped on PostgreSQL deployments (Render/Neon) where data persists.
    """
    is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    if not is_sqlite:
        return  # Persistent DB — never auto-seed in production

    db = SessionLocal()
    try:
        user_count = db.query(models.User).count()
        if user_count > 0:
            print("INFO: Database already has data — skipping demo seed.")
            return

        print("INFO: Fresh SQLite detected — seeding demo data...")
        try:
            from seed import seed_database  # import only when needed
            seed_database()
            print("INFO: Demo seed completed successfully.")
        except Exception as seed_err:
            print(f"WARNING: Demo seed failed (non-fatal): {seed_err}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: run startup tasks before serving requests."""
    # Create tables
    models.Base.metadata.create_all(bind=engine)

    # Seed assessment question bank
    db_seed = SessionLocal()
    try:
        seed_assessments_db(db_seed)
    finally:
        db_seed.close()

    # Auto-seed demo data on HF Spaces (SQLite only)
    _auto_seed_demo_data()

    yield  # App is now running
    # (add shutdown cleanup here if needed)


app_env = os.environ.get("APP_ENV", "development").lower()

app = FastAPI(
    title="TalentLens AI - Backend Services",
    description="Backend services for AI-powered resume screening and recruitment support",
    version="1.0.0",
    lifespan=lifespan,
    # Keep docs enabled on HF Spaces (great for portfolio demos), disable on Render prod
    docs_url=None if app_env == "production" else "/docs",
    redoc_url=None if app_env == "production" else "/redoc",
)

configured_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if app_env in {"production", "prod"} and not configured_origins.strip():
    raise RuntimeError("CORS_ALLOWED_ORIGINS must be configured in production")
if not configured_origins:
    # Development + HF Spaces defaults
    configured_origins = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://*.hf.space,https://*.huggingface.co"
    )
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


@app.get("/health")
def health_check():
    """Health check endpoint — used by Render and HF Spaces monitoring."""
    return {"status": "ok", "service": "TalentLens AI Backend"}
