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
    coach_sessions = relationship("CoachSession", back_populates="user", cascade="all, delete-orphan")
    candidates = relationship("Candidate", back_populates="user")

    @property
    def Candidate_ID(self):
        if self.Role == "Candidate" and self.candidates:
            # Sort candidates by Upload_Date descending to get the most recent primary profile
            sorted_cands = sorted(self.candidates, key=lambda c: c.Upload_Date or datetime.datetime.min, reverse=True)
            if sorted_cands:
                return sorted_cands[0].Candidate_ID
        return None

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
    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="CASCADE"), nullable=True)
    User_ID = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)

    # Blind Mode Override State
    Is_Identity_Revealed = Column(Boolean, default=False)

    # Relationships
    job = relationship("Job", back_populates="candidates")
    user = relationship("User", back_populates="candidates")
    skills = relationship("CandidateSkill", back_populates="candidate", cascade="all, delete-orphan")
    experiences = relationship("CandidateExperience", back_populates="candidate", cascade="all, delete-orphan")
    educations = relationship("CandidateEducation", back_populates="candidate", cascade="all, delete-orphan")
    projects = relationship("CandidateProject", back_populates="candidate", cascade="all, delete-orphan")
    certifications = relationship("CandidateCertification", back_populates="candidate", cascade="all, delete-orphan")
    screening_results = relationship("ScreeningResult", back_populates="candidate", cascade="all, delete-orphan")
    recruiter_decision = relationship("RecruiterDecision", back_populates="candidate", uselist=False, cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")
    processing_tasks = relationship("ResumeProcessingTask", back_populates="candidate", cascade="all, delete-orphan")
    assessment_attempts = relationship("AssessmentAttemptNew", back_populates="candidate", cascade="all, delete-orphan")
    progress = relationship("CandidateProgress", back_populates="candidate", cascade="all, delete-orphan")


class ResumeProcessingTask(Base):
    __tablename__ = "resume_processing_tasks"

    Task_ID = Column(String, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False, unique=True)
    Submitted_By = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)
    Status = Column(String, nullable=False, default="PENDING", index=True)
    Submitted_At = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    Completed_At = Column(DateTime, nullable=True)
    Error_Message = Column(String, nullable=True)

    candidate = relationship("Candidate", back_populates="processing_tasks")
    submitter = relationship("User")

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


class CoachSession(Base):
    __tablename__ = "coach_sessions"

    Session_ID = Column(Integer, primary_key=True, index=True)
    User_ID = Column(Integer, ForeignKey("users.User_ID", ondelete="CASCADE"), nullable=False, index=True)
    Question = Column(String, nullable=False)
    Sample_Answer = Column(String, nullable=False)
    Feedback = Column(JSON, default=list)
    Suggestions = Column(JSON, default=list)
    Star_Analysis = Column(JSON, nullable=False)
    Star_Score = Column(Integer, default=0)
    Created_At = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="coach_sessions")

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


class AssessmentTest(Base):
    __tablename__ = "assessment_tests"

    Test_ID = Column(Integer, primary_key=True, index=True)
    Title = Column(String, nullable=False)
    Job_ID = Column(Integer, ForeignKey("jobs.Job_ID", ondelete="SET NULL"), nullable=True)
    Duration_Sec = Column(Integer, default=600)  # default 10 minutes
    Created_By = Column(Integer, ForeignKey("users.User_ID", ondelete="SET NULL"), nullable=True)
    Created_At = Column(DateTime, default=datetime.datetime.utcnow)

    questions = relationship("AssessmentQuestion", back_populates="test", cascade="all, delete-orphan")


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"

    Question_ID = Column(Integer, primary_key=True, index=True)
    Test_ID = Column(Integer, ForeignKey("assessment_tests.Test_ID", ondelete="CASCADE"), nullable=False)
    Text = Column(String, nullable=False)
    Options = Column(JSON, default=list)
    Correct_Index = Column(Integer, nullable=False, default=0)
    Points = Column(Integer, default=1)

    test = relationship("AssessmentTest", back_populates="questions")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    Result_ID = Column(Integer, primary_key=True, index=True)
    Test_ID = Column(Integer, ForeignKey("assessment_tests.Test_ID", ondelete="SET NULL"), nullable=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="SET NULL"), nullable=True)
    Score = Column(Float, default=0.0)
    Max_Score = Column(Float, default=0.0)
    Answers = Column(JSON, nullable=True)  # list of selected indices
    Completed_At = Column(DateTime, default=datetime.datetime.utcnow)

    # relationships
    test = relationship("AssessmentTest")
    candidate = relationship("Candidate")


class AssessmentDomain(Base):
    __tablename__ = "assessment_domains"

    Domain_ID = Column(Integer, primary_key=True, index=True)
    Name = Column(String, unique=True, index=True, nullable=False)
    Icon_Slug = Column(String, default="code")
    Description = Column(String, nullable=True)
    Is_Active = Column(Boolean, default=True)

    tracks = relationship("AssessmentTrack", back_populates="domain", cascade="all, delete-orphan")
    questions = relationship("AssessmentQuestionNew", back_populates="domain", cascade="all, delete-orphan")


class AssessmentTrack(Base):
    __tablename__ = "assessment_tracks"

    Track_ID = Column(Integer, primary_key=True, index=True)
    Domain_ID = Column(Integer, ForeignKey("assessment_domains.Domain_ID", ondelete="CASCADE"), nullable=False)
    Name = Column(String, nullable=False)  # "Beginner", "Intermediate", "Advanced"
    Order_Index = Column(Integer, default=0)

    domain = relationship("AssessmentDomain", back_populates="tracks")
    sub_levels = relationship("AssessmentSubLevel", back_populates="track", cascade="all, delete-orphan")


