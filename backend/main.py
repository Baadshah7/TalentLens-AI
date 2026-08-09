import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine
from routers import auth, jobs, candidates, dashboard

# Create database tables (SQLite dev)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TalentLens AI - Backend Services",
    description="Backend services for AI-powered resume screening and recruitment support",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the TalentLens AI API Services"}
