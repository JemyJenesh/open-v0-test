@echo off
REM Start development script for React Vision Studio (Windows)
REM This script starts both frontend and backend servers

echo 🚀 Starting React Vision Studio Development Servers
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

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    call npm install
    echo ✅ Frontend dependencies installed
)

REM Start backend in new window
echo 🐍 Starting FastAPI backend on port 54321...
start "FastAPI Backend" cmd /k "cd backend && venv\Scripts\activate && python main.py"

REM Wait a bit for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend in new window
echo ⚛️  Starting Vite frontend on port 8080...
start "Vite Frontend" cmd /k "npm run dev"

echo.
echo ✅ Both servers are starting in separate windows!
echo.
echo Frontend: http://localhost:8080
echo Backend:  http://localhost:54321
echo Backend API Docs: http://localhost:54321/docs
echo.
echo Close the terminal windows to stop the servers
pause
