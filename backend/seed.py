import os
import sys
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
from auth import get_password_hash
from parser import parse_resume_full
from scoring import score_candidate

# Mock resume contents with fabricated candidate details
MOCK_RESUMES = {
    "jane_smith_resume.txt": """Jane Smith
Email: jane.smith@example.com
Phone: +1-555-0199
Location: New York, NY

Education
Bachelor of Science in Computer Science
State University, Class of 2020

Experience
Software Engineer at DevCorp (2020 - 2024)
Developed responsive web frontends using React, Redux, and TypeScript. Collaborated with designers to deliver premium pixel-perfect UI dashboards.
Web Developer at Freelance (2019 - 2020)
Built static websites using HTML, CSS, Tailwind CSS, and vanilla JavaScript.

Skills
React, TypeScript, Redux, JavaScript, HTML, CSS, Tailwind CSS, Git

Projects
Project: Task Dashboard
Technologies: React, Redux. Developed a beautiful task scheduler with Kanban board.
""",

    "bob_miller_resume.txt": """Bob Miller
Email: bob.miller@example.com
Phone: +1-555-0155
Location: Chicago, IL

Education
Master of Technology in Software Engineering
Tech Institute of Chicago, Class of 2018

Experience
Senior Backend Architect at CloudSystems (2018 - 2024)
Designed high-performance backend microservices using Python and FastAPI. Managed databases with PostgreSQL and Redis cache structures. Built containerized environments with Docker.
Software Engineer at WebSolutions (2016 - 2018)
Developed database-driven web applications using Django and SQL databases.

Skills
Python, FastAPI, Django, PostgreSQL, SQL, Redis, Docker, Git, AWS

Projects
Project: Payment Broker
Technologies: Python, FastAPI, Docker. Built an asynchronous payment processing microservice.

Certifications
AWS Certified Solution Architect
""",

    "alice_jones_resume.txt": """Alice Jones
Email: alice.jones@example.com
Phone: +1-555-0144
Location: Boston, MA

Education
Bachelor of Science in Information Technology
Boston College, Class of 2024

Experience
Hiring Intern at AlphaCorp (2023 - 2024)
Assisted HR managers with coordinate scheduling.

Skills
JavaScript, HTML, CSS, Git

Projects
Project: Personal Portfolio
Technologies: HTML, CSS. Designed static resume homepage.
""",

    "charlie_davis_resume.txt": """Charlie Davis
Email: charlie.davis@example.com
Phone: +1-555-0122
Location: Austin, TX

Education
Associate Degree in Applied Science
Austin Community College, Class of 2022

Experience
Junior Developer at Codebase LLC (2022 - 2024)
Assisted senior architects in coding backend scripts using Python and Django. Wrote queries on MySQL databases.

Skills
Python, Django, MySQL, SQL, Git
"""
}

