@echo off
REM Start development script for React Vision Studio (Windows)
REM This script starts both frontend and backend servers

echo 🚀 Starting React Vision Studio Development Environment
echo    This will start 3 servers:
echo    - Demo Project (port 3000)
echo    - Backend API (port 54321)
echo    - Vision Studio Editor (port 8080)
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js.
    exit /b 1
)

REM Check if backend virtual environment exists
if not exist "backend\venv" (
    echo 📦 Creating Python virtual environment...
    cd backend
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
    cd ..
    echo ✅ Virtual environment created and dependencies installed
)

REM Check if backend .env exists
if not exist "backend\.env" (
    echo ⚠️  Warning: backend\.env file not found!
    echo    Creating from env.example...
    if exist "backend\env.example" (
        copy backend\env.example backend\.env
        echo    Please edit backend\.env and add your OPENAI_API_KEY
    ) else (
        echo OPENAI_API_KEY=your_key_here > backend\.env
        echo    Please edit backend\.env and add your OPENAI_API_KEY
    )
)

REM Check if editor node_modules exists
if not exist "node_modules" (
    echo 📦 Installing editor dependencies...
    call npm install
    echo ✅ Editor dependencies installed
)

REM Check if demo project node_modules exists
if not exist "demo-project\node_modules" (
    echo 📦 Installing demo project dependencies...
    cd demo-project
    call npm install
    cd ..
    echo ✅ Demo project dependencies installed
)

REM Start demo project in new window
echo 🎨 Starting Demo Project on port 3000...
start "Demo Project" cmd /k "cd demo-project && npm run dev"

REM Wait a bit
timeout /t 1 /nobreak >nul

REM Start backend in new window
echo 🐍 Starting FastAPI backend on port 54321...
start "FastAPI Backend" cmd /k "cd backend && venv\Scripts\activate && python main.py"

REM Wait a bit for backend to start
timeout /t 2 /nobreak >nul

REM Start editor in new window
echo ⚛️  Starting Vision Studio Editor on port 8080...
start "Vision Studio Editor" cmd /k "npm run dev"

echo.
echo ✅ All servers are starting in separate windows!
echo.
echo Demo Project: http://localhost:3000
echo Vision Studio Editor: http://localhost:8080
echo Backend API: http://localhost:54321
echo Backend API Docs: http://localhost:54321/docs
echo.
echo Close the terminal windows to stop the servers
pause
