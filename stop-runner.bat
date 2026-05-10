@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

if not exist .runner-pids.json (
  echo No .runner-pids.json found. You can run: taskkill /F /IM node.exe
  exit /b 0
)

set "MPID="
set "WPID="
set "SPID="

for /f "tokens=2 delims=:," %%a in ('findstr /i "managerPid" .runner-pids.json') do set "MPID=%%a"
for /f "tokens=2 delims=:," %%a in ('findstr /i "watchPid"   .runner-pids.json') do set "WPID=%%a"
for /f "tokens=2 delims=:," %%a in ('findstr /i "serverPid"  .runner-pids.json') do set "SPID=%%a"

set "MPID=!MPID: =!"
set "WPID=!WPID: =!"
set "SPID=!SPID: =!"

if /i "!MPID!"=="null" set "MPID="
if /i "!WPID!"=="null" set "WPID="
if /i "!SPID!"=="null" set "SPID="

if defined SPID taskkill /PID !SPID! /T /F >nul 2>nul
if defined WPID taskkill /PID !WPID! /T /F >nul 2>nul
if defined MPID taskkill /PID !MPID! /T /F >nul 2>nul

del .runner-pids.json >nul 2>nul
echo Stopped runner processes (manager=!MPID! watch=!WPID! server=!SPID!).
endlocal
