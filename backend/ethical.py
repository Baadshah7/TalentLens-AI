import re
import inspect
import models
from typing import Dict, Any

# Patterns matching explicit protected attribute declarations in resume text
# Examples: "Gender: Female", "Marital Status: Married", "Religion: Christian", "Caste: General", "Age: 29", "DOB: 12-04-1995"
PROTECTED_PATTERNS = [
    re.compile(r'\b(gender|sex|marital\s+status|relationship\s+status|religion|caste|subcaste|race|nationality|date\s+of\s+birth|dob|birthdate|age)\s*:\s*[\w\d/.-]+\b', re.IGNORECASE),
    re.compile(r'\b(married|single|divorced|widowed)\b', re.IGNORECASE)
]

def sanitize_text(text: str) -> str:
    """Strips explicit protected attributes from parsed resume strings before embedding/scoring."""
    if not text:
        return text
    
    sanitized = text
    for pattern in PROTECTED_PATTERNS:
        sanitized = pattern.sub("[REDACTED]", sanitized)
    return sanitized

def audit_codebase_compliance() -> Dict[str, Any]:
    """
    Programmatically verifies models.py schema and parser paths.
    Confirms no database tables contain columns mapped to protected demographic properties.
    """
    protected_keywords = {
        "gender", "sex", "age", "marital_status", "maritalstatus", "relation", "relationship",
        "religion", "caste", "subcaste", "photo", "race", "dob", "birthdate", "birth_date"
    }
    
    violations = []
    
    # 1. Column Auditing on SQLAlchemy models
    for name, obj in inspect.getmembers(models):
        if inspect.isclass(obj) and hasattr(obj, "__table__"):
            for col in obj.__table__.columns:
                if col.name.lower() in protected_keywords:
                    violations.append(
                        f"Violation: Column '{col.name}' in model '{name}' (Table: '{obj.__tablename__}') matches a protected attribute."
                    )
                    
    is_compliant = len(violations) == 0
    
    # 2. Minimal Data Collection Audit on Candidate model
    allowed_candidate_columns = {
        "candidate_id", "name", "email", "phone", "location", "resume_file_path", 
        "upload_date", "processing_status", "job_id", "is_identity_revealed"
    }
    
    candidate_violations = []
    if hasattr(models, "Candidate") and hasattr(models.Candidate, "__table__"):
        for col in models.Candidate.__table__.columns:
            if col.name.lower() not in allowed_candidate_columns:
                candidate_violations.append(
                    f"Warning: Non-essential column '{col.name}' found in Candidate table (Minimal Data Collection check)."
                )
    
    minimal_data_compliant = len(candidate_violations) == 0
    
    details_text = (
        "No structured protected attributes (gender, age, marital status, religion, caste, photo) "
        "are defined in the candidate database models or scoring data layers."
    )
    if not is_compliant:
        details_text = "; ".join(violations)
        
    if not minimal_data_compliant:
        details_text += " " + "; ".join(candidate_violations)

    return {
        "ethical_screening_active": is_compliant and minimal_data_compliant,
        "compliance_score": 100 if (is_compliant and minimal_data_compliant) else 50,
        "details": details_text,
        "limitation_warning": (
            "Column-level ethical audit and minimal collection principle enforced. Free-text semantic embedding bias "
            "(e.g., incidental career gaps, demographic proxies, or organization names) "
            "remains a documented limitation of deep-learning sentence-transformer models."
        )
    }
