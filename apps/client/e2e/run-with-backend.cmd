@echo off
REM Start the backend in the background, then run the Vite preview in the
REM foreground. The backend's stdout/stderr go to a log file the e2e
REM runner can tail on failure.
set BACKEND_LOG=%TEMP%\shoot4fun-backend-e2e.log
start "shoot4fun-backend" /B cmd /c "D:\Personal\shoot4fun\backend\.venv\Scripts\python.exe -m uvicorn shoot4fun_backend.adapters.inbound.http.app:create_app --factory --host 127.0.0.1 --port 8000 --log-level warning > %BACKEND_LOG% 2>&1"
timeout /t 3 /nobreak > nul
D:\Personal\shoot4fun\apps\client\node_modules\.bin\vite preview --port 4173 --host 127.0.0.1
