@echo off
setlocal
cd /d "%~dp0"
if not exist backend\.venv\Scripts\python.exe (
  echo Run Setup Smart Writing.cmd first.
  pause
  exit /b 1
)
backend\.venv\Scripts\python.exe backend\scripts\start_demo.py %*
set "result=%errorlevel%"
if not "%result%"=="0" pause
exit /b %result%
