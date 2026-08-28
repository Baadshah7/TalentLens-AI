from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth
from utils import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=schemas.Token)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    if user_data.Role == "Admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin accounts cannot be self-registered"
        )

    clean_email = user_data.Email.strip().lower()
    clean_name = user_data.Name.strip()

    # Check if user already exists (case-insensitive)
    existing_user = db.query(models.User).filter(models.User.Email.ilike(clean_email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
    
    # Hash password and create user
    hashed_pwd = auth.get_password_hash(user_data.Password)
    
    new_user = models.User(
        Name=clean_name,
        Email=clean_email,
        Role=user_data.Role,
        PasswordHash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_id = new_user.User_ID

    # Identity linking check for Candidates
    if new_user.Role == "Candidate":
        from routers.assessments import initialize_candidate_progress
        import datetime
        
        try:
            # Check if passively created candidate profiles exist for this email
            candidates = db.query(models.Candidate).filter(models.Candidate.Email.ilike(clean_email)).all()
            if candidates:
                for candidate in candidates:
                    candidate.User_ID = user_id
                db.commit()
                
                # Sort candidates by upload date descending
                latest_cand = sorted(candidates, key=lambda c: c.Upload_Date or datetime.datetime.min, reverse=True)[0]
                initialize_candidate_progress(latest_cand.Candidate_ID, db)
            else:
                # Create a fresh Candidate profile linked to this User
                fresh_cand = models.Candidate(
                    Name=new_user.Name,
                    Email=new_user.Email,
                    User_ID=user_id,
                    Resume_File_Path="",
                    Processing_Status="Completed",
                    Job_ID=None
                )
                db.add(fresh_cand)
                db.commit()
                db.refresh(fresh_cand)
                initialize_candidate_progress(fresh_cand.Candidate_ID, db)
        except Exception as cand_err:
            print("Warning: Candidate profile setup error:", cand_err)
            db.rollback()
            # Ensure new_user is re-queried so it's attached and valid for response
            new_user = db.query(models.User).filter(models.User.User_ID == user_id).first()
    
    # Generate token
    token = auth.create_access_token({"sub": new_user.Email, "user_id": new_user.User_ID, "role": new_user.Role})
    
    # Write to Audit Log
    log_action(
        db, 
        user_id=new_user.User_ID, 
        action="User Registration", 
        details=f"User registered with email: {new_user.Email}, Role: {new_user.Role}"
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }

@router.post("/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    clean_email = login_data.Email.strip().lower()
    
    # Find user (case-insensitive)
    user = db.query(models.User).filter(models.User.Email.ilike(clean_email)).first()
    if not user or not auth.verify_password(login_data.Password, user.PasswordHash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate token
    token = auth.create_access_token({"sub": user.Email, "user_id": user.User_ID, "role": user.Role})
    
    # Write to Audit Log
    log_action(
        db, 
        user_id=user.User_ID, 
        action="User Login", 
        details=f"User logged in: {user.Email}"
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }
