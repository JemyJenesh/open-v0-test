#!/bin/bash

# Start development script for Open V0
# This script starts both frontend and backend servers

echo "🚀 Starting Open V0 Development Environment"
echo "   This will start 2 servers:"
echo "   - Backend API (port 54321)"
echo "   - Editor (port 8080)"
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
        echo "   Please edit backend/.env and add your ANTHROPIC_API_KEY"
    else
        echo "ANTHROPIC_API_KEY=your_key_here" > backend/.env
        echo "   Please edit backend/.env and add your ANTHROPIC_API_KEY"
    fi
fi

# Check if editor node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing editor dependencies..."
    npm install
    echo "✅ Editor dependencies installed"
fi

# Start backend and check if it starts successfully
echo "🐍 Starting FastAPI backend on port 54321..."
cd backend
source .venv/bin/activate

# Test that the backend can import successfully before running
if ! python -c "import main" 2>/dev/null; then
    echo "❌ Backend failed to start! Check the error above."
    exit 1
fi

python main.py &
BACKEND_PID=$!
cd ..

# Wait and verify backend is running
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend crashed!"
    exit 1
fi

# Start editor
echo "⚛️  Starting Vision Studio Editor on port 8080..."
npm run dev &
EDITOR_PID=$!

echo ""
echo "✅ All servers are running!"
echo ""
echo "Editor: http://localhost:8080"
echo "Backend API: http://localhost:54321"
echo ""
echo "Select a project directory in the Editor to get started."
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $EDITOR_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

# Wait for processes
wait

