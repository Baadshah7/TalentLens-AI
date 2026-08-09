import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    User_ID = Column(Integer, primary_key=True, index=True)
    Name = Column(String, nullable=False)
    Email = Column(String, unique=True, index=True, nullable=False)
    Role = Column(String, default="Recruiter")  # "Recruiter" or "Admin"
    PasswordHash = Column(String, nullable=False)

    # Relationships
    jobs = relationship("Job", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="user")
    recruiter_decisions = relationship("RecruiterDecision", back_populates="recruiter")
    interviews = relationship("Interview", back_populates="interviewer")

class Job(Base):
    __tablename__ = "jobs"

    Job_ID = Column(Integer, primary_key=True, index=True)
    Job_Title = Column(String, nullable=False)
    Department = Column(String, nullable=False)
    Description = Column(String, nullable=False)
    
    Required_Skills = Column(JSON, default=list)  # JSON list
    Preferred_Skills = Column(JSON, default=list) # JSON list
    Min_Experience = Column(Integer, default=0)
    Min_Education = Column(String, nullable=True)
    Certifications = Column(JSON, default=list)    # JSON list
    
    Job_Type = Column(String, nullable=False)       # Full-time, Part-time, Remote, etc.
    Location = Column(String, nullable=False)
    Created_By = Column(Integer, ForeignKey("users.User_ID"), nullable=False)
    Created_At = Column(DateTime, default=datetime.datetime.utcnow)

    # Configurable Thresholds & Blind Screening
    Blind_Mode = Column(Boolean, default=False)
    Strong_Threshold = Column(Float, default=85.0)
    Good_Threshold = Column(Float, default=70.0)
    Potential_Threshold = Column(Float, default=50.0)

    # Relationships
    creator = relationship("User", back_populates="jobs")
    weights = relationship("JobSkillWeight", back_populates="job", cascade="all, delete-orphan")
    candidates = relationship("Candidate", back_populates="job", cascade="all, delete-orphan")
    screening_results = relationship("ScreeningResult", back_populates="job", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="job", cascade="all, delete-orphan")

class JobSkillWeight(Base):
    __tablename__ = "job_skill_weights"

    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="CASCADE"), primary_key=True)
    Category = Column(String, primary_key=True)  # required_skills, preferred_skills, experience, etc.
    Weight = Column(Float, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="weights")

class Candidate(Base):
    __tablename__ = "candidates"

    Candidate_ID = Column(Integer, primary_key=True, index=True)
    Name = Column(String, nullable=False)
    Email = Column(String, nullable=True)
    Phone = Column(String, nullable=True)
    Location = Column(String, nullable=True)
    Resume_File_Path = Column(String, nullable=False)
    Upload_Date = Column(DateTime, default=datetime.datetime.utcnow)
    Processing_Status = Column(String, default="Pending") # Pending, Processing, Parsed, Failed
    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="CASCADE"), nullable=False)

    # Blind Mode Override State
    Is_Identity_Revealed = Column(Boolean, default=False)

    # Relationships
    job = relationship("Job", back_populates="candidates")
    skills = relationship("CandidateSkill", back_populates="candidate", cascade="all, delete-orphan")
    experiences = relationship("CandidateExperience", back_populates="candidate", cascade="all, delete-orphan")
    educations = relationship("CandidateEducation", back_populates="candidate", cascade="all, delete-orphan")
    projects = relationship("CandidateProject", back_populates="candidate", cascade="all, delete-orphan")
    certifications = relationship("CandidateCertification", back_populates="candidate", cascade="all, delete-orphan")
    screening_results = relationship("ScreeningResult", back_populates="candidate", cascade="all, delete-orphan")
    recruiter_decision = relationship("RecruiterDecision", back_populates="candidate", uselist=False, cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    Skill_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Skill = Column(String, nullable=False)
    Skill_Level = Column(String, default="Intermediate") # Beginner, Intermediate, Expert
    Evidence_Text = Column(String, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="skills")

class CandidateExperience(Base):
    __tablename__ = "candidate_experiences"

    Experience_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Company = Column(String, nullable=True)
    Role = Column(String, nullable=True)
    Duration_Months = Column(Integer, default=0)
    Description = Column(String, nullable=True)
    Is_Relevant = Column(Boolean, default=False)

    # Relationships
    candidate = relationship("Candidate", back_populates="experiences")

class CandidateEducation(Base):
    __tablename__ = "candidate_educations"

    Education_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Degree = Column(String, nullable=True)
    Institution = Column(String, nullable=True)
    Graduation_Year = Column(Integer, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="educations")

class CandidateProject(Base):
    __tablename__ = "candidate_projects"

    Project_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Project_Name = Column(String, nullable=False)
    Technologies = Column(JSON, default=list) # JSON list
    Description = Column(String, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="projects")

class CandidateCertification(Base):
    __tablename__ = "candidate_certifications"

    Certification_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Certification_Name = Column(String, nullable=False)
    Issuing_Org = Column(String, nullable=True)

    # Relationships
    candidate = relationship("Candidate", back_populates="certifications")

class ScreeningResult(Base):
    __tablename__ = "screening_results"

    Screening_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), unique=True, nullable=False)
    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="CASCADE"), nullable=False)
    Skill_Score = Column(Float, default=0.0)
    Experience_Score = Column(Float, default=0.0)
    Education_Score = Column(Float, default=0.0)
    Project_Score = Column(Float, default=0.0)
    Certification_Score = Column(Float, default=0.0)
    Completeness_Score = Column(Float, default=0.0)
    Semantic_Score = Column(Float, default=0.0)
    Overall_Score = Column(Float, default=0.0)

    # Explainability & Match confidence
    Explanation = Column(JSON, nullable=True) # {"strengths": [], "gaps": [], "recommendation": "", "missing_skills": []}
    Confidence_Level = Column(String, default="High") # High, Medium, Low

    # Relationships
    candidate = relationship("Candidate", back_populates="screening_results")
    job = relationship("Job", back_populates="screening_results")

class RecruiterDecision(Base):
    __tablename__ = "recruiter_decisions"

    Decision_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), unique=True, nullable=False)
    Recruiter_ID = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)
    Decision = Column(String, nullable=False)  # Shortlist, Reject, Hold, Interview, Select
    Reason = Column(String, nullable=True)
    Timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="recruiter_decision")
    recruiter = relationship("User", back_populates="recruiter_decisions")

class Interview(Base):
    __tablename__ = "interviews"

    Interview_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="CASCADE"), nullable=False)
    Scheduled_By = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)
    Interview_DateTime = Column(DateTime, nullable=False)
    Mode = Column(String, nullable=False)  # Online, In-Person, Phone
    Notes = Column(String, nullable=True)
    Status = Column(String, default="Scheduled")  # Scheduled, Completed, Cancelled, Rescheduled
    Created_At = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="interviews")
    job = relationship("Job", back_populates="interviews")
    interviewer = relationship("User", back_populates="interviews")

class EmbeddingCache(Base):
    __tablename__ = "embedding_cache"

    Cache_ID = Column(Integer, primary_key=True, index=True)
    Entity_Type = Column(String, nullable=False) # "candidate", "job", "sentence"
    Entity_ID = Column(Integer, nullable=True)
    Text_Hash = Column(String, unique=True, index=True, nullable=False)
    Vector = Column(JSON, nullable=False) # JSON list of floats

class AuditLog(Base):
    __tablename__ = "audit_logs"

    Log_ID = Column(Integer, primary_key=True, index=True)
    User_ID = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)
    Action = Column(String, nullable=False)
    Timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    Details = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
