from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    Name: str = Field(..., min_length=2, max_length=50)
    Email: EmailStr
    Role: str = Field("Recruiter", pattern="^(Recruiter|Admin|Candidate)$")
    Password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    Email: EmailStr
    Password: str

class UserResponse(BaseModel):
    User_ID: int
    Name: str
    Email: str
    Role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


class CoachSessionCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    sample_answer: str = Field(..., min_length=1, max_length=10000)


class CoachSessionResponse(BaseModel):
    Session_ID: int
    Question: str
    Sample_Answer: str
    Feedback: List[str]
    Suggestions: List[str]
    Star_Analysis: Dict[str, Any]
    Star_Score: int
    Created_At: datetime

    class Config:
        from_attributes = True

# Job Skill Weights schemas
class JobSkillWeightBase(BaseModel):
    Category: str
    Weight: float

    class Config:
        from_attributes = True

# Job schemas
class JobCreate(BaseModel):
    Job_Title: str
    Department: str
    Description: str
    Required_Skills: List[str] = []
    Preferred_Skills: List[str] = []
    Min_Experience: int = 0
    Min_Education: Optional[str] = None
    Certifications: List[str] = []
    Job_Type: str
    Location: str
    Weights: Optional[Dict[str, float]] = None
    
    # Thresholds & Blind Mode
    Blind_Mode: bool = False
    Strong_Threshold: float = 85.0
    Good_Threshold: float = 70.0
    Potential_Threshold: float = 50.0

class JobResponse(BaseModel):
    Job_ID: int
    Job_Title: str
    Department: str
    Description: str
    Required_Skills: List[str]
    Preferred_Skills: List[str]
    Min_Experience: int
    Min_Education: Optional[str]
    Certifications: List[str]
    Job_Type: str
    Location: str
    Created_By: int
    Created_At: datetime
    weights: List[JobSkillWeightBase]
    
    # Phase 3 Fields
    Blind_Mode: bool
    Strong_Threshold: float
    Good_Threshold: float
    Potential_Threshold: float

    class Config:
        from_attributes = True

# Recruiter Decision schemas
class RecruiterDecisionResponse(BaseModel):
    Decision_ID: int
    Candidate_ID: int
    Recruiter_ID: Optional[int] = None
    Decision: str
    Reason: Optional[str] = None
    Timestamp: datetime

    class Config:
        from_attributes = True

class RecruiterDecisionCreate(BaseModel):
    Decision: str = Field(..., pattern="^(Shortlist|Reject|Hold|Interview|Select)$")
    Reason: Optional[str] = None
    # Optional scheduling details (Phase 5)
    Interview_DateTime: Optional[datetime] = None
    Mode: Optional[str] = None
    Notes: Optional[str] = None

class BulkDecisionRequest(BaseModel):
    Candidate_IDs: List[int]
    Decision: str = Field(..., pattern="^(Shortlist|Reject|Hold)$")
    Reason: Optional[str] = None

# Interview schemas (Phase 5)
class InterviewResponse(BaseModel):
    Interview_ID: int
    Candidate_ID: int
    Job_ID: int
    Scheduled_By: Optional[int] = None
    Interview_DateTime: datetime
    Mode: str
    Notes: Optional[str] = None
    Status: str
    Created_At: datetime
    Candidate_Name: Optional[str] = None
    Job_Title: Optional[str] = None

    class Config:
        from_attributes = True

class InterviewCreate(BaseModel):
    Candidate_ID: int
    Job_ID: int
    Interview_DateTime: datetime
    Mode: str = Field(..., pattern="^(Online|In-Person|Phone)$")
    Notes: Optional[str] = None

class InterviewUpdate(BaseModel):
    Interview_DateTime: datetime
    Mode: str = Field(..., pattern="^(Online|In-Person|Phone)$")
    Notes: Optional[str] = None
    Status: str = Field(..., pattern="^(Scheduled|Completed|Cancelled|Rescheduled)$")

# Candidate schemas
class CandidateResponse(BaseModel):
    Candidate_ID: int
    Name: str
    Email: Optional[str] = None
    Phone: Optional[str] = None
    Location: Optional[str] = None
    Resume_File_Path: str
    Upload_Date: datetime
    Processing_Status: str
    Job_ID: int
    Overall_Score: Optional[float] = None
    Is_Identity_Revealed: bool = False
    Decision: Optional[str] = None

    class Config:
        from_attributes = True


class ResumeProcessingStatusResponse(BaseModel):
    Task_ID: str
    Candidate_ID: int
    Status: str
    Submitted_At: datetime
    Completed_At: Optional[datetime] = None
    Error_Message: Optional[str] = None

    class Config:
        from_attributes = True

