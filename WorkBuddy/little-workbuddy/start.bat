@echo off
chcp 65001 >nul
title My Little WorkBuddy
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    echo ❌ 没有找到 Python。请先安装：https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

echo 🌷 正在启动 WorkBuddy...
echo    地址: http://localhost:8080
echo    按 Ctrl+C 停止
echo.

start "" http://localhost:8080
%PY% -m http.server 8080
