import requests

BASE = 'http://127.0.0.1:8000'

def test_interviewer():
    r = requests.post(f"{BASE}/chatbot/generate/interviewer", params={'job_id': 1})
    print('Status', r.status_code)
    print(r.json())

def test_coach():
    payload = {'question': 'Tell me about a time you led a team', 'sample_answer': 'I led a team of 5 to deliver a project on time.'}
    r = requests.post(f"{BASE}/chatbot/generate/coach", json=payload)
    print('Status', r.status_code)
    print(r.json())

if __name__ == '__main__':
    test_interviewer()
    test_coach()
