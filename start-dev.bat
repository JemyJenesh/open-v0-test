@echo off
REM Start development script for Open V0 (Windows)
REM This script starts both frontend and backend servers

echo 🚀 Starting Open V0 Development Environment
echo    This will start 2 servers:
echo    - Backend API (port 54321)
echo    - Editor (port 8080)
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
    ) else (
        echo ANTHROPIC_API_KEY= > backend\.env
    )
)

REM Load and check API key
setlocal enabledelayedexpansion
set "API_KEY="
for /f "tokens=1,* delims==" %%a in ('type backend\.env ^| findstr /r "^ANTHROPIC_API_KEY="') do (
    set "API_KEY=%%b"
)

REM Check if API key needs to be set
if "!API_KEY!"=="" goto :ask_key
if "!API_KEY!"=="your_anthropic_api_key_here" goto :ask_key
if "!API_KEY!"=="your_key_here" goto :ask_key
goto :key_ok

:ask_key
echo.
echo 🔑 Anthropic API Key Required
echo    Open V0 uses Claude AI to help you build applications.
echo    Get your API key from: https://console.anthropic.com/settings/keys
echo.

:ask_key_loop
set /p "api_key=Enter your Anthropic API key (sk-ant-...): "

if "!api_key!"=="" (
    echo ❌ API key cannot be empty. Please try again.
    goto :ask_key_loop
)

echo !api_key! | findstr /r "^sk-ant-" >nul
if errorlevel 1 (
    echo ❌ Invalid API key format. Anthropic keys start with 'sk-ant-'
    goto :ask_key_loop
)

REM Save to .env file
echo ANTHROPIC_API_KEY=!api_key! > backend\.env
set "ANTHROPIC_API_KEY=!api_key!"
echo ✅ API key saved to backend\.env

:key_ok
endlocal

REM Check if editor node_modules exists
if not exist "node_modules" (
    echo 📦 Installing editor dependencies...
    call npm install
    echo ✅ Editor dependencies installed
)

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
echo Editor: http://localhost:8080
echo Backend API: http://localhost:54321
echo.
echo Select a project directory in the Editor to get started.
echo Close the terminal windows to stop the servers
pause