class AssessmentSubLevel(Base):
    __tablename__ = "assessment_sub_levels"

    Sub_Level_ID = Column(Integer, primary_key=True, index=True)
    Track_ID = Column(Integer, ForeignKey("assessment_tracks.Track_ID", ondelete="CASCADE"), nullable=False)
    Level_Number = Column(Integer, nullable=False)  # 1 to 5
    Name = Column(String, nullable=False)  # e.g., "Level 1"
    Question_Count = Column(Integer, default=25)
    Pass_Threshold_Percent = Column(Float, default=70.0)
    Time_Limit_Minutes = Column(Integer, default=30)

    track = relationship("AssessmentTrack", back_populates="sub_levels")
    questions = relationship("AssessmentQuestionNew", back_populates="sub_level", cascade="all, delete-orphan")
    attempts = relationship("AssessmentAttemptNew", back_populates="sub_level", cascade="all, delete-orphan")
    user_progresses = relationship("CandidateProgress", back_populates="sub_level", cascade="all, delete-orphan")


class AssessmentQuestionNew(Base):
    __tablename__ = "assessment_questions_new"

    Question_ID = Column(Integer, primary_key=True, index=True)
    Sub_Level_ID = Column(Integer, ForeignKey("assessment_sub_levels.Sub_Level_ID", ondelete="CASCADE"), nullable=False)
    Domain_ID = Column(Integer, ForeignKey("assessment_domains.Domain_ID", ondelete="CASCADE"), nullable=False)
    Question_Text = Column(String, nullable=False)
    Options = Column(JSON, nullable=False)  # JSON array of 4 choices
    Correct_Option_Index = Column(Integer, nullable=False)  # 0 to 3
    Explanation = Column(String, nullable=True)
    Difficulty_Tag = Column(String, nullable=True)  # Beginner, Intermediate, Advanced
    Created_At = Column(DateTime, default=datetime.datetime.utcnow)
    Is_Published = Column(Boolean, default=True, nullable=False)

    sub_level = relationship("AssessmentSubLevel", back_populates="questions")
    domain = relationship("AssessmentDomain", back_populates="questions")
    answers = relationship("AttemptAnswerNew", back_populates="question", cascade="all, delete-orphan")


class AssessmentAttemptNew(Base):
    __tablename__ = "assessment_attempts_new"

    Attempt_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Sub_Level_ID = Column(Integer, ForeignKey("assessment_sub_levels.Sub_Level_ID", ondelete="CASCADE"), nullable=False)
    Started_At = Column(DateTime, default=datetime.datetime.utcnow)
    Submitted_At = Column(DateTime, nullable=True)
    Score_Percent = Column(Float, nullable=True)
    Correct_Count = Column(Integer, nullable=True)
    Incorrect_Count = Column(Integer, nullable=True)
    Skipped_Count = Column(Integer, nullable=True)
    Time_Taken_Seconds = Column(Integer, nullable=True)
    Is_Passed = Column(Boolean, default=False)
    Attempt_Number = Column(Integer, default=1)

    candidate = relationship("Candidate", back_populates="assessment_attempts")
    sub_level = relationship("AssessmentSubLevel", back_populates="attempts")
    answers = relationship("AttemptAnswerNew", back_populates="attempt", cascade="all, delete-orphan")


class AttemptAnswerNew(Base):
    __tablename__ = "attempt_answers_new"

    Answer_ID = Column(Integer, primary_key=True, index=True)
    Attempt_ID = Column(Integer, ForeignKey("assessment_attempts_new.Attempt_ID", ondelete="CASCADE"), nullable=False)
    Question_ID = Column(Integer, ForeignKey("assessment_questions_new.Question_ID", ondelete="CASCADE"), nullable=False)
    Selected_Option_Index = Column(Integer, nullable=True)  # Null if skipped
    Is_Correct = Column(Boolean, default=False)

    attempt = relationship("AssessmentAttemptNew", back_populates="answers")
    question = relationship("AssessmentQuestionNew", back_populates="answers")


class CandidateProgress(Base):
    __tablename__ = "candidate_progress"

    Progress_ID = Column(Integer, primary_key=True, index=True)
    Candidate_ID = Column(Integer, ForeignKey("candidates.Candidate_ID", ondelete="CASCADE"), nullable=False)
    Sub_Level_ID = Column(Integer, ForeignKey("assessment_sub_levels.Sub_Level_ID", ondelete="CASCADE"), nullable=False)
    Best_Score_Percent = Column(Float, default=0.0)
    Is_Unlocked = Column(Boolean, default=False)
    Is_Completed = Column(Boolean, default=False)
    Attempts_Count = Column(Integer, default=0)
    Last_Attempted_At = Column(DateTime, nullable=True)

    candidate = relationship("Candidate", back_populates="progress")
    sub_level = relationship("AssessmentSubLevel", back_populates="user_progresses")


class CandidateOTP(Base):
    __tablename__ = "candidate_otps"

    OTP_ID = Column(Integer, primary_key=True, index=True)
    Email = Column(String, unique=True, index=True, nullable=False)
    OTP_Code = Column(String, nullable=False)
    Expires_At = Column(DateTime, nullable=False)
