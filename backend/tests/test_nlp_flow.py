import requests
import os
import json
import time

BASE_URL = "http://localhost:8000"

def run_nlp_tests():
    print("=== STARTING TALENTLENS AI NLP CORE TESTS ===")

    # 1. Register a Recruiter
    print("\n[1] Registering a new recruiter...")
    reg_payload = {
        "Name": "NLP Recruiter",
        "Email": "nlp.recruiter@example.com",
        "Role": "Recruiter",
        "Password": "password123"
    }
    
    try:
        reg_res = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
        if reg_res.status_code == 400:
            print(" -> User already registered. Proceeding to login.")
        else:
            reg_res.raise_for_status()
            print(" -> Registration successful.")
    except Exception as e:
        print(f" -> Registration status check: {e}")

    # 2. Login User
    print("\n[2] Logging in to retrieve JWT token...")
    login_payload = {
        "Email": "nlp.recruiter@example.com",
        "Password": "password123"
    }
    login_res = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_res.raise_for_status()
    login_data = login_res.json()
    token = login_data["access_token"]
    print(f" -> Login successful. Token obtained: {token[:20]}...")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 3. Create a Job with specifications
    print("\n[3] Creating a new job with required skills and min education...")
    job_payload = {
        "Job_Title": "Backend Engineer",
        "Department": "Platform Engineering",
        "Description": "We need a Backend Developer to build Python FastAPI backends and design PostgreSQL databases.",
        "Required_Skills": ["Python", "FastAPI", "React", "PostgreSQL"],
        "Preferred_Skills": ["AWS"],
        "Min_Experience": 2,
        "Min_Education": "Bachelor's",
        "Certifications": ["AWS Certified Solution Architect"],
        "Job_Type": "Full-time",
        "Location": "Seattle, WA",
        "Weights": {
            "required_skills": 35.0,
            "preferred_skills": 15.0,
            "experience": 15.0,
            "education": 10.0,
            "projects": 10.0,
            "certifications": 5.0,
            "completeness": 5.0,
            "semantic_fit": 5.0
        }
    }
    job_res = requests.post(f"{BASE_URL}/jobs/", json=job_payload, headers=headers)
    job_res.raise_for_status()
    job_data = job_res.json()
    job_id = job_data["Job_ID"]
    print(f" -> Job created successfully. Job ID: {job_id}")

    # 4. Upload resume (John Doe)
    print("\n[4] Batch uploading resume for John Doe...")
    
    resume_path = "john_doe_resume.txt"
    if not os.path.exists(resume_path):
        resume_path = "tests/john_doe_resume.txt"

    with open(resume_path, "rb") as f_resume:
        files = [
            ("files", ("John_Doe_Resume.txt", f_resume, "text/plain"))
        ]
        upload_res = requests.post(f"{BASE_URL}/candidates/upload/{job_id}", files=files, headers=headers)
        upload_res.raise_for_status()
        upload_data = upload_res.json()
        print(" -> Upload and NLP Processing complete:")
        print(json.dumps(upload_data, indent=2))
        
        cand_id = upload_data["results"][0]["candidate_id"]
        p_status = upload_data["results"][0]["processing_status"]
        assert p_status == "Parsed", f"Expected Parsed state, got {p_status}"
        print(f"    [PASS] File successfully parsed and scored. Candidate ID: {cand_id}")

    # 5. Fetch Candidate details
    print("\n[5] Fetching Candidate profile details...")
    detail_res = requests.get(f"{BASE_URL}/candidates/{cand_id}/detail", headers=headers)
    detail_res.raise_for_status()
    detail_data = detail_res.json()
    print(" -> Candidate Profile Details (truncated):")
    print(f"    * Name: {detail_data['Name']} (Expected: John Doe)")
    print(f"    * Email: {detail_data['Email']} (Expected: john.doe@example.com)")
    print(f"    * Phone: {detail_data['Phone']} (Expected: +1-555-321-4321)")
    print(f"    * Location: {detail_data['Location']} (Expected: Seattle, Wa)")
    print(f"    * Educations: {detail_data['educations']}")
    print(f"    * Experiences: {detail_data['experiences']}")
    print(f"    * Skills extracted: {[s['Skill'] for s in detail_data['skills']]}")
    print(f"    * Projects: {detail_data['projects']}")
    print(f"    * Certifications: {detail_data['certifications']}")

    assert detail_data["Name"] == "John Doe", "Name extraction failed"
    assert detail_data["Email"] == "john.doe@example.com", "Email extraction failed"
    assert "Python" in [s["Skill"] for s in detail_data["skills"]], "Python skill extraction failed"
    assert len(detail_data["experiences"]) >= 1, "Experience extraction failed"
    assert detail_data["experiences"][0]["Is_Relevant"] == True, "Experience relevance check failed"
    print("    [PASS] Extracted structured profile details verified successfully.")

    # 6. Verify Sub-Scores
    print("\n[6] Verifying detailed Screening sub-scores...")
    screening_info = detail_data["screening_results"][0]
    print(json.dumps(screening_info, indent=2))
    assert screening_info["Overall_Score"] > 70.0, f"Expected high overall score, got {screening_info['Overall_Score']}"
    assert screening_info["Experience_Score"] == 100.0, "Expected full experience score (24 relevant months / 24 min months)"
    assert screening_info["Education_Score"] == 100.0, "Expected Bachelor's match"
    print("    [PASS] Screening sub-scores are calculated accurately.")

    # 7. Rescore candidate
    print("\n[7] Triggering manual candidate re-scoring...")
    rescore_res = requests.post(f"{BASE_URL}/candidates/{cand_id}/rescore", headers=headers)
    rescore_res.raise_for_status()
    rescore_data = rescore_res.json()
    print(" -> Rescore Result:")
    print(json.dumps(rescore_data, indent=2))
    assert rescore_data["Overall_Score"] == screening_info["Overall_Score"]
    print("    [PASS] Re-score operates successfully.")

    print("\n=== ALL NLP CORE INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_nlp_tests()
