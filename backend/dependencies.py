from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
from auth import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

class CandidateUserWrapper:
    def __init__(self, candidate):
        self.User_ID = candidate.Candidate_ID
        self.Candidate_ID = candidate.Candidate_ID
        self.Email = candidate.Email
        self.Name = candidate.Name
        self.Role = "Candidate"

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
        
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    email: str = payload.get("sub")
    user_id: int = payload.get("user_id")
    role: str = payload.get("role", "Recruiter")
    if email is None or user_id is None:
        raise credentials_exception
        
    if role == "Candidate":
        candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == user_id).first()
        if candidate is None:
            raise credentials_exception
        return CandidateUserWrapper(candidate)
        
    user = db.query(models.User).filter(models.User.User_ID == user_id).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.Role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative privileges to perform this action"
        )
    return current_user


def ensure_job_access(job: models.Job, current_user: models.User) -> None:
    """Require admins or the recruiter who owns the job for job-scoped data."""
    if current_user.Role not in ("Recruiter", "Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this resource")
    if current_user.Role != "Admin" and job.Created_By != current_user.User_ID:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
