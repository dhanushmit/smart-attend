@echo off
echo ==========================================
echo Starting SmartAttend AI Development Environment
echo ==========================================

:: Start Backend
echo Launching Flask Backend...
start "Backend (Flask)" cmd /k "cd /d %~dp0backend && ..\.venv\Scripts\python app.py"

:: Start Frontend
echo Launching Vite Frontend...
start "Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [INFO] Both services are starting in separate terminal windows.
echo [INFO] Backend: http://127.0.0.1:5000
echo [INFO] Frontend: http://localhost:5173
echo ==========================================
exit
