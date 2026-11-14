@echo off
setlocal
cd /d "%~dp0"
py -3.12 -m venv backend\.venv
if errorlevel 1 goto failed
backend\.venv\Scripts\python.exe -m pip install --timeout 90 pip==26.3
if errorlevel 1 goto failed
backend\.venv\Scripts\python.exe -m pip install --timeout 90 -r backend\requirements.txt
if errorlevel 1 goto failed
pushd frontend
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 (popd & goto failed)
popd
backend\.venv\Scripts\python.exe backend\scripts\prepare_demo.py
if errorlevel 1 goto failed
echo Setup finished. Open Start Smart Writing.cmd to run the editor.
pause
exit /b 0
:failed
echo Setup stopped. Read the error above and run this script again.
pause
exit /b 1
