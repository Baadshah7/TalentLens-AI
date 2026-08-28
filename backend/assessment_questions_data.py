"""
Curated assessment question bank containing exactly 20 high quality questions
for each of the 5 levels across all 7 technological domains (700 total questions).
"""

from typing import List, Dict, Any

# We will structure questions by domain name and level number (1 to 5).
QUESTIONS_DATA: Dict[str, Dict[int, List[Dict[str, Any]]]] = {}

def add_question(domain: str, level: int, question: str, options: List[str], correct_idx: int, explanation: str, tag: str = None):
    if domain not in QUESTIONS_DATA:
        QUESTIONS_DATA[domain] = {1: [], 2: [], 3: [], 4: [], 5: []}
    if tag is None:
        tag = f"Level {level}"
    QUESTIONS_DATA[domain][level].append({
        "Question_Text": question,
        "Options": options,
        "Correct_Option_Index": correct_idx,
        "Explanation": explanation,
        "Difficulty_Tag": tag
    })
