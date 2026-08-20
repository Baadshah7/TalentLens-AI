import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import SessionLocal
import models


def seed():
    db = SessionLocal()
    try:
        # remove existing sample test if present so we can recreate with updated questions
        existing = db.query(models.AssessmentTest).filter(models.AssessmentTest.Title == 'Sample MCQ Test').first()
        if existing:
            print('Existing sample test found (id', existing.Test_ID, ') - removing')
            # delete associated questions (cascade should handle but ensure cleanup)
            qs = db.query(models.AssessmentQuestion).filter(models.AssessmentQuestion.Test_ID == existing.Test_ID).all()
            for q in qs:
                db.delete(q)
            db.delete(existing)
            db.commit()

        test = models.AssessmentTest(Title='Sample MCQ Test', Duration_Sec=900)
        db.add(test)
        db.commit()
        db.refresh(test)

        questions = [
            ("Which backend framework is used in this project?", ['Express (Node)', 'FastAPI (Python)', 'Gin (Go)', 'Rails (Ruby)'], 1),
            ("What is an ORM used for?", ['Styling pages', 'Mapping objects to DB rows', 'Handling HTTP', 'Testing code'], 1),
            ("Which HTTP method is typically used to create a resource?", ['GET','POST','PUT','DELETE'], 1),
            ("What does SQL injection exploit?", ['Slow queries','Unescaped user input','Missing index','Schema mismatch'], 1),
            ("In REST, which status code indicates resource not found?", ['200','201','404','500'], 2),
            ("What is the purpose of migrations in databases?", ['Deploy UI','Modify DB schema over time','Cache responses','Encrypt data'], 1),
            ("Which tool is used for dependency management in Python?", ['npm','pip','gem','cargo'], 1),
            ("What does CI/CD stand for?", ['Code Integration / Continuous Delivery','Continuous Integration / Continuous Deployment','Client Integration / Code Delivery','Continuous Iteration / Continuous Debugging'], 1),
            ("Which header carries authentication tokens in HTTP requests?", ['X-Auth','Authorization','Auth-Token','Cookie'], 1),
            ("What is idempotence in APIs?", ['Operation can be repeated without changing result','Operation is fast','Operation uses GET only','Operation requires auth'], 0)
        ]

        q_objs = []
        for txt, opts, correct in questions:
            q_objs.append(models.AssessmentQuestion(Test_ID=test.Test_ID, Text=txt, Options=opts, Correct_Index=correct, Points=1))

        db.add_all(q_objs)
        db.commit()
        print('Seeded test id', test.Test_ID, 'with', len(q_objs), 'questions')
    finally:
        db.close()

if __name__ == '__main__':
    seed()
