@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "IUH GradeTrack Server" /min cmd /c "py -m http.server 8000"
  timeout /t 1 /nobreak >nul
  start "" http://localhost:8000
  echo IUH GradeTrack is available at http://localhost:8000
  echo Close the server window to stop it.
  pause
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "IUH GradeTrack Server" /min cmd /c "python -m http.server 8000"
  timeout /t 1 /nobreak >nul
  start "" http://localhost:8000
  echo IUH GradeTrack is available at http://localhost:8000
  echo Close the server window to stop it.
  pause
  goto :eof
)
echo Python 3 was not found. Install Python 3, then run this file again.
pause
