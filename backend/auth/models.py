from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "zaxis_db")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]
users_collection = db["users"]

# Create an index on email for fast lookups and to ensure uniqueness
users_collection.create_index("email", unique=True)
