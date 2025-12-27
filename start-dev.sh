#!/bin/bash

# Start development script for React Vision Studio
# This script starts both frontend and backend servers

echo "🚀 Starting React Vision Studio Development Environment"
echo "   This will start 3 servers:"
echo "   - Demo Project (port 3000)"
echo "   - Backend API (port 54321)"
echo "   - Vision Studio Editor (port 8080)"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js."
    exit 1
fi

# Check if backend virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
    echo "✅ Virtual environment created and dependencies installed"
fi

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: backend/.env file not found!"
    echo "   Creating from env.example..."
    if [ -f "backend/env.example" ]; then
        cp backend/env.example backend/.env
        echo "   Please edit backend/.env and add your OPENAI_API_KEY"
    else
        echo "OPENAI_API_KEY=your_key_here" > backend/.env
        echo "   Please edit backend/.env and add your OPENAI_API_KEY"
    fi
fi

# Check if editor node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing editor dependencies..."
    npm install
    echo "✅ Editor dependencies installed"
fi

# Check if demo project node_modules exists
if [ ! -d "demo-project/node_modules" ]; then
    echo "📦 Installing demo project dependencies..."
    cd demo-project
    npm install
    cd ..
    echo "✅ Demo project dependencies installed"
fi

# Start demo project
echo "🎨 Starting Demo Project on port 3000..."
cd demo-project
npm run dev &
DEMO_PID=$!
cd ..

# Wait a bit
sleep 1

# Start backend in background
echo "🐍 Starting FastAPI backend on port 54321..."
cd backend
source .venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start editor
echo "⚛️  Starting Vision Studio Editor on port 8080..."
npm run dev &
EDITOR_PID=$!

echo ""
echo "✅ All servers are starting!"
echo ""
echo "Demo Project: http://localhost:3000"
echo "Vision Studio Editor: http://localhost:8080"
echo "Backend API: http://localhost:54321"
echo "Backend API Docs: http://localhost:54321/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $DEMO_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    kill $EDITOR_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

# Wait for processes
wait

