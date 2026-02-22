#!/bin/bash

# ==========================
# 🔧 Fix API Key Script
# ==========================
# This script helps you set up a new API key after expiration

echo ""
echo "🔑 API Key Setup Helper"
echo "======================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Creating .env from template..."
    cp .env.example .env
fi

echo "📝 Your API key has expired. Here's what to do:"
echo ""
echo "STEP 1: Get a new Google API key"
echo "   👉 Visit: https://aistudio.google.com/app/apikey"
echo "   👉 Click 'Create API key' (or 'Get API key')"
echo "   👉 Select your project (or create a new one)"
echo "   👉 Copy the key (starts with AIza...)"
echo ""

echo "STEP 2: Update your .env file"
echo "   👉 Open: .env"
echo "   👉 Replace YOUR_NEW_API_KEY_HERE with your actual key"
echo ""

echo "STEP 3: Test the setup"
echo "   👉 Run: python test_model.py"
echo ""

echo "Current .env file location: $(pwd)/.env"
echo ""

read -p "Press Enter to open .env file in nano editor (or Ctrl+C to cancel)..." 

nano .env

echo ""
echo "✅ .env file updated!"
echo ""
echo "🧪 Testing the API key..."
python test_model.py
