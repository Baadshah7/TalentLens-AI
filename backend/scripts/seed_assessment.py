import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import SessionLocal
import models


def seed():
    db = SessionLocal()
    try:
        # check if test exists
        existing = db.query(models.AssessmentTest).filter(models.AssessmentTest.Title == 'Sample MCQ Test').first()
        if existing:
            print('Sample test already exists with id', existing.Test_ID)
            return

        test = models.AssessmentTest(Title='Sample MCQ Test', Duration_Sec=300)
        db.add(test)
        db.commit()
        db.refresh(test)

        q1 = models.AssessmentQuestion(Test_ID=test.Test_ID, Text='What is 2 + 2?', Options=['3','4','5','6'], Correct_Index=1, Points=1)
        q2 = models.AssessmentQuestion(Test_ID=test.Test_ID, Text='Which language is this project using for backend?', Options=['Node.js','Python','Go','Ruby'], Correct_Index=1, Points=1)
        q3 = models.AssessmentQuestion(Test_ID=test.Test_ID, Text='HTTP status for OK is?', Options=['200','404','500','401'], Correct_Index=0, Points=1)

        db.add_all([q1, q2, q3])
        db.commit()
        print('Seeded test id', test.Test_ID)
    finally:
        db.close()

if __name__ == '__main__':
    seed()
