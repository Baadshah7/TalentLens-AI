import os
from sqlalchemy.orm import Session
import models
from semantic import get_embedding, cosine_similarity
from parser import load_taxonomy

# Constants
SEMANTIC_THRESHOLD_EXP = 0.35  # Relevance threshold for experience
SEMANTIC_THRESHOLD_SKILL = 0.60 # Matching threshold for skills

DEGREE_HIERARCHY = {
    "Ph.D.": 5,
    "Master's": 4,
    "Bachelor's": 3,
    "Associate's": 2,
    "High School": 1,
    "None": 0
}

def evaluate_experience_relevance(candidate_id: int, job_desc: str, db: Session) -> int:
    """Evaluates each candidate experience chunk against the job description and sets Is_Relevant."""
    experiences = db.query(models.CandidateExperience).filter(models.CandidateExperience.Candidate_ID == candidate_id).all()
    
    if not experiences:
        return 0
        
    job_vector = get_embedding(job_desc, db, entity_type="job", entity_id=None)
    relevant_months = 0
    
    for exp in experiences:
        exp_text = f"{exp.Role or ''} {exp.Company or ''} {exp.Description or ''}".strip()
        if not exp_text:
            exp.Is_Relevant = False
            continue
            
        exp_vector = get_embedding(exp_text, db, entity_type="candidate", entity_id=candidate_id)
        sim = cosine_similarity(exp_vector, job_vector)
        
        # Check against threshold
        if sim >= SEMANTIC_THRESHOLD_EXP:
            exp.Is_Relevant = True
            relevant_months += exp.Duration_Months
        else:
            exp.Is_Relevant = False
            
    db.commit()
    return relevant_months

def compute_skill_scores(candidate_id: int, required_skills: list, preferred_skills: list, db: Session) -> tuple:
    """Computes matching ratios for required and preferred skills using taxonomy and semantic similarity."""
    candidate_skills = db.query(models.CandidateSkill).filter(models.CandidateSkill.Candidate_ID == candidate_id).all()
    c_skill_names = [cs.Skill.lower() for cs in candidate_skills]
    
    taxonomy = load_taxonomy()
    
    def score_single_skill(job_skill: str) -> float:
        job_skill_l = job_skill.lower()
        
        # 1. Exact case-insensitive match
        if job_skill_l in c_skill_names:
            return 1.0
            
        # 2. Check taxonomy for related terms
        # Look up job_skill in taxonomy
        related_keywords = []
        for parent, children in taxonomy.items():
            if parent.lower() == job_skill_l:
                related_keywords = [c.lower() for c in children]
                break
            elif job_skill_l in [c.lower() for c in children]:
                related_keywords = [parent.lower()] + [c.lower() for c in children if c.lower() != job_skill_l]
                break
                
        # Intersect candidate skills with related keywords
        for keyword in related_keywords:
            if keyword in c_skill_names:
                return 0.8
                
        # 3. Fallback: Semantic Cosine Similarity
        # Compute similarity between job skill text and all candidate skills
        best_sim = 0.0
        job_skill_vec = get_embedding(job_skill, db)
        for cs in candidate_skills:
            cs_vec = get_embedding(cs.Skill, db)
            sim = cosine_similarity(job_skill_vec, cs_vec)
            if sim > best_sim:
                best_sim = sim
                
        if best_sim >= SEMANTIC_THRESHOLD_SKILL:
            return best_sim
            
        return 0.0

    # Calculate required matching
    if required_skills:
        req_scores = [score_single_skill(s) for s in required_skills]
        req_score = (sum(req_scores) / len(req_scores)) * 100.0
    else:
        req_score = 100.0  # Default to max if no requirements specified

    # Calculate preferred matching
    if preferred_skills:
        pref_scores = [score_single_skill(s) for s in preferred_skills]
        pref_score = (sum(pref_scores) / len(pref_scores)) * 100.0
    else:
        pref_score = 100.0
        
    return req_score, pref_score

