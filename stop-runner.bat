@echo off
cd /d %~dp0
if exist .runner-pids.json (
  for /f "tokens=2 delims=:," %%a in ('findstr /i "managerPid" .runner-pids.json') do set MPID=%%a
  for /f "tokens=2 delims=:," %%a in ('findstr /i "watchPid" .runner-pids.json') do set WPID=%%a
  for /f "tokens=2 delims=:," %%a in ('findstr /i "serverPid" .runner-pids.json') do set SPID=%%a
  set MPID=%MPID: =%
  set WPID=%WPID: =%
  set SPID=%SPID: =%
  if not "%SPID%"=="" taskkill /PID %SPID% /F >nul 2>nul
  if not "%WPID%"=="" taskkill /PID %WPID% /F >nul 2>nul
  if not "%MPID%"=="" taskkill /PID %MPID% /F >nul 2>nul
  del .runner-pids.json >nul 2>nul
  echo Stopped runner processes.
) else (
  echo No .runner-pids.json found. You can run: taskkill /F /IM node.exe
)
