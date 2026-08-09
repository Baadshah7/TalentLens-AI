import os
import re
import json
import pdfplumber
import docx
import spacy
from typing import Dict, Any, List, Tuple, Optional

# Load spaCy model
try:
    nlp = spacy.load("en_core_web_sm")
except Exception:
    # Fallback if model load fails in some environment (should not happen as we downloaded it)
    nlp = None

# Regex patterns
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}')
YEAR_REGEX = re.compile(r'\b(19\d{2}|20\d{2})\b')

# Degree extraction patterns
DEGREE_PATTERNS = [
    (r'\b(Ph\.?D\.?|Doctor of Philosophy)\b', "Ph.D."),
    (r'\b(M\.?S\.?|M\.?Tech\.?|Master of Technology|Master of Science|M\.?S\.?C\.?|M\.?C\.?A\.?|Master of Computer Applications|M\.?B\.?A\.?|Master of Business Administration)\b', "Master's"),
    (r'\b(B\.?S\.?|B\.?Tech\.?|Bachelor of Technology|Bachelor of Science|B\.?E\.?|Bachelor of Engineering|B\.?C\.?A\.?|Bachelor of Computer Applications|B\.?B\.?A\.?|Bachelor of Business Administration)\b', "Bachelor's"),
    (r'\b(Associate\'?s?|A\.?S\.?)\b', "Associate's"),
    (r'\b(High School|Diploma|HSC|SSC)\b', "High School")
]

# Section headers patterns (lower case keywords)
SECTION_KEYWORDS = {
    "education": ["education", "academic", "qualification", "studies", "schooling", "university"],
    "experience": ["experience", "employment", "work history", "professional background", "career", "job history", "work experience"],
    "projects": ["projects", "personal project", "academic project", "key project", "portfolio"],
    "certifications": ["certification", "certifications", "credential", "certified", "license"],
    "skills": ["skills", "technical skills", "core competencies", "technologies", "expertise"]
}

# Related degree keywords for equivalence parsing
DEGREE_KEYWORDS_MAP = {
    "b.tech": "B.Tech",
    "btech": "B.Tech",
    "b.e.": "B.E.",
    "be": "B.E.",
    "mca": "MCA",
    "m.c.a.": "MCA",
    "bca": "BCA",
    "b.c.a.": "BCA",
    "bsc": "B.Sc",
    "b.sc": "B.Sc",
    "msc": "M.Sc",
    "m.sc": "M.Sc",
    "m.tech": "M.Tech",
    "mtech": "M.Tech",
    "phd": "Ph.D.",
    "ph.d.": "Ph.D.",
    "mba": "MBA",
    "m.b.a.": "MBA"
}

def load_taxonomy() -> Dict[str, List[str]]:
    """Loads the skills taxonomy from json config."""
    path = os.path.join(os.path.dirname(__file__), "skills_taxonomy.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Fallback default taxonomy
    return {
        "Python": ["numpy", "pandas", "scikit-learn", "django", "flask", "pytorch", "fastapi"],
        "Frontend": ["react", "vue", "angular", "javascript", "typescript", "tailwind", "html", "css"]
    }

def check_file_corrupted(file_path: str, extension: str) -> bool:
    """Attempts to read file structure to detect corruption."""
    try:
        if extension == ".pdf":
            with pdfplumber.open(file_path) as pdf:
                # Access metadata or page count to verify PDF integrity
                _ = len(pdf.pages)
            return False
        elif extension == ".docx":
            doc = docx.Document(file_path)
            # Try to read paragraphs to verify Word integrity
            _ = len(doc.paragraphs)
            return False
        elif extension == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="strict") as f:
                # Try reading lines to make sure it's valid text
                _ = f.read(1024)
            return False
    except Exception as e:
        print(f"File validation failed for {file_path}: {e}")
        return True
    return True

def extract_text(file_path: str) -> str:
    """Extracts raw text from pdf, docx, or txt files."""
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    text = ""
    
    if ext == ".pdf":
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    elif ext == ".docx":
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
            
    return text