# Candidate detailed sub-schemas
class CandidateSkillResponse(BaseModel):
    Skill_ID: int
    Skill: str
    Skill_Level: str
    Evidence_Text: Optional[str] = None

    class Config:
        from_attributes = True

class CandidateExperienceResponse(BaseModel):
    Experience_ID: int
    Company: Optional[str] = None
    Role: Optional[str] = None
    Duration_Months: int
    Description: Optional[str] = None
    Is_Relevant: bool

    class Config:
        from_attributes = True

class CandidateEducationResponse(BaseModel):
    Education_ID: int
    Degree: Optional[str] = None
    Institution: Optional[str] = None
    Graduation_Year: Optional[int] = None

    class Config:
        from_attributes = True

class CandidateProjectResponse(BaseModel):
    Project_ID: int
    Project_Name: str
    Technologies: List[str]
    Description: Optional[str] = None

    class Config:
        from_attributes = True

class CandidateCertificationResponse(BaseModel):
    Certification_ID: int
    Certification_Name: str
    Issuing_Org: Optional[str] = None

    class Config:
        from_attributes = True

class ScreeningResultResponse(BaseModel):
    Screening_ID: int
    Candidate_ID: int
    Job_ID: int
    Skill_Score: float
    Experience_Score: float
    Education_Score: float
    Project_Score: float
    Certification_Score: float
    Completeness_Score: float
    Semantic_Score: float
    Overall_Score: float
    Explanation: Optional[Dict[str, Any]] = None
    Confidence_Level: str

    class Config:
        from_attributes = True

# Composite detailed response for Candidate
class CandidateDetailResponse(BaseModel):
    Candidate_ID: int
    Name: str
    Email: Optional[str] = None
    Phone: Optional[str] = None
    Location: Optional[str] = None
    Resume_File_Path: str
    Upload_Date: datetime
    Processing_Status: str
    Job_ID: int
    Is_Identity_Revealed: bool
    skills: List[CandidateSkillResponse] = []
    experiences: List[CandidateExperienceResponse] = []
    educations: List[CandidateEducationResponse] = []
    projects: List[CandidateProjectResponse] = []
    certifications: List[CandidateCertificationResponse] = []
    screening_results: List[ScreeningResultResponse] = []
    recruiter_decision: Optional[RecruiterDecisionResponse] = None
    interviews: List[InterviewResponse] = []  # Added for Phase 5

    class Config:
        from_attributes = True

# Identity reveal request body
class RevealRequest(BaseModel):
    Reason: str = Field(..., min_length=3, max_length=250)

# What-If Analysis schemas
class WhatIfRequest(BaseModel):
    Weights: Dict[str, float]
    Required_Skills: List[str]
    Preferred_Skills: List[str]

class WhatIfCandidatePreview(BaseModel):
    Candidate_ID: int
    Name: str
    Old_Score: float
    New_Score: float
    Old_Rank: int
    New_Rank: int

class WhatIfResponse(BaseModel):
    Job_ID: int
    candidates: List[WhatIfCandidatePreview]

# Audit Log schemas
class AuditLogResponse(BaseModel):
    Log_ID: int
    User_ID: Optional[int] = None
    Action: str
    Timestamp: datetime
    Details: Optional[str] = None
    User_Name: Optional[str] = None

    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardStats(BaseModel):
    total_jobs: int
    total_candidates: int
    candidates_shortlisted: int
    candidates_rejected: int
    candidates_under_review: int


# Assessment / Aptitude Test schemas
class QuestionCreate(BaseModel):
    Text: str
    Options: List[str]
    Correct_Index: int = 0
    Points: int = 1

class TestCreate(BaseModel):
    Title: str
    Job_ID: Optional[int] = None
    Duration_Sec: int = 600
    Questions: List[QuestionCreate]

class QuestionResponse(BaseModel):
    Question_ID: int
    Text: str
    Options: List[str]
    Points: int

    class Config:
        from_attributes = True

class TestResponse(BaseModel):
    Test_ID: int
    Title: str
    Job_ID: Optional[int] = None
    Duration_Sec: int
    Questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True

class SubmitRequest(BaseModel):
    Answers: List[int]  # selected option indices by question order

class SubmitResponse(BaseModel):
    Result_ID: int
    Test_ID: int
    Candidate_ID: Optional[int] = None
    Score: float
    Max_Score: float
    Percentage: float
    Correct: int
    Total: int

    class Config:
        from_attributes = True


# Chatbot request bodies
class ChatbotQuery(BaseModel):
    question: str
    sample_answer: Optional[str] = None

