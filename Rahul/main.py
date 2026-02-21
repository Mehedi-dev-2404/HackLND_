from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import tasks_collection, user_collection
from pydantic import BaseModel
from typing import Optional
import uuid

app = FastAPI()

# This lets the frontend talk to your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class Task(BaseModel):
    title: str
    subject: str
    deadline: str
    priority: Optional[int] = 1

class UserState(BaseModel):
    user_id: str
    focus_score: float

# --- Task Endpoints ---
@app.get("/tasks")
def get_tasks():
    tasks = list(tasks_collection.find({}, {"_id": 0}))
    # Sort by priority (higher stress = urgent tasks first)
    return sorted(tasks, key=lambda x: x.get("priority", 1), reverse=True)

@app.post("/tasks")
def create_task(task: Task):
    task_dict = task.dict()
    task_dict["id"] = str(uuid.uuid4())
    tasks_collection.insert_one(task_dict)
    return {"message": "Task created", "id": task_dict["id"]}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    tasks_collection.delete_one({"id": task_id})
    return {"message": "Task deleted"}

# --- Health check ---
@app.get("/")
def root():
    return {"status": "Aura backend running!"}
