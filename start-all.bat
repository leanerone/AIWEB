@echo off
chcp 65001 >nul
title AIWEB - AI 分享平台

echo ================================================
echo   AIWEB 一键启动
echo   前端 http://localhost:5173   后端 http://localhost:8000
echo ================================================

start "AIWEB backend" cmd /k "cd /d %~dp0backend && python run.py"
start "AIWEB frontend" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 3 >nul
start http://localhost:5173