def extract_contact_info(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extracts email and phone using regex."""
    email = None
    phone = None
    
    email_match = EMAIL_REGEX.search(text)
    if email_match:
        email = email_match.group(0)
        
    phone_match = PHONE_REGEX.search(text)
    if phone_match:
        phone = phone_match.group(0).strip()
        
    return email, phone

def extract_name_from_filename(filename: str) -> str:
    """Extracts a readable name from the resume filename as a Phase 1 placeholder."""
    name_part, _ = os.path.splitext(os.path.basename(filename))
    name_part = name_part.replace("_", " ").replace("-", " ")
    words = name_part.split()
    filtered_words = [
        w for w in words 
        if w.lower() not in {"resume", "cv", "pdf", "docx", "txt", "job", "apply", "applicant", "work", "profile"}
    ]
    return " ".join(filtered_words).title() if filtered_words else name_part.title()

def extract_name(text: str, filename: str) -> str:
    """Extracts candidate name using spaCy PERSON tags with robust heuristics and filename fallbacks."""
    filename_fallback = extract_name_from_filename(filename)

    if not nlp:
        return filename_fallback

    # 2. Extract first 300 characters for name detection (names are usually at the very top)
    top_text = text[:300]
    doc = nlp(top_text)
    
    # Common words in universities/companies/terms to exclude from name tags
    exclude_keywords = {
        "university", "college", "school", "institute", "technology", "science", "resume", "cv", "page", 
        "address", "phone", "email", "subject", "tech", "profile", "summary", "skills", "experience",
        "education", "certified", "pmp", "aws", "developer", "engineer", "designer", "architect", "management"
    }

    detected_names = []
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            cleaned_ent = ent.text.strip().replace("\n", " ")
            # Validate name content
            ent_words = cleaned_ent.lower().split()
            # Check length: name should be between 2 and 5 words
            if len(ent_words) >= 2 and len(ent_words) <= 4:
                # Check for exclude keywords or numbers
                if not any(w in exclude_keywords for w in ent_words) and not any(char.isdigit() for char in cleaned_ent):
                    detected_names.append(cleaned_ent.title())

    if detected_names:
        return detected_names[0]
        
    return filename_fallback

def extract_location(text: str) -> Optional[str]:
    """Extracts candidate location using GPE tags or city patterns."""
    if not nlp:
        return None
        
    # Look at top portion where address/location is normally written
    top_text = text[:400]
    doc = nlp(top_text)
    
    locations = []
    for ent in doc.ents:
        if ent.label_ in {"GPE", "LOC"}:
            cleaned = ent.text.strip().replace("\n", " ")
            if len(cleaned) > 2 and not any(char.isdigit() for char in cleaned):
                locations.append(cleaned.title())
                
    if locations:
        # Join GPE components (e.g. ["Bangalore", "Karnataka", "India"] -> "Bangalore, Karnataka, India")
        return ", ".join(list(dict.fromkeys(locations))[:3])
        
    # Heuristic: search for common city/state separators like "City, State" or "City, Country"
    lines = [line.strip() for line in top_text.split("\n") if line.strip()]
    for line in lines:
        if "," in line and len(line) < 60:
            # Check if line contains email or phone, skip if so
            if "@" not in line and not any(char.isdigit() for char in line if char not in {" ", ",", "+", "-", "(", ")"}):
                return line.title()
                
    return None

def segment_text_to_sections(text: str) -> Dict[str, str]:
    """Divides resume text into chunks based on headers."""
    lines = text.split("\n")
    sections = {
        "education": [],
        "experience": [],
        "projects": [],
        "certifications": [],
        "skills": [],
        "general": []
    }
    
    current_section = "general"
    
    for line in lines:
        cleaned_line = line.strip()
        if not cleaned_line:
            continue
            
        # Detect if line is a header
        # Headers are usually short and match our keywords
        is_header = False
        if len(cleaned_line) < 40:
            lower_line = cleaned_line.lower().replace(":", "").replace("*", "").strip()
            for sect, kw_list in SECTION_KEYWORDS.items():
                if any(lower_line == kw or lower_line.startswith(kw + " ") or lower_line.endswith(" " + kw) for kw in kw_list):
                    current_section = sect
                    is_header = True
                    break
                    
        if not is_header:
            sections[current_section].append(cleaned_line)
            
    # Join section lines
    return {k: "\n".join(v) for k, v in sections.items()}

def parse_education(edu_text: str) -> List[Dict[str, Any]]:
    """Extracts degree, institution, and year from education text block."""
    entries = []
    lines = [line.strip() for line in edu_text.split("\n") if line.strip()]
    
    for line in lines:
        detected_degree = None
        # Check degree pattern matches
        for pattern, norm in DEGREE_PATTERNS:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                detected_degree = norm
                break
                
        # Also check for specific Indian abbreviations in line
        if not detected_degree:
            for kw, norm in DEGREE_KEYWORDS_MAP.items():
                if re.search(r'\b' + re.escape(kw) + r'\b', line, re.IGNORECASE):
                    detected_degree = norm
                    break
                    
        if detected_degree:
            # Try to extract year
            year_match = YEAR_REGEX.search(line)
            year = int(year_match.group(0)) if year_match else None
            
            # Try to extract institution: look for university/college/school terms
            inst = None
            inst_keywords = ["university", "college", "institute", "school", "academy", "iit", "nit", "bits", "iiit"]
            
            # If university is mentioned in this line
            line_lower = line.lower()
            if any(k in line_lower for k in inst_keywords):
                # Guess institution name by stripping degree and year
                inst = line
                # Simple cleanup
                inst = re.sub(YEAR_REGEX, "", inst)
                for pattern, _ in DEGREE_PATTERNS:
                    inst = re.sub(pattern, "", inst, flags=re.IGNORECASE)
                for kw in DEGREE_KEYWORDS_MAP.keys():
                    inst = re.sub(r'\b' + re.escape(kw) + r'\b', "", inst, flags=re.IGNORECASE)
                inst = inst.replace(",", " ").replace("-", " ").strip()
                inst = re.sub(r'\s+', " ", inst).title()
            
            # If not found on same line, look at adjacent line
            if not inst:
                inst = "Unknown Institution"
                
            entries.append({
                "Degree": detected_degree,
                "Institution": inst[:100],
                "Graduation_Year": year
            })
            
    return entries

def calculate_months_from_range(start_str: str, end_str: str) -> int:
    """Calculates duration in months from two date strings."""
    try:
        # Years extraction
        start_year = int(start_str)
        if end_str.lower() in ["present", "current", "now"]:
            end_year = 2026 # Local time metadata year
        else:
            end_year = int(end_str)
            
        months = (end_year - start_year) * 12
        return max(1, months)
    except Exception:
        return 12  # fallback default 1 year

def parse_experience(exp_text: str) -> List[Dict[str, Any]]:
    """Extracts professional experience details: Company, Role, Duration, Description."""
    entries = []
    lines = [line.strip() for line in exp_text.split("\n") if line.strip()]
    
    current_entry = None
    description_buffer = []
    
    role_keywords = ["engineer", "developer", "analyst", "manager", "intern", "specialist", "consultant", "architect", "lead", "designer", "programmer", "officer", "administrator"]
    
    for i, line in enumerate(lines):
        # Check if line contains a job title/role
        is_role = any(r in line.lower() for r in role_keywords) and len(line) < 60
        
        # Try to match duration pattern (e.g. 2018 - 2021 or 2018 to Present)
        duration_match = re.findall(r'\b(20\d{2}|19\d{2})\b', line)
        has_present = "present" in line.lower() or "current" in line.lower()
        
        if is_role or (len(duration_match) >= 1 and len(line) < 80):
            # Save previous entry if it exists
            if current_entry:
                current_entry["Description"] = "\n".join(description_buffer).strip()
                entries.append(current_entry)
                description_buffer = []
                
            # Create a new entry
            role = line
            company = "Unknown Company"
            
            # Simple heuristics to split role and company (e.g. "Software Engineer at Google" or "Google | Software Engineer")
            if " at " in line:
                parts = line.split(" at ")
                role = parts[0].strip()
                company = parts[1].strip()
            elif " | " in line:
                parts = line.split(" | ")
                role = parts[0].strip()
                company = parts[1].strip()
            elif " - " in line:
                parts = line.split(" - ")
                role = parts[0].strip()
                company = parts[1].strip()
                
            # Clean up role and company from years
            role = re.sub(YEAR_REGEX, "", role).replace(",", "").strip()
            company = re.sub(YEAR_REGEX, "", company).replace(",", "").strip()
            
            # Calculate duration
            duration_months = 12 # Default fallback
            if len(duration_match) == 2:
                duration_months = calculate_months_from_range(duration_match[0], duration_match[1])
            elif len(duration_match) == 1 and has_present:
                duration_months = calculate_months_from_range(duration_match[0], "present")
                
            current_entry = {
                "Role": role.title()[:100],
                "Company": company.title()[:100],
                "Duration_Months": duration_months,
                "Description": "",
                "Is_Relevant": False # Evaluated later by scoring engine
            }
        else:
            if current_entry:
                description_buffer.append(line)
            elif i == 0:
                # If first line isn't a role but contains text, create a dummy entry to capture description
                current_entry = {
                    "Role": "Professional Experience",
                    "Company": "Various",
                    "Duration_Months": 12,
                    "Description": line,
                    "Is_Relevant": False
                }
                
    # Save the last entry
    if current_entry:
        current_entry["Description"] = "\n".join(description_buffer).strip()
        entries.append(current_entry)
        
    return entries

def parse_skills(text: str) -> List[Dict[str, str]]:
    """Scans text for skills based on our taxonomy, mapping occurrences."""
    taxonomy = load_taxonomy()
    extracted_skills = {}
    
    text_lower = text.lower()
    
    for category, sub_skills in taxonomy.items():
        # Check primary category (e.g. "Python")
        cat_esc = re.escape(category.lower())
        if re.search(r'\b' + cat_esc + r'\b', text_lower):
            # Find evidence line
            evidence = ""
            for line in text.split("\n"):
                if category.lower() in line.lower():
                    evidence = line.strip()
                    break
            extracted_skills[category] = {
                "Skill": category,
                "Skill_Level": "Expert" if "expert" in text_lower or "senior" in text_lower else "Intermediate",
                "Evidence_Text": evidence[:250] if evidence else f"Found mention of {category}."
            }
            
        # Check related subskills (e.g. "numpy", "react")
        for skill in sub_skills:
            skill_esc = re.escape(skill.lower())
            # Match word boundaries to prevent substring issues (e.g., "go" inside "good")
            if re.search(r'\b' + skill_esc + r'\b', text_lower):
                # Add category as well, and register the specific sub-skill
                evidence = ""
                for line in text.split("\n"):
                    if skill.lower() in line.lower():
                        evidence = line.strip()
                        break
                extracted_skills[skill.title()] = {
                    "Skill": skill.title(),
                    "Skill_Level": "Intermediate",
                    "Evidence_Text": evidence[:250] if evidence else f"Found match for {skill}."
                }
                
    return list(extracted_skills.values())

def parse_projects(proj_text: str, full_text_skills: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """Extracts project details and associates them with matched technologies."""
    entries = []
    lines = [line.strip() for line in proj_text.split("\n") if line.strip()]
    
    # Split by project indicators: line with bullet point, capitalized titles, or "Project:"
    current_proj = None
    desc_buf = []
    
    known_techs = [s["Skill"].lower() for s in full_text_skills]
    
    for line in lines:
        is_title = (line.startswith("Project:") or line.startswith("- Project") or (len(line) < 50 and line.isupper())) or (line.startswith("•") and len(line) < 40)
        
        if is_title:
            if current_proj:
                current_proj["Description"] = " ".join(desc_buf).strip()
                # Find technologies mentioned in desc or title
                techs_found = []
                combined_text = (current_proj["Project_Name"] + " " + current_proj["Description"]).lower()
                for tech in known_techs:
                    if re.search(r'\b' + re.escape(tech) + r'\b', combined_text):
                        techs_found.append(tech.title())
                current_proj["Technologies"] = list(set(techs_found))
                entries.append(current_proj)
                desc_buf = []
                
            proj_name = line.replace("Project:", "").replace("-", "").replace("•", "").strip()
            current_proj = {
                "Project_Name": proj_name[:100] if proj_name else "Key Project",
                "Technologies": [],
                "Description": ""
            }
        else:
            if current_proj:
                desc_buf.append(line)
            else:
                current_proj = {
                    "Project_Name": "Resume Project",
                    "Technologies": [],
                    "Description": line
                }
                
    if current_proj:
        current_proj["Description"] = " ".join(desc_buf).strip()
        techs_found = []
        combined_text = (current_proj["Project_Name"] + " " + current_proj["Description"]).lower()
        for tech in known_techs:
            if re.search(r'\b' + re.escape(tech) + r'\b', combined_text):
                techs_found.append(tech.title())
        current_proj["Technologies"] = list(set(techs_found))
        entries.append(current_proj)
        
    return entries

def parse_certifications(cert_text: str) -> List[Dict[str, str]]:
    """Extracts certification names and issuing organizations."""
    entries = []
    lines = [line.strip() for line in cert_text.split("\n") if line.strip()]
    
    issuing_orgs = ["AWS", "Google", "Microsoft", "Oracle", "Cisco", "Scrum Alliance", "PMI", "CompTIA", "Red Hat"]
    
    for line in lines:
        if len(line) > 5 and len(line) < 120:
            # Guess issuing org
            org = "Unknown Issuer"
            for o in issuing_orgs:
                if o.lower() in line.lower():
                    org = o
                    break
            
            entries.append({
                "Certification_Name": line[:100],
                "Issuing_Org": org
            })
            
    return entries

def parse_resume_full(file_path: str, filename: str) -> Dict[str, Any]:
    """Orchestrates full file loading, metadata extraction, chunk parsing and normalization."""
    # 1. Load raw text
    raw_text = extract_text(file_path)
    if not raw_text.strip():
        raise ValueError("Document contains no readable text content.")
        
    # 2. Contact details & general metadata
    email, phone = extract_contact_info(raw_text)
    name = extract_name(raw_text, filename)
    location = extract_location(raw_text)
    
    # 3. Segment sections
    sections = segment_text_to_sections(raw_text)
    
    # 4. Parse subcomponents
    skills = parse_skills(raw_text)
    education = parse_education(sections["education"])
    experience = parse_experience(sections["experience"])
    projects = parse_projects(sections["projects"], skills)
    certifications = parse_certifications(sections["certifications"])
    
    return {
        "Name": name,
        "Email": email,
        "Phone": phone,
        "Location": location,
        "skills": skills,
        "experiences": experience,
        "educations": education,
        "projects": projects,
        "certifications": certifications,
        "Raw_Text": raw_text
    }
