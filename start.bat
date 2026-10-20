@echo off
chcp 65001 >nul
title 保冊
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo 找不到 Node.js。請先到 https://nodejs.org 安裝，然後再雙擊這個檔案。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 第一次啟動，正在安裝元件...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo 保冊啟動中。請勿關閉此視窗，關閉即停止系統。
echo 瀏覽器會打開 http://127.0.0.1:5173
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:5173"
npm run dev
pause
