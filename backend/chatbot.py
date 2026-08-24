import random
from typing import Dict, List

def extract_job_keywords(job: Dict) -> List[str]:
    keys = []
    if not job:
        return keys
    keys.extend(job.get('Required_Skills', []) or [])
    keys.extend(job.get('Preferred_Skills', []) or [])
    title = job.get('Job_Title')
    if title:
        keys.extend(title.split())
    # normalize and dedupe
    cleaned = []
    for k in keys:
        kk = str(k).strip()
        if kk and kk.lower() not in [c.lower() for c in cleaned]:
            cleaned.append(kk)
    return cleaned[:10]


def generate_interview_questions(job: Dict, candidate: Dict, num_questions: int = 6) -> List[Dict]:
    """Rule-based question generator using job keywords and candidate highlights.

    Returns a list of question dicts: {question, category, difficulty}
    """
    keywords = extract_job_keywords(job)
    base_questions = []

    # General competency questions
    base_questions.append(("Tell me about your most relevant experience for this role.", "Behavioral"))
    base_questions.append(("Walk me through a challenging project and how you handled it.", "Behavioral"))
    base_questions.append(("Why are you interested in this position and company?", "Motivation"))

    # Add skill-specific questions
    for kw in keywords:
        base_questions.append((f"Describe your experience working with {kw}.", "Technical"))
        base_questions.append((f"Give an example where you used {kw} to solve a real problem.", "Technical"))

    # Add resume-driven probing
    if candidate:
        if candidate.get('projects'):
            base_questions.append(("Tell me about a project listed on your resume and your role in it.", "Behavioral"))
        if candidate.get('skills'):
            base_questions.append(("Which skill do you consider your strongest and why?", "Self-assessment"))

    # Shuffle and pick
    random.shuffle(base_questions)
    selected = base_questions[:num_questions]

    out = []
    for q, cat in selected:
        diff = random.choice(["Easy", "Medium", "Hard"]) if cat == "Technical" else random.choice(["Medium", "Easy"])
        out.append({"question": q, "category": cat, "difficulty": diff})
    return out


def coach_feedback(sample_answer: str, question: str) -> Dict:
    """Invokes Claude AI for high-quality, candidate-facing feedback and STAR analysis,
    falling back to rule-based heuristics if ANTHROPIC_API_KEY is not configured.
    """
    import os
    import json
    import httpx
    
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Heuristic-based fallback
        feedback = []
        if not sample_answer:
            feedback.append("No answer provided. Try giving a concise, structured response (STAR: Situation, Task, Action, Result).")
        else:
            words = sample_answer.split()
            if len(words) < 20:
                feedback.append("Answer is short — aim for 30-60 seconds (roughly 40-80 words) with examples.")
            if any(filler in sample_answer.lower() for filler in ["um", "uh", "like", "you know"]):
                feedback.append("Try to avoid filler words (um, uh, like).")
            if question:
                qwords = [w.lower().strip('.,') for w in question.split()]
                hits = sum(1 for w in qwords if w in sample_answer.lower())
                if hits == 0:
                    feedback.append("Your answer doesn't reference key aspects of the question — reference core terms from the question.")

        suggestions = [
            "Structure your answers using STAR (Situation, Task, Action, Result)",
            "Give one concise example and a measurable outcome",
            "Mention technologies/tools used when relevant"
        ]

        answer_lower = sample_answer.lower()
        star_hints = {
            "situation": ["when", "context", "background", "team", "project"],
            "task": ["responsible", "goal", "needed to", "task", "objective"],
            "action": ["i ", "led", "built", "created", "decided", "implemented"],
            "result": ["result", "increased", "reduced", "improved", "learned", "%", "success"]
        }
        star_analysis = {
            part: {
                "present": any(hint in answer_lower for hint in hints),
                "evidence": next((hint for hint in hints if hint in answer_lower), None)
            }
            for part, hints in star_hints.items()
        }
        return {
            "feedback": feedback,
            "suggestions": suggestions,
            "star_analysis": star_analysis,
            "star_score": sum(item["present"] for item in star_analysis.values())
        }

    # Claude AI-powered career coach
    system_prompt = (
        "You are an expert technical interviewer and AI Career Coach. A candidate is practicing for an interview.\n"
        "Analyze the candidate's answer and provide constructive, candidate-facing feedback, resume tips, "
        "interview prep tips, and skill-gap suggestions.\n"
        "Format your output STRICTLY as a JSON object matching this schema. Do not include markdown wraps or conversational prose:\n"
        "{\n"
        "  \"feedback\": [\"First review point (e.g. tone, filler words, technical depth)\", \"Second review point\"],\n"
        "  \"suggestions\": [\"Improvement suggestion 1\", \"Improvement suggestion 2\"],\n"
        "  \"star_analysis\": {\n"
        "    \"situation\": {\"present\": true, \"evidence\": \"excerpt of context\"},\n"
        "    \"task\": {\"present\": true, \"evidence\": \"excerpt of goal\"},\n"
        "    \"action\": {\"present\": true, \"evidence\": \"excerpt of candidate action\"},\n"
        "    \"result\": {\"present\": true, \"evidence\": \"excerpt of metrics/outcomes\"}\n"
        "  },\n"
        "  \"star_score\": 4\n"
        "}"
    )
    user_prompt = f"Question: {question}\nCandidate Answer: {sample_answer}"
    
    try:
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 1500,
            "messages": [
                {"role": "user", "content": f"{system_prompt}\n\n{user_prompt}"}
            ]
        }
        
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
            timeout=25.0
        )
        
        if response.status_code != 200:
            raise ValueError(f"Claude API status code {response.status_code}")
            
        res_json = response.json()
        content_text = res_json["content"][0]["text"].strip()
        
        if content_text.startswith("```"):
            lines = content_text.split("\n")
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            content_text = "\n".join(lines).strip()
            
        data = json.loads(content_text)
        return {
            "feedback": data.get("feedback", []),
            "suggestions": data.get("suggestions", []),
            "star_analysis": data.get("star_analysis", {}),
            "star_score": data.get("star_score", 0)
        }
    except Exception as e:
        print(f"Claude Career Coach failed: {e}. Falling back to rule-based feedback...")
        # Fallback to local
        os.environ["ANTHROPIC_API_KEY"] = ""
        res = coach_feedback(sample_answer, question)
        os.environ["ANTHROPIC_API_KEY"] = api_key
        return res

