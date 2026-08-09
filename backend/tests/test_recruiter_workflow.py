import requests
import io
import json

BASE_URL = "http://localhost:8000"

def run_recruiter_workflow_tests():
    print("=== STARTING PHASE 4 RECRUITER WORKFLOW & HARDENING INTEGRATION TESTS ===")

    # 1. Login Recruiter
    print("\n[1] Logging in as Recruiter...")
    recruiter_payload = {
        "Email": "recruiter@talentlens.ai",
        "Password": "password123"
    }
    rec_res = requests.post(f"{BASE_URL}/auth/login", json=recruiter_payload)
    rec_res.raise_for_status()
    rec_token = rec_res.json()["access_token"]
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    print(" -> Recruiter login successful.")

    # 2. Login Admin
    print("\n[2] Logging in as Admin...")
    admin_payload = {
        "Email": "admin@talentlens.ai",
        "Password": "password123"
    }
    admin_res = requests.post(f"{BASE_URL}/auth/login", json=admin_payload)
    admin_res.raise_for_status()
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(" -> Admin login successful.")

    # 3. Test RBAC: Audit Logs
    print("\n[3] Testing RBAC on Audit Logs (/dashboard/audit-logs)...")
    # Recruiter check (should get 403)
    rec_audit = requests.get(f"{BASE_URL}/dashboard/audit-logs", headers=rec_headers)
    print(f" -> Recruiter Audit logs request returned status code: {rec_audit.status_code} (Expected: 403)")
    assert rec_audit.status_code == 403, "Recruiter was not blocked from audit logs!"

    # Admin check (should get 200)
    admin_audit = requests.get(f"{BASE_URL}/dashboard/audit-logs", headers=admin_headers)
    print(f" -> Admin Audit logs request returned status code: {admin_audit.status_code} (Expected: 200)")
    assert admin_audit.status_code == 200, "Admin could not retrieve audit logs!"
    print("    [PASS] Audit Log RBAC validation correct.")

    # 4. Verify Recruiter Decision Conflict
    # Upload a blank/unrelated candidate to Job 1 so they are guaranteed to be a "Low Match"
    print("\n[4] Uploading unrelated candidate to guarantee 'Low Match' recommendation...")
    unrelated_resume = "This is a resume of a chef who cooks food and does not know programming or React."
    files = [
        ("files", ("Chef_Resume.txt", io.BytesIO(unrelated_resume.encode('utf-8')), "text/plain"))
    ]
    upload_res = requests.post(f"{BASE_URL}/candidates/upload/1", files=files, headers=rec_headers)
    upload_res.raise_for_status()
    upload_data = upload_res.json()
    temp_cand_id = upload_data["results"][0]["candidate_id"]
    print(f" -> Unrelated Candidate processed. ID: {temp_cand_id}")

    # Fetch candidate recommendation to verify it is indeed "Low Match"
    detail_res = requests.get(f"{BASE_URL}/candidates/{temp_cand_id}/detail", headers=rec_headers)
    detail_res.raise_for_status()
    detail_data = detail_res.json()
    ai_rec = detail_data["screening_results"][0]["Explanation"]["recommendation"]
    print(f" -> Candidate AI Recommendation is: {ai_rec} (Expected: Low Match)")
    assert ai_rec == "Low Match", "Temporary candidate was not a Low Match"

    # Try to shortlist Candidate without a reason (should fail with 400)
    decision_payload_no_reason = {
        "Decision": "Shortlist",
        "Reason": ""
    }
    dec_fail = requests.post(f"{BASE_URL}/candidates/{temp_cand_id}/decision", json=decision_payload_no_reason, headers=rec_headers)
    print(f" -> Decision without justification reason returned status code: {dec_fail.status_code} (Expected: 400)")
    assert dec_fail.status_code == 400, "Decision conflict warning failed to prompt recruiter!"
    print(f"    Error detail: {dec_fail.json()['detail']}")

    # Try to shortlist Candidate with a valid reason (should succeed with 200)
    decision_payload_with_reason = {
        "Decision": "Shortlist",
        "Reason": "Chef experience translates well to fast-paced team environments."
    }
    dec_pass = requests.post(f"{BASE_URL}/candidates/{temp_cand_id}/decision", json=decision_payload_with_reason, headers=rec_headers)
    print(f" -> Decision with justification reason returned status code: {dec_pass.status_code} (Expected: 200)")
    assert dec_pass.status_code == 200, "Valid decision post failed!"
    print("    [PASS] Recruiter review conflict justification validated successfully.")

    # 5. Authenticated Resume Download
    print("\n[5] Testing Authenticated Resume Download (/candidates/{id}/download)...")
    # Without auth (should get 401)
    dl_fail = requests.get(f"{BASE_URL}/candidates/1/download")
    print(f" -> Download without authentication returned status code: {dl_fail.status_code} (Expected: 401)")
    assert dl_fail.status_code == 401, "File was served without auth!"

    # With auth (should get 200)
    dl_pass = requests.get(f"{BASE_URL}/candidates/1/download", headers=rec_headers)
    print(f" -> Download with recruiter credentials returned status code: {dl_pass.status_code} (Expected: 200)")
    assert dl_pass.status_code == 200, "Authenticated download failed!"
    print("    [PASS] Secure authenticated file downloads validated successfully.")

    # 6. Export CSV Screening Report
    print("\n[6] Testing CSV Report Export (/jobs/{id}/export)...")
    csv_res = requests.get(f"{BASE_URL}/jobs/1/export", headers=rec_headers)
    print(f" -> CSV Export request returned status code: {csv_res.status_code} (Expected: 200)")
    assert csv_res.status_code == 200, "CSV Export failed!"
    assert "Candidate ID,Name,Email" in csv_res.text[:100], "CSV structure is incorrect"
    print("    [PASS] Job-wise CSV report downloads verified successfully.")

    # 7. Admin Candidate Deletion (Cascade check)
    print("\n[7] Testing Admin-Only Candidate Deletion...")
    # Recruiter deletes Candidate
    del_fail = requests.delete(f"{BASE_URL}/candidates/{temp_cand_id}", headers=rec_headers)
    print(f" -> Candidate delete request by recruiter returned status code: {del_fail.status_code} (Expected: 403)")
    assert del_fail.status_code == 403, "Recruiter was allowed to delete candidate!"

    # Admin deletes Candidate
    del_pass = requests.delete(f"{BASE_URL}/candidates/{temp_cand_id}", headers=admin_headers)
    print(f" -> Candidate delete request by admin returned status code: {del_pass.status_code} (Expected: 200)")
    assert del_pass.status_code == 200, "Admin candidate deletion failed!"

    # Check candidate doesn't exist anymore
    check_exist = requests.get(f"{BASE_URL}/candidates/{temp_cand_id}/detail", headers=admin_headers)
    print(f" -> Re-fetching deleted candidate returned status code: {check_exist.status_code} (Expected: 404)")
    assert check_exist.status_code == 404, "Candidate deletion was not cascade-committed!"
    print("    [PASS] Admin-only candidate deletion & cascade database wipe verified.")

    print("\n=== ALL RECRUITER WORKFLOW & HARDENING INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_recruiter_workflow_tests()