def compute_education_score(candidate_id: int, min_education: str, db: Session) -> float:
    """Rule-based grade match comparing candidate's highest degree to minimum required."""
    if not min_education:
        return 100.0
        
    educations = db.query(models.CandidateEducation).filter(models.CandidateEducation.Candidate_ID == candidate_id).all()
    if not educations:
        return 0.0
        
    # Get highest rank candidate has
    max_rank = 0
    for edu in educations:
        rank = DEGREE_HIERARCHY.get(edu.Degree, 0)
        if rank > max_rank:
            max_rank = rank
            
    required_rank = DEGREE_HIERARCHY.get(min_education, 3) # default Bachelor's rank
    
    if max_rank >= required_rank:
        return 100.0
    elif max_rank == required_rank - 1:
        return 70.0  # Partial credit
    elif max_rank == required_rank - 2:
        return 40.0
    else:
        return 0.0

def compute_project_score(candidate_id: int, job_title: str, job_desc: str, db: Session) -> float:
    """Computes project score based on cosine similarity of project descriptions vs job parameters."""
    projects = db.query(models.CandidateProject).filter(models.CandidateProject.Candidate_ID == candidate_id).all()
    if not projects:
        return 0.0
        
    job_text = f"{job_title} {job_desc}"
    job_vector = get_embedding(job_text, db)
    
    project_similarities = []
    for proj in projects:
        proj_text = f"{proj.Project_Name} {' '.join(proj.Technologies)} {proj.Description or ''}".strip()
        if not proj_text:
            continue
        proj_vector = get_embedding(proj_text, db)
        sim = cosine_similarity(proj_vector, job_vector)
        project_similarities.append(sim)
        
    if not project_similarities:
        return 0.0
        
    # Take the max project similarity scaled to 100 (since having one highly relevant project is great)
    best_similarity = max(project_similarities)
    # Scale: a similarity of 0.45 or higher gets a 100. Lower values are scaled linearly
    scaled_score = min(100.0, max(0.0, (best_similarity / 0.45) * 100.0))
    return scaled_score

def compute_certification_score(candidate_id: int, job_certs: list, db: Session) -> float:
    """Compares candidate certifications to required certifications."""
    if not job_certs:
        return 100.0
        
    c_certs = db.query(models.CandidateCertification).filter(models.CandidateCertification.Candidate_ID == candidate_id).all()
    if not c_certs:
        return 0.0
        
    c_cert_names = [cc.Certification_Name.lower() for cc in c_certs]
    
    matched = 0
    for j_cert in job_certs:
        j_cert_l = j_cert.lower()
        # 1. Exact match
        if any(j_cert_l in cc_l or cc_l in j_cert_l for cc_l in c_cert_names):
            matched += 1
            continue
            
    return (matched / len(job_certs)) * 100.0

def compute_completeness_score(candidate_id: int, db: Session) -> float:
    """Determines ratio of populated sections. Equates experience or projects equally for freshers."""
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        return 0.0
        
    score = 0.0
    
    # Contact Info (40% total)
    if candidate.Name: score += 10.0
    if candidate.Email: score += 10.0
    if candidate.Phone: score += 10.0
    if candidate.Location: score += 10.0
    
    # Education (30%)
    educations_count = db.query(models.CandidateEducation).filter(models.CandidateEducation.Candidate_ID == candidate_id).count()
    if educations_count > 0:
        score += 30.0
        
    # Experience or Projects (30%) - solves the fresher/projects equivalence
    experiences_count = db.query(models.CandidateExperience).filter(models.CandidateExperience.Candidate_ID == candidate_id).count()
    projects_count = db.query(models.CandidateProject).filter(models.CandidateProject.Candidate_ID == candidate_id).count()
    if experiences_count > 0 or projects_count > 0:
        score += 30.0
        
    return score

def compute_semantic_fit_score(candidate_id: int, job_desc: str, db: Session) -> float:
    """Performs semantic similarity between full candidate text and job description, scaled for typical MiniLM outputs."""
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    if not candidate:
        return 0.0
        
    # Reconstruct resume text from parsed parts or raw text
    resume_text = ""
    # Fetch experience descriptions
    exps = db.query(models.CandidateExperience).filter(models.CandidateExperience.Candidate_ID == candidate_id).all()
    for e in exps:
        resume_text += f" {e.Role or ''} {e.Description or ''}"
    # Fetch skills
    skills = db.query(models.CandidateSkill).filter(models.CandidateSkill.Candidate_ID == candidate_id).all()
    resume_text += " " + " ".join([s.Skill for s in skills])
    # Fetch projects
    projs = db.query(models.CandidateProject).filter(models.CandidateProject.Candidate_ID == candidate_id).all()
    for p in projs:
        resume_text += f" {p.Project_Name} {p.Description or ''}"
        
    if not resume_text.strip():
        return 0.0
        
    job_vec = get_embedding(job_desc, db)
    resume_vec = get_embedding(resume_text, db)
    sim = cosine_similarity(resume_vec, job_vec)
    
    # Scale: MiniLM cosine similarity for full documents generally ranges between 0.25 and 0.5.
    # Map a similarity of 0.45 or above to 100%, and scale lower values linearly down to 0
    scaled = min(100.0, max(0.0, (sim / 0.45) * 100.0))
    return scaled

