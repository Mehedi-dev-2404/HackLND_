from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["aura"]

tasks_collection = db["tasks"]
user_collection = db["users"]