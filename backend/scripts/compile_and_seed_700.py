import os
import sys
import json

# Add backend directory and scratch directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
sys.path.insert(0, r"C:\Users\GIZMOSBAY\.gemini\antigravity-ide\brain\c94e3745-bfb6-4901-a9bf-0f2825a27a3f\scratch")

from ml_questions import build_ml_questions
from web_questions import generate_web_dev_questions as build_web_dev_questions
from cyber_questions import build_cybersecurity_questions
from app_questions import build_app_dev_questions
from data_questions import build_data_science_questions
from ai_questions import build_ai_questions
from aptitude_questions import build_aptitude_questions

from database import SessionLocal, engine
import models

def main():
    print("=== ASSEMBLING 700 ASSESSMENT QUESTIONS FOR 7 DOMAINS ===")
    
    domain_map = {
        "Machine Learning": (build_ml_questions(), "brain", "Fundamentals, algorithms, neural models, evaluation metrics, and production MLOps system design."),
        "Web Development": (build_web_dev_questions(), "code", "HTML5, CSS3, React, Node.js, routing, security, state management, and modern responsive app architecture."),
        "Cybersecurity": (build_cybersecurity_questions(), "shield", "Network security, cryptography, penetration testing, secure coding, and identity management."),
        "App Development": (build_app_dev_questions(), "smartphone", "Flutter, React Native, Swift, Kotlin, state management, offline storage, and mobile platform optimizations."),
        "Data Science": (build_data_science_questions(), "database", "Data analytics, Pandas, SQL, data warehousing, visualization, statistical testing, and ETL pipelines."),
        "Artificial Intelligence": (build_ai_questions(), "sparkles", "Neural networks, Deep Learning, NLP, Large Language Models, prompt engineering, and AI safety."),
        "Non-Technical / Aptitude": (build_aptitude_questions(), "scale", "Logical reasoning, quantitative analysis, data interpretation, verbal ability, and problem solving.")
    }
    
    total_q_count = 0
    compiled_data = {}
    
    for dom_name, (levels_dict, icon, desc) in domain_map.items():
        compiled_data[dom_name] = {
            "icon": icon,
            "desc": desc,
            "levels": {}
        }
        for lvl in range(1, 6):
            q_list = levels_dict[lvl]
            count = len(q_list)
            print(f"[{dom_name}] Level {lvl}: {count} questions")
            if count != 20:
                raise ValueError(f"Domain {dom_name} Level {lvl} has {count} questions instead of 20!")
            compiled_data[dom_name]["levels"][lvl] = q_list
            total_q_count += count

    print(f"\nVerification Success: Total questions compiled = {total_q_count} (Expected 700)")
    
    # Save to JSON
    json_path = os.path.join(backend_dir, "assessment_questions_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(compiled_data, f, indent=2)
    print(f"Saved compiled questions to {json_path}")
    
    # Seed Database
    print("\n--- Seeding into SQLite Database ---")
    db = SessionLocal()
    try:
        # Clear existing assessment domain structure and questions
        print("Clearing old assessment question attempts, answers, and questions...")
        db.query(models.AttemptAnswerNew).delete()
        db.query(models.AssessmentAttemptNew).delete()
        db.query(models.CandidateProgress).delete()
        db.query(models.AssessmentQuestionNew).delete()
        db.query(models.AssessmentSubLevel).delete()
        db.query(models.AssessmentTrack).delete()
        db.query(models.AssessmentDomain).delete()
        db.commit()
        
        # Level names dictionary
        level_names = {
            1: "Level 1: Fundamentals",
            2: "Level 2: Intermediate",
            3: "Level 3: Applied Scenarios",
            4: "Level 4: Advanced Architecture",
            5: "Level 5: Master Case Studies"
        }
        
        inserted_domains = 0
        inserted_sublevels = 0
        inserted_questions = 0
        
        for dom_name, dom_info in compiled_data.items():
            domain = models.AssessmentDomain(
                Name=dom_name,
                Icon_Slug=dom_info["icon"],
                Description=dom_info["desc"],
                Is_Active=True
            )
            db.add(domain)
            db.commit()
            db.refresh(domain)
            inserted_domains += 1
            
            # Single clean track per domain containing the 5 levels
            track = models.AssessmentTrack(
                Domain_ID=domain.Domain_ID,
                Name="Core Track",
                Order_Index=0
            )
            db.add(track)
            db.commit()
            db.refresh(track)
            
            for lvl_num in range(1, 6):
                sublevel = models.AssessmentSubLevel(
                    Track_ID=track.Track_ID,
                    Level_Number=lvl_num,
                    Name=level_names[lvl_num],
                    Question_Count=20,
                    Pass_Threshold_Percent=60.0,
                    Time_Limit_Minutes=20
                )
                db.add(sublevel)
                db.commit()
                db.refresh(sublevel)
                inserted_sublevels += 1
                
                # Insert 20 questions
                for q_obj in dom_info["levels"][lvl_num]:
                    new_q = models.AssessmentQuestionNew(
                        Sub_Level_ID=sublevel.Sub_Level_ID,
                        Domain_ID=domain.Domain_ID,
                        Question_Text=q_obj["Question_Text"],
                        Options=q_obj["Options"],
                        Correct_Option_Index=q_obj["Correct_Option_Index"],
                        Explanation=q_obj["Explanation"],
                        Difficulty_Tag=q_obj["Difficulty_Tag"],
                        Is_Published=True
                    )
                    db.add(new_q)
                    inserted_questions += 1
            
            db.commit()
            
        print(f"\n=== DATABASE SEEDING COMPLETED SUCCESSFULLY! ===")
        print(f" -> Domains Created:   {inserted_domains}")
        print(f" -> SubLevels Created: {inserted_sublevels}")
        print(f" -> Questions Created: {inserted_questions}")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    main()
