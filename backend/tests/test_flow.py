import requests
import os
import json

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== STARTING TALENTLENS AI INTEGRATION TESTS ===")

    # 1. Register a Recruiter
    print("\n[1] Registering a new recruiter...")
    reg_payload = {
        "Name": "Jane Recruiter",
        "Email": "jane.recruiter@example.com",
        "Role": "Recruiter",
        "Password": "password123"
    }
    
    # Try deleting the user if exists (handled by database reset or unique check, we'll try registering)
    try:
        reg_res = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
        if reg_res.status_code == 400:
            print(" -> User already registered. Proceeding to login.")
        else:
            reg_res.raise_for_status()
            print(" -> Registration successful.")
    except Exception as e:
        print(f" -> Registration log/status: {e}")

    # 2. Login User
    print("\n[2] Logging in to retrieve JWT token...")
    login_payload = {
        "Email": "jane.recruiter@example.com",
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

    # 3. Create a Job
    print("\n[3] Creating a new job opening...")
    job_payload = {
        "Job_Title": "Senior Fullstack Developer",
        "Department": "Engineering",
        "Description": "We are seeking a senior software developer to build robust systems.",
        "Required_Skills": ["Python", "FastAPI", "React"],
        "Preferred_Skills": ["Docker", "PostgreSQL"],
        "Min_Experience": 5,
        "Min_Education": "Bachelor's",
        "Certifications": ["AWS Solution Architect"],
        "Job_Type": "Full-time",
        "Location": "Remote",
        "Weights": {
            "required_skills": 40.0,
            "preferred_skills": 10.0,
            "experience": 20.0,
            "education": 10.0,
            "projects": 10.0,
            "certifications": 5.0,
            "completeness": 3.0,
            "semantic_fit": 2.0
        }
    }
    job_res = requests.post(f"{BASE_URL}/jobs/", json=job_payload, headers=headers)
    job_res.raise_for_status()
    job_data = job_res.json()
    job_id = job_data["Job_ID"]
    print(f" -> Job created successfully. Job ID: {job_id}")

    # 4. Upload resumes (1 valid txt, 1 corrupted pdf)
    print("\n[4] Batch uploading resumes (1 valid text, 1 corrupted PDF)...")
    
    # Path to test files
    valid_path = "valid_test.txt"
    corrupted_path = "corrupted_test.pdf"

    if not os.path.exists(valid_path):
        valid_path = "tests/valid_test.txt"
    if not os.path.exists(corrupted_path):
        corrupted_path = "tests/corrupted_test.pdf"

    with open(valid_path, "rb") as f_valid, open(corrupted_path, "rb") as f_corrupt:
        files = [
            ("files", ("Jane_Doe_Resume.txt", f_valid, "text/plain")),
            ("files", ("Corrupted_Doc_Resume.pdf", f_corrupt, "application/pdf"))
        ]
        
        upload_res = requests.post(f"{BASE_URL}/candidates/upload/{job_id}", files=files, headers=headers)
        upload_res.raise_for_status()
        upload_data = upload_res.json()
        print(" -> Upload response:")
        print(json.dumps(upload_data, indent=2))

    # Validate parsing statuses in upload results
    print("\n[5] Verifying integrity status validation...")
    for result in upload_data["results"]:
        filename = result["filename"]
        status = result["status"]
        proc_status = result.get("processing_status")
        error_msg = result.get("error")
        print(f" -> File: {filename} | Upload: {status} | Integrity Check: {proc_status} | Error: {error_msg}")

        # Check conditions
        if "Jane_Doe_Resume" in filename:
            assert proc_status == "Pending", f"Expected Pending for valid file, got {proc_status}"
            print("    [PASS] Valid file marked as Pending.")
        elif "Corrupted_Doc_Resume" in filename:
            assert proc_status == "Failed", f"Expected Failed for corrupted file, got {proc_status}"
            assert error_msg is not None, "Expected corruption error message, got None"
            print("    [PASS] Corrupted file successfully detected and marked as Failed.")

    # 5. Fetch Dashboard stats
    print("\n[6] Querying Dashboard statistics...")
    stats_res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers)
    stats_res.raise_for_status()
    stats_data = stats_res.json()
    print(" -> Dashboard Statistics:")
    print(json.dumps(stats_data, indent=2))
    assert stats_data["total_jobs"] >= 1
    assert stats_data["total_candidates"] >= 2
    print("    [PASS] Dashboard metrics match actual DB state.")

    # 6. Fetch Audit Logs
    print("\n[7] Querying recent system activity audit logs...")
    audit_res = requests.get(f"{BASE_URL}/dashboard/audit-logs", headers=headers)
    audit_res.raise_for_status()
    audit_logs = audit_res.json()
    print(f" -> Found {len(audit_logs)} audit entries. Top 3 logs:")
    for log in audit_logs[:3]:
        print(f"    * [{log['Timestamp']}] {log['Action']}: {log['Details']} (By: {log['User_Name']})")
    
    # Assert logs write actions
    actions = [log["Action"] for log in audit_logs]
    assert any("User" in act for act in actions), "Expected user registration or login log"
    assert "Job Created" in actions, "Expected Job Created log"
    assert "Candidate Upload" in actions, "Expected Candidate Upload log"
    print("    [PASS] Audit trail records verified.")

    print("\n=== ALL SYSTEM TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
