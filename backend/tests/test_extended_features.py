import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== STARTING PHASE 5 EXTENDED FEATURES INTEGRATION TESTS ===")

    # 1. Login as Recruiter
    print("\n[1] Logging in as Recruiter...")
    login_data = {
        "Email": "recruiter@talentlens.ai",
        "Password": "password123"
    }
    r_login = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if r_login.status_code != 200:
        print(f" -> ERROR: Recruiter login failed. Status code: {r_login.status_code}")
        sys.exit(1)
        
    recruiter_token = r_login.json()["access_token"]
    recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}
    print(" -> Recruiter login successful.")

    # 2. Login as Admin
    print("\n[2] Logging in as Admin...")
    r_admin_login = requests.post(f"{BASE_URL}/auth/login", json={
        "Email": "admin@talentlens.ai",
        "Password": "password123"
    })
    if r_admin_login.status_code != 200:
        print(f" -> ERROR: Admin login failed. Status code: {r_admin_login.status_code}")
        sys.exit(1)
        
    admin_token = r_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(" -> Admin login successful.")

    # Fetch job and candidate to schedule interview for
    # We can fetch first job and first candidate
    r_jobs = requests.get(f"{BASE_URL}/jobs/", headers=recruiter_headers)
    if r_jobs.status_code != 200 or len(r_jobs.json()) == 0:
        print(" -> ERROR: No jobs found. Please run seed.py first.")
        sys.exit(1)
    job_id = r_jobs.json()[0]["Job_ID"]

    r_cands = requests.get(f"{BASE_URL}/candidates/job/{job_id}", headers=recruiter_headers)
    if r_cands.status_code != 200 or len(r_cands.json()) == 0:
        print(" -> ERROR: No candidates found. Please run seed.py first.")
        sys.exit(1)
        
    # Find candidate
    cand_id = r_cands.json()[0]["Candidate_ID"]
    print(f" -> Testing on Candidate ID: {cand_id}, Job ID: {job_id}")

    # 3. Test Interview Scheduling during Decision flow
    print("\n[3] Testing Interview Scheduling flow...")
    interview_time = (datetime.utcnow() + timedelta(days=2)).isoformat()
    
    # Try scheduling with missing fields
    decision_payload_bad = {
        "Decision": "Interview",
        "Reason": "Let's schedule a chat",
        "Mode": "Online"
        # missing Interview_DateTime
    }
    r_dec_bad = requests.post(f"{BASE_URL}/candidates/{cand_id}/decision", json=decision_payload_bad, headers=recruiter_headers)
    print(f" -> Decision missing datetime returned status: {r_dec_bad.status_code} (Expected: 400)")
    assert r_dec_bad.status_code == 400

    decision_payload_good = {
        "Decision": "Interview",
        "Reason": "Great candidate for interview.",
        "Interview_DateTime": interview_time,
        "Mode": "Online",
        "Notes": "Teams link to be generated."
    }
    r_dec_good = requests.post(f"{BASE_URL}/candidates/{cand_id}/decision", json=decision_payload_good, headers=recruiter_headers)
    print(f" -> Decision with valid interview schedule returned status: {r_dec_good.status_code} (Expected: 200)")
    assert r_dec_good.status_code == 200

    # 4. List Interviews & filter
    print("\n[4] Listing & filtering scheduled interviews...")
    r_itvs = requests.get(f"{BASE_URL}/interviews/?upcoming=true", headers=recruiter_headers)
    assert r_itvs.status_code == 200
    itvs = r_itvs.json()
    print(f" -> Retrieved {len(itvs)} upcoming interviews.")
    assert len(itvs) > 0
    itv_id = itvs[0]["Interview_ID"]

    # 5. Reschedule Interview
    print("\n[5] Rescheduling Interview session...")
    new_time = (datetime.utcnow() + timedelta(days=3)).isoformat()
    reschedule_payload = {
        "Interview_DateTime": new_time,
        "Mode": "Phone",
        "Notes": "Change mode to phone interview.",
        "Status": "Rescheduled"
    }
    r_resched = requests.put(f"{BASE_URL}/interviews/{itv_id}", json=reschedule_payload, headers=recruiter_headers)
    print(f" -> Reschedule request returned status: {r_resched.status_code} (Expected: 200)")
    assert r_resched.status_code == 200
    assert r_resched.json()["Mode"] == "Phone"

    # 6. Advanced Candidate Search & Filters
    print("\n[6] Testing Advanced Search & Filters on Candidates...")
    # Get filtered candidates list
    r_filter = requests.get(
        f"{BASE_URL}/candidates/job/{job_id}",
        params={"min_score": 60, "max_score": 100, "decision_status": "Interview"},
        headers=recruiter_headers
    )
    print(f" -> Filters response status: {r_filter.status_code} (Expected: 200)")
    assert r_filter.status_code == 200
    print(f" -> Filtered results count: {len(r_filter.json())}")

    # 7. Bulk Decision Workflow Overrides
    print("\n[7] Testing Bulk Decisions and Conflict Checks...")
    # Find candidates with different scores
    cand_ids = [c["Candidate_ID"] for c in r_cands.json()[:3]]
    
    # Try bulk reject without reason (triggers conflict checks if any is Strong Match)
    bulk_reject_bad = {
        "Candidate_IDs": cand_ids,
        "Decision": "Reject",
        "Reason": ""
    }
    r_bulk_bad = requests.post(f"{BASE_URL}/candidates/bulk-decision", json=bulk_reject_bad, headers=recruiter_headers)
    print(f" -> Bulk decision without reason response status: {r_bulk_bad.status_code} (Expected: 200 or 400 depending on candidates matches)")
    
    # Let's run a bulk shortlist with a reason
    bulk_shortlist_good = {
        "Candidate_IDs": cand_ids,
        "Decision": "Shortlist",
        "Reason": "Batch override shortlist reason."
    }
    r_bulk_good = requests.post(f"{BASE_URL}/candidates/bulk-decision", json=bulk_shortlist_good, headers=recruiter_headers)
    print(f" -> Bulk shortlist with reason response status: {r_bulk_good.status_code} (Expected: 200)")
    assert r_bulk_good.status_code == 200

    # 8. Individual Candidate PDF Report Export
    print("\n[8] Testing Dynamic PDF Report Export...")
    r_pdf = requests.get(f"{BASE_URL}/candidates/{cand_id}/export-pdf", headers=recruiter_headers)
    print(f" -> PDF export status: {r_pdf.status_code} (Expected: 200)")
    assert r_pdf.status_code == 200
    assert r_pdf.headers["content-type"] == "application/pdf"
    print(f" -> PDF generated successfully. Length: {len(r_pdf.content)} bytes.")

    print("\n=== ALL PHASE 5 EXTENDED FEATURES INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
