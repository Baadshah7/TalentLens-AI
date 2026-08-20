import requests

BASE = 'http://127.0.0.1:8000'

resp = requests.post(f"{BASE}/auth/login", json={"Email": "admin@talentlens.ai", "Password": "password123"})
print('login status', resp.status_code)
print(resp.json())
if resp.status_code == 200:
    token = resp.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    r = requests.get(f"{BASE}/assessments/tests/1", headers=headers)
    print('get test', r.status_code)
    print(r.json())
else:
    print('login failed')
