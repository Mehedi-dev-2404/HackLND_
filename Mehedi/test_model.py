import os
from dotenv import load_dotenv
from google import genai

# Load .env from current directory
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY not found in .env")

print("Using API key:", api_key[:8] + "..." + api_key[-4:])  # Masked for safety

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say hello from Gemini!"
    )
    print("Gemini says:", response.text)
except Exception as e:
    print("❌ ERROR:", e)