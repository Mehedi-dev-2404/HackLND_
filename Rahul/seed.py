# seed.py — run this once: python seed.py
from database import tasks_collection

demo_tasks = [
    {"id": "1", "title": "Macroeconomics Essay", "subject": "Economics", "deadline": "Today 4PM", "priority": 3},
    {"id": "2", "title": "Python practice for HSBC test", "subject": "Career", "deadline": "Feb 22", "priority": 2},
    {"id": "3", "title": "Read Bank of England report", "subject": "Economics", "deadline": "This week", "priority": 1},
]

tasks_collection.insert_many(demo_tasks)
print("Demo data seeded!")