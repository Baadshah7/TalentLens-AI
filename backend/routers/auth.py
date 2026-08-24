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
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.Email == user_data.Email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
    
    # Hash password and create user
    hashed_pwd = auth.get_password_hash(user_data.Password)
    
    # Public registration never grants administrative privileges.
    role = user_data.Role
    if role == "Admin":
        role = "Recruiter"
        
    new_user = models.User(
        Name=user_data.Name,
        Email=user_data.Email,
        Role=role,
        PasswordHash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
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
    # Find user
    user = db.query(models.User).filter(models.User.Email == login_data.Email).first()
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
