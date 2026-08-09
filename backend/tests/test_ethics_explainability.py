import requests
import os
import json

BASE_URL = "http://localhost:8000"

def run_ethics_explainability_tests():
    print("=== STARTING PHASE 3 ETHICS & EXPLAINABILITY INTEGRATION TESTS ===")

    # 1. Register a Recruiter
    print("\n[1] Registering a new recruiter...")
    reg_payload = {
        "Name": "Ethics Officer",
        "Email": "ethics.officer@example.com",
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
        print(f" -> Registration: {e}")

    # 2. Login User
    print("\n[2] Logging in to retrieve JWT token...")
    login_payload = {
        "Email": "ethics.officer@example.com",
        "Password": "password123"
    }
    login_res = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_res.raise_for_status()
    login_data = login_res.json()
    token = login_data["access_token"]
    print(f" -> Login successful. Token: {token[:20]}...")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 3. Verify Codebase compliance audit endpoint
    print("\n[3] Testing /jobs/ethical-check compliance audit...")
    audit_res = requests.get(f"{BASE_URL}/jobs/ethical-check", headers=headers)
    audit_res.raise_for_status()
    audit_data = audit_res.json()
    print(" -> Compliance Audit Details:")
    print(json.dumps(audit_data, indent=2))
    assert audit_data["ethical_screening_active"] is True, "Ethical screening is not compliant!"
    print("    [PASS] System confirmed compliant (No protected attributes found in schemas/tables).")

    # 4. Create a Job with Blind Screening Active & thresholds
    print("\n[4] Creating a Job description with Blind Mode active...")
    job_payload = {
        "Job_Title": "Ethics Engineer",
        "Department": "Compliance",
        "Description": "Looking for a Software Engineer to build Python FastAPI backends and React frontends.",
        "Required_Skills": ["Python", "FastAPI", "React"],
        "Preferred_Skills": ["AWS"],
        "Min_Experience": 2,
        "Min_Education": "Bachelor's",
        "Certifications": ["AWS Certified Solution Architect"],
        "Job_Type": "Full-time",
        "Location": "Seattle, WA",
        "Weights": {
            "required_skills": 30.0,
            "preferred_skills": 15.0,
            "experience": 15.0,
            "education": 10.0,
            "projects": 10.0,
            "certifications": 10.0,
            "completeness": 5.0,
            "semantic_fit": 5.0
        },
        "Blind_Mode": True,
        "Strong_Threshold": 85.0,
        "Good_Threshold": 70.0,
        "Potential_Threshold": 50.0
    }
    job_res = requests.post(f"{BASE_URL}/jobs/", json=job_payload, headers=headers)
    job_res.raise_for_status()
    job_data = job_res.json()
    job_id = job_data["Job_ID"]
    print(f" -> Job created. ID: {job_id}. Blind Mode: {job_data['Blind_Mode']}")
    assert job_data["Blind_Mode"] is True, "Blind mode expected to be True"

    # 5. Upload resume for John Doe
    print("\n[5] Uploading resume and parsing structured parameters...")
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
        print(f" -> Candidate processed. ID: {upload_data['results'][0]['candidate_id']}")

    cand_id = upload_data["results"][0]["candidate_id"]

    # 6. Retrieve candidate details and check for anonymization
    print("\n[6] Getting Candidate details under active Blind Mode...")
    detail_res = requests.get(f"{BASE_URL}/candidates/{cand_id}/detail", headers=headers)
    detail_res.raise_for_status()
    detail_data = detail_res.json()
    print(f" -> Anonymized Candidate Name: {detail_data['Name']} (Expected: Candidate #{cand_id})")
    print(f" -> Email: {detail_data['Email']} (Expected: [HIDDEN])")
    print(f" -> Phone: {detail_data['Phone']} (Expected: [HIDDEN])")
    print(f" -> Location: {detail_data['Location']} (Expected: [HIDDEN])")
    
    assert detail_data["Name"] == f"Candidate #{cand_id}", "Name is not masked correctly"
    assert detail_data["Email"] == "[HIDDEN]", "Email is not masked correctly"
    assert detail_data["Phone"] == "[HIDDEN]", "Phone is not masked correctly"
    assert detail_data["Location"] == "[HIDDEN]", "Location is not masked correctly"
    print("    [PASS] Candidate details are fully anonymized.")

    # 7. Check Explainability & AI confidence
    print("\n[7] Verifying explainability sub-scores, strengths, gaps, and confidence...")
    screening = detail_data["screening_results"][0]
    explanation = screening["Explanation"]
    print(" -> Screening Results & Explanation:")
    print(f"    * AI Match Confidence: {screening['Confidence_Level']} (Expected: High/Medium/Low)")
    print(f"    * Label Recommendation: {explanation['recommendation']} (Expected: Strong/Good Match)")
    print(f"    * Strengths: {explanation['strengths']}")
    print(f"    * Gaps: {explanation['gaps']}")
    print(f"    * Missing Skills: {explanation['missing_skills']}")

    assert "recommendation" in explanation, "Recommendation label missing"
    assert "strengths" in explanation, "Strengths missing"
    assert "gaps" in explanation, "Gaps missing"
    assert len(explanation["strengths"]) > 0, "Expected strengths listed"
    print("    [PASS] Structured explainability card elements verified.")

    # 8. Test Reveal Candidate Identity (with Reason logging)
    print("\n[8] Testing candidate identity reveal with reason audit trail...")
    reveal_payload = {
        "Reason": "DISCLOSING IDENTITY TO CONDUCT A TECHNICAL SCREENING PHONE CALL"
    }
    reveal_res = requests.post(f"{BASE_URL}/candidates/{cand_id}/reveal", json=reveal_payload, headers=headers)
    reveal_res.raise_for_status()
    reveal_data = reveal_res.json()
    print(f" -> Disclosed Candidate Name: {reveal_data['Name']} (Expected: John Doe)")
    print(f" -> Email: {reveal_data['Email']} (Expected: john.doe@example.com)")
    
    assert reveal_data["Name"] == "John Doe", "Name reveal failed"
    assert reveal_data["Email"] == "john.doe@example.com", "Email reveal failed"
    print("    [PASS] Identity disclosed and unmasked correctly.")

    # 9. Verify Audit logs have reveal action
    print("\n[9] Checking permanent audit log trail for the reveal event...")
    logs_res = requests.get(f"{BASE_URL}/dashboard/audit-logs", headers=headers)
    logs_res.raise_for_status()
    logs_data = logs_res.json()
    reveal_log = next((log for log in logs_data if log["Action"] == "Candidate Identity Revealed"), None)
    print(f" -> Reveal Event Audit Log details: {reveal_log['Details'] if reveal_log else 'NOT FOUND'}")
    assert reveal_log is not None, "Candidate Identity Revealed audit log entry missing"
    assert "Reason: DISCLOSING IDENTITY" in reveal_log["Details"], "Audit log missing reason justification"
    print("    [PASS] Identity reveal event & justification reason successfully logged.")

    # 10. Test What-If Preview simulation
    print("\n[10] Testing What-If Analysis preview simulation (In-memory)...")
    what_if_payload = {
        "Required_Skills": ["Python", "FastAPI", "React", "Rust"],  # Added "Rust" which candidate doesn't have
        "Preferred_Skills": ["AWS"],
        "Weights": {
            "required_skills": 80.0,  # Increase required skills weight heavily
            "preferred_skills": 5.0,
            "experience": 5.0,
            "education": 2.0,
            "projects": 2.0,
            "certifications": 2.0,
            "completeness": 2.0,
            "semantic_fit": 2.0
        }
    }
    
    what_if_res = requests.post(f"{BASE_URL}/jobs/{job_id}/what-if", json=what_if_payload, headers=headers)
    what_if_res.raise_for_status()
    what_if_data = what_if_res.json()
    print(" -> What-If Recalculation Results:")
    print(json.dumps(what_if_data, indent=2))
    
    candidate_preview = what_if_data["candidates"][0]
    print(f"    * Old Score: {candidate_preview['Old_Score']}%")
    print(f"    * New Simulated Score: {candidate_preview['New_Score']}%")
    
    # Assert score changed due to missing required skill and heavy weights
    assert candidate_preview["New_Score"] < candidate_preview["Old_Score"], "Simulation score did not drop"
    
    # Double check database was not updated
    recheck_detail = requests.get(f"{BASE_URL}/candidates/{cand_id}/detail", headers=headers).json()
    recheck_score = recheck_detail["screening_results"][0]["Overall_Score"]
    print(f"    * Verifying DB overall score remains unmodified: {recheck_score}%")
    assert recheck_score == candidate_preview["Old_Score"], "What-If preview modified database state!"
    print("    [PASS] What-If preview calculated successfully in-memory.")

    print("\n=== ALL ETHICS & EXPLAINABILITY INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_ethics_explainability_tests()