def seed_database():
    print("=== SEEDING TALENTLENS AI MOCK DATABASE ===")
    
    # 1. Recreate tables
    print(" -> Resetting database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # 2. Seed Users
        print(" -> Seeding users...")
        admin_hash = get_password_hash("password123")
        recruiter_hash = get_password_hash("password123")
        
        admin = models.User(
            Name="Hasan Admin",
            Email="admin@talentlens.ai",
            Role="Admin",
            PasswordHash=admin_hash
        )
        recruiter1 = models.User(
            Name="Priya Recruiter",
            Email="recruiter@talentlens.ai",
            Role="Recruiter",
            PasswordHash=recruiter_hash
        )
        recruiter2 = models.User(
            Name="Hiring Manager",
            Email="hiring.mgr@talentlens.ai",
            Role="Recruiter",
            PasswordHash=recruiter_hash
        )
        
        db.add(admin)
        db.add(recruiter1)
        db.add(recruiter2)
        db.commit()
        db.refresh(admin)
        db.refresh(recruiter1)
        
        # 3. Seed Jobs
        print(" -> Seeding positions...")
        job1 = models.Job(
            Job_Title="Senior React Developer",
            Department="Frontend Engineering",
            Description="We are looking for a Senior React Engineer to design responsive, glassmorphic dashboards using React, Redux, and TypeScript.",
            Required_Skills=["React", "TypeScript", "Redux"],
            Preferred_Skills=["Tailwind CSS", "Next.js"],
            Min_Experience=3,
            Min_Education="Bachelor's",
            Certifications=[],
            Job_Type="Full-time",
            Location="New York, NY",
            Created_By=recruiter1.User_ID,
            Blind_Mode=True, # Active blind mode for demoing anonymization
            Strong_Threshold=85.0,
            Good_Threshold=70.0,
            Potential_Threshold=50.0
        )
        
        job2 = models.Job(
            Job_Title="Python Backend Architect",
            Department="Platform Infrastructure",
            Description="Hiring a Backend Architect to design robust FastAPI microservices, containerize workflows with Docker, and manage PostgreSQL databases.",
            Required_Skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
            Preferred_Skills=["AWS", "Redis"],
            Min_Experience=5,
            Min_Education="Master's",
            Certifications=["AWS Certified Solution Architect"],
            Job_Type="Full-time",
            Location="Chicago, IL",
            Created_By=recruiter1.User_ID,
            Blind_Mode=False,
            Strong_Threshold=85.0,
            Good_Threshold=70.0,
            Potential_Threshold=50.0
        )
        
        db.add(job1)
        db.add(job2)
        db.commit()
        db.refresh(job1)
        db.refresh(job2)

        # Seed default weights for Jobs
        default_weights = {
            "required_skills": 35.0,
            "preferred_skills": 15.0,
            "experience": 15.0,
            "education": 10.0,
            "projects": 10.0,
            "certifications": 5.0,
            "completeness": 5.0,
            "semantic_fit": 5.0
        }
        
        for job_id in [job1.Job_ID, job2.Job_ID]:
            for category, weight in default_weights.items():
                w_entry = models.JobSkillWeight(Job_ID=job_id, Category=category, Weight=weight)
                db.add(w_entry)
        db.commit()

        # 4. Seed Candidates
        print(" -> Ingesting mock candidate resumes...")
        os.makedirs("uploads/1", exist_ok=True)
        os.makedirs("uploads/2", exist_ok=True)

        # Ingest Jane Smith to Job 1 (React)
        file_path_1 = "uploads/1/Jane_Smith_Resume.txt"
        with open(file_path_1, "w", encoding="utf-8") as f:
            f.write(MOCK_RESUMES["jane_smith_resume.txt"])
            
        cand1 = models.Candidate(
            Name="Jane Smith",
            Email=None,
            Phone=None,
            Location=None,
            Resume_File_Path=file_path_1,
            Processing_Status="Pending",
            Job_ID=job1.Job_ID
        )
        db.add(cand1)
        db.commit()
        db.refresh(cand1)
        
        # Parse and Score Jane Smith
        parsed_data_1 = parse_resume_full(file_path_1, "Jane_Smith_Resume.txt")
        # Save to DB
        cand1.Name = parsed_data_1.get("Name", cand1.Name)
        cand1.Email = parsed_data_1.get("Email")
        cand1.Phone = parsed_data_1.get("Phone")
        cand1.Location = parsed_data_1.get("Location")
        cand1.Processing_Status = "Parsed"
        db.commit()
        
        for sk in parsed_data_1.get("skills", []):
            db.add(models.CandidateSkill(Candidate_ID=cand1.Candidate_ID, Skill=sk["Skill"], Skill_Level=sk["Skill_Level"], Evidence_Text=sk["Evidence_Text"]))
        for ex in parsed_data_1.get("experiences", []):
            db.add(models.CandidateExperience(Candidate_ID=cand1.Candidate_ID, Company=ex["Company"], Role=ex["Role"], Duration_Months=ex["Duration_Months"], Description=ex["Description"], Is_Relevant=ex["Is_Relevant"]))
        for ed in parsed_data_1.get("educations", []):
            db.add(models.CandidateEducation(Candidate_ID=cand1.Candidate_ID, Degree=ed["Degree"], Institution=ed["Institution"], Graduation_Year=ed["Graduation_Year"]))
        for pr in parsed_data_1.get("projects", []):
            db.add(models.CandidateProject(Candidate_ID=cand1.Candidate_ID, Project_Name=pr["Project_Name"], Technologies=pr["Technologies"], Description=pr["Description"]))
        db.commit()
        score_candidate(cand1.Candidate_ID, job1.Job_ID, db)

        # Ingest Bob Miller to Job 2 (Python)
        file_path_2 = "uploads/2/Bob_Miller_Resume.txt"
        with open(file_path_2, "w", encoding="utf-8") as f:
            f.write(MOCK_RESUMES["bob_miller_resume.txt"])
            
        cand2 = models.Candidate(
            Name="Bob Miller",
            Email=None,
            Phone=None,
            Location=None,
            Resume_File_Path=file_path_2,
            Processing_Status="Pending",
            Job_ID=job2.Job_ID
        )
        db.add(cand2)
        db.commit()
        db.refresh(cand2)
        
        parsed_data_2 = parse_resume_full(file_path_2, "Bob_Miller_Resume.txt")
        cand2.Name = parsed_data_2.get("Name", cand2.Name)
        cand2.Email = parsed_data_2.get("Email")
        cand2.Phone = parsed_data_2.get("Phone")
        cand2.Location = parsed_data_2.get("Location")
        cand2.Processing_Status = "Parsed"
        db.commit()
        
        for sk in parsed_data_2.get("skills", []):
            db.add(models.CandidateSkill(Candidate_ID=cand2.Candidate_ID, Skill=sk["Skill"], Skill_Level=sk["Skill_Level"], Evidence_Text=sk["Evidence_Text"]))
        for ex in parsed_data_2.get("experiences", []):
            db.add(models.CandidateExperience(Candidate_ID=cand2.Candidate_ID, Company=ex["Company"], Role=ex["Role"], Duration_Months=ex["Duration_Months"], Description=ex["Description"], Is_Relevant=ex["Is_Relevant"]))
        for ed in parsed_data_2.get("educations", []):
            db.add(models.CandidateEducation(Candidate_ID=cand2.Candidate_ID, Degree=ed["Degree"], Institution=ed["Institution"], Graduation_Year=ed["Graduation_Year"]))
        for pr in parsed_data_2.get("projects", []):
            db.add(models.CandidateProject(Candidate_ID=cand2.Candidate_ID, Project_Name=pr["Project_Name"], Technologies=pr["Technologies"], Description=pr["Description"]))
        for cr in parsed_data_2.get("certifications", []):
            db.add(models.CandidateCertification(Candidate_ID=cand2.Candidate_ID, Certification_Name=cr["Certification_Name"], Issuing_Org=cr["Issuing_Org"]))
        db.commit()
        score_candidate(cand2.Candidate_ID, job2.Job_ID, db)

        # Ingest Alice Jones (Fresher) to Job 1 (React)
        file_path_3 = "uploads/1/Alice_Jones_Resume.txt"
        with open(file_path_3, "w", encoding="utf-8") as f:
            f.write(MOCK_RESUMES["alice_jones_resume.txt"])
            
        cand3 = models.Candidate(
            Name="Alice Jones",
            Email=None,
            Phone=None,
            Location=None,
            Resume_File_Path=file_path_3,
            Processing_Status="Pending",
            Job_ID=job1.Job_ID
        )
        db.add(cand3)
        db.commit()
        db.refresh(cand3)
        
        parsed_data_3 = parse_resume_full(file_path_3, "Alice_Jones_Resume.txt")
        cand3.Name = parsed_data_3.get("Name", cand3.Name)
        cand3.Email = parsed_data_3.get("Email")
        cand3.Phone = parsed_data_3.get("Phone")
        cand3.Location = parsed_data_3.get("Location")
        cand3.Processing_Status = "Parsed"
        db.commit()
        
        for sk in parsed_data_3.get("skills", []):
            db.add(models.CandidateSkill(Candidate_ID=cand3.Candidate_ID, Skill=sk["Skill"], Skill_Level=sk["Skill_Level"], Evidence_Text=sk["Evidence_Text"]))
        for ex in parsed_data_3.get("experiences", []):
            db.add(models.CandidateExperience(Candidate_ID=cand3.Candidate_ID, Company=ex["Company"], Role=ex["Role"], Duration_Months=ex["Duration_Months"], Description=ex["Description"], Is_Relevant=ex["Is_Relevant"]))
        for ed in parsed_data_3.get("educations", []):
            db.add(models.CandidateEducation(Candidate_ID=cand3.Candidate_ID, Degree=ed["Degree"], Institution=ed["Institution"], Graduation_Year=ed["Graduation_Year"]))
        for pr in parsed_data_3.get("projects", []):
            db.add(models.CandidateProject(Candidate_ID=cand3.Candidate_ID, Project_Name=pr["Project_Name"], Technologies=pr["Technologies"], Description=pr["Description"]))
        db.commit()
        score_candidate(cand3.Candidate_ID, job1.Job_ID, db)

        # Ingest Charlie Davis to Job 2 (Python)
        file_path_4 = "uploads/2/Charlie_Davis_Resume.txt"
        with open(file_path_4, "w", encoding="utf-8") as f:
            f.write(MOCK_RESUMES["charlie_davis_resume.txt"])
            
        cand4 = models.Candidate(
            Name="Charlie Davis",
            Email=None,
            Phone=None,
            Location=None,
            Resume_File_Path=file_path_4,
            Processing_Status="Pending",
            Job_ID=job2.Job_ID
        )
        db.add(cand4)
        db.commit()
        db.refresh(cand4)
        
        parsed_data_4 = parse_resume_full(file_path_4, "Charlie_Davis_Resume.txt")
        cand4.Name = parsed_data_4.get("Name", cand4.Name)
        cand4.Email = parsed_data_4.get("Email")
        cand4.Phone = parsed_data_4.get("Phone")
        cand4.Location = parsed_data_4.get("Location")
        cand4.Processing_Status = "Parsed"
        db.commit()
        
        for sk in parsed_data_4.get("skills", []):
            db.add(models.CandidateSkill(Candidate_ID=cand4.Candidate_ID, Skill=sk["Skill"], Skill_Level=sk["Skill_Level"], Evidence_Text=sk["Evidence_Text"]))
        for ex in parsed_data_4.get("experiences", []):
            db.add(models.CandidateExperience(Candidate_ID=cand4.Candidate_ID, Company=ex["Company"], Role=ex["Role"], Duration_Months=ex["Duration_Months"], Description=ex["Description"], Is_Relevant=ex["Is_Relevant"]))
        for ed in parsed_data_4.get("educations", []):
            db.add(models.CandidateEducation(Candidate_ID=cand4.Candidate_ID, Degree=ed["Degree"], Institution=ed["Institution"], Graduation_Year=ed["Graduation_Year"]))
        db.commit()
        score_candidate(cand4.Candidate_ID, job2.Job_ID, db)

        # Seed candidate 5 as a Corrupted PDF file for failed state demo
        file_path_5 = "uploads/1/Corrupted_Structure_Resume.pdf"
        with open(file_path_5, "wb") as f:
            f.write(b"NOT A REAL PDF CORE HEADERS")
            
        cand5 = models.Candidate(
            Name="Corrupted File Demo",
            Email=None,
            Phone=None,
            Location=None,
            Resume_File_Path=file_path_5,
            Processing_Status="Failed",
            Job_ID=job1.Job_ID
        )
        db.add(cand5)
        db.commit()
        db.refresh(cand5)
        
        # Log to Audit Trail
        db.add(models.AuditLog(
            User_ID=admin.User_ID,
            Action="Candidate Processing",
            Details=f"Processed resume '{os.path.basename(file_path_5)}' for job ID {job1.Job_ID}. FAILED: File magic number signature mismatch or corrupted structure."
        ))
        db.commit()

        # Seed initial Recruiter Decisions to verify reports/funnel
        dec1 = models.RecruiterDecision(
            Candidate_ID=cand1.Candidate_ID,
            Recruiter_ID=recruiter1.User_ID,
            Decision="Shortlist",
            Reason="Exceeds required frontend parameters. Strong portfolio projects."
        )
        dec2 = models.RecruiterDecision(
            Candidate_ID=cand2.Candidate_ID,
            Recruiter_ID=recruiter1.User_ID,
            Decision="Interview",
            Reason="Holds required AWS architect certification and shows extensive experience."
        )
        dec3 = models.RecruiterDecision(
            Candidate_ID=cand3.Candidate_ID,
            Recruiter_ID=recruiter1.User_ID,
            Decision="Reject",
            Reason="Candidate lacks any required skill parameters (React, TypeScript, Redux)."
        )
        
        db.add(dec1)
        db.add(dec2)
        db.add(dec3)
        db.commit()

        print("\n=== DATABASE SEEDING COMPLETED SUCCESSFULLY! ===")
        print(" -> Credentials created:")
        print("    * Admin Login:     admin@talentlens.ai     (password: password123)")
        print("    * Recruiter Login: recruiter@talentlens.ai (password: password123)")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