def score_candidate(candidate_id: int, job_id: int, db: Session) -> models.ScreeningResult:
    """Calculates all candidate sub-scores and weights overall score, writing results and structured explanation metadata to DB."""
    # Fetch job and candidate
    job = db.query(models.Job).filter(models.Job.Job_ID == job_id).first()
    candidate = db.query(models.Candidate).filter(models.Candidate.Candidate_ID == candidate_id).first()
    
    if not job or not candidate:
        raise ValueError("Job or Candidate not found in database.")
        
    # Handle unparsed or failed parses cleanly
    if candidate.Processing_Status == "Failed":
        res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == candidate_id).first()
        if not res:
            res = models.ScreeningResult(Candidate_ID=candidate_id, Job_ID=job_id)
            db.add(res)
        res.Skill_Score = 0.0
        res.Experience_Score = 0.0
        res.Education_Score = 0.0
        res.Project_Score = 0.0
        res.Certification_Score = 0.0
        res.Completeness_Score = 0.0
        res.Semantic_Score = 0.0
        res.Overall_Score = 0.0
        res.Explanation = {
            "strengths": [],
            "gaps": ["File is corrupted or parsing failed."],
            "recommendation": "Low Match",
            "missing_skills": job.Required_Skills
        }
        res.Confidence_Level = "Low"
        db.commit()
        return res

    # 1. Experience score
    relevant_months = evaluate_experience_relevance(candidate_id, job.Description, db)
    if job.Min_Experience == 0:
        experience_score = 100.0
    else:
        experience_score = min(100.0, (relevant_months / (job.Min_Experience * 12)) * 100.0)
        
    # 2. Skill scores (Required & Preferred)
    req_score, pref_score = compute_skill_scores(candidate_id, job.Required_Skills, job.Preferred_Skills, db)
    
    # 3. Education score
    education_score = compute_education_score(candidate_id, job.Min_Education, db)
    
    # 4. Project score
    project_score = compute_project_score(candidate_id, job.Job_Title, job.Description, db)
    
    # 5. Certification score
    certification_score = compute_certification_score(candidate_id, job.Certifications, db)
    
    # 6. Completeness score
    completeness_score = compute_completeness_score(candidate_id, db)
    
    # 7. Semantic fit score
    semantic_fit_score = compute_semantic_fit_score(candidate_id, job.Description, db)

    # 8. Query job weights, falling back to defaults
    weights = {w.Category: w.Weight for w in job.weights}
    
    sub_scores = {
        "required_skills": req_score,
        "preferred_skills": pref_score,
        "experience": experience_score,
        "education": education_score,
        "projects": project_score,
        "certifications": certification_score,
        "completeness": completeness_score,
        "semantic_fit": semantic_fit_score
    }
    
    # Calculate weighted overall score
    overall_score = 0.0
    total_weight = 0.0
    
    for category, score in sub_scores.items():
        weight = weights.get(category, 0.0)
        overall_score += (score * weight)
        total_weight += weight
        
    if total_weight > 0:
        overall_score = overall_score / total_weight
    else:
        overall_score = sum(sub_scores.values()) / len(sub_scores)
        
    overall_score = round(overall_score, 2)

    # 9. Explainable AI & Confidence Calculations
    strengths = []
    gaps = []
    
    # Skills alignment strengths/gaps
    if req_score >= 85.0:
        strengths.append("Strong skill alignment matching required position technologies.")
    
    candidate_skills = db.query(models.CandidateSkill).filter(models.CandidateSkill.Candidate_ID == candidate_id).all()
    c_skills_lower = [cs.Skill.lower() for cs in candidate_skills]
    
    # Calculate exact vs inferred skills count
    exact_count = 0
    inferred_count = 0
    missing_skills = []
    
    taxonomy = load_taxonomy()
    
    for req in job.Required_Skills:
        req_l = req.lower()
        if req_l in c_skills_lower:
            exact_count += 1
        else:
            # Check taxonomy or semantic match
            matched = False
            # Check related keywords
            related_keywords = []
            for parent, children in taxonomy.items():
                if parent.lower() == req_l:
                    related_keywords = [c.lower() for c in children]
                    break
                elif req_l in [c.lower() for c in children]:
                    related_keywords = [parent.lower()] + [c.lower() for c in children if c.lower() != req_l]
                    break
            
            for keyword in related_keywords:
                if keyword in c_skills_lower:
                    inferred_count += 1
                    matched = True
                    break
                    
            if not matched:
                # Check semantic
                job_skill_vec = get_embedding(req, db)
                best_sim = 0.0
                for cs in candidate_skills:
                    cs_vec = get_embedding(cs.Skill, db)
                    sim = cosine_similarity(job_skill_vec, cs_vec)
                    if sim > best_sim:
                        best_sim = sim
                if best_sim >= SEMANTIC_THRESHOLD_SKILL:
                    inferred_count += 1
                    matched = True
            
            if not matched:
                missing_skills.append(req)
                
    if missing_skills:
        gaps.append(f"Missing required skills: {', '.join(missing_skills)}")
        
    # Experience strengths/gaps
    if job.Min_Experience > 0:
        if experience_score >= 100.0:
            strengths.append(f"Fully matches required work experience duration ({relevant_months} months).")
        else:
            gaps.append(f"Relevant experience is {relevant_months} months, below the required {job.Min_Experience * 12} months.")
            
    # Education strengths/gaps
    if job.Min_Education:
        if education_score >= 100.0:
            strengths.append("Education degree matches or exceeds required level.")
        else:
            gaps.append(f"Highest degree level does not meet the minimum '{job.Min_Education}' requirement.")
            
    # Project strengths/gaps
    if project_score >= 80.0:
        strengths.append("Highly relevant projects showing applied technical knowledge.")
        
    # Certification strengths/gaps
    if job.Certifications:
        if certification_score >= 100.0:
            strengths.append("Possesses required certifications.")
        else:
            gaps.append("Missing required certifications.")

    # Deriving recommendation label based on thresholds
    strong_th = job.Strong_Threshold or 85.0
    good_th = job.Good_Threshold or 70.0
    potential_th = job.Potential_Threshold or 50.0
    
    if overall_score >= strong_th:
        recommendation_label = "Strong Match"
    elif overall_score >= good_th:
        recommendation_label = "Good Match"
    elif overall_score >= potential_th:
        recommendation_label = "Potential Match"
    else:
        recommendation_label = "Low Match"

    # Derive AI Confidence level
    total_matched_skills = exact_count + inferred_count
    if total_matched_skills == 0:
        confidence_level = "Low"
    else:
        exact_ratio = exact_count / total_matched_skills
        if exact_ratio >= 0.70:
            confidence_level = "High"
        elif exact_ratio >= 0.40:
            confidence_level = "Medium"
        else:
            confidence_level = "Low"

    # Write to ScreeningResult table
    res = db.query(models.ScreeningResult).filter(models.ScreeningResult.Candidate_ID == candidate_id).first()
    if not res:
        res = models.ScreeningResult(Candidate_ID=candidate_id, Job_ID=job_id)
        db.add(res)
        
    res.Skill_Score = round((req_score + pref_score) / 2.0, 2)
    res.Experience_Score = round(experience_score, 2)
    res.Education_Score = round(education_score, 2)
    res.Project_Score = round(project_score, 2)
    res.Certification_Score = round(certification_score, 2)
    res.Completeness_Score = round(completeness_score, 2)
    res.Semantic_Score = round(semantic_fit_score, 2)
    res.Overall_Score = overall_score
    res.Explanation = {
        "strengths": strengths,
        "gaps": gaps,
        "recommendation": recommendation_label,
        "missing_skills": missing_skills
    }
    res.Confidence_Level = confidence_level
    
    db.commit()
    db.refresh(res)
    
    return res
