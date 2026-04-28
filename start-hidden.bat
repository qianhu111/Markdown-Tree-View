@echo off
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -FilePath node -ArgumentList 'launcher.js --headless' -WorkingDirectory '%~dp0'"
echo Runner started in background.
