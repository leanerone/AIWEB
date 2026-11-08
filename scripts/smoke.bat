@echo off
chcp 65001 >nul
title AIWEB smoke test

echo ================================================
echo  AIWEB 冒烟自测
echo ================================================

cd /d %~dp0..\backend

echo.
echo [1/3] pytest 单元与接口测试
python -m pytest tests\ -q
if errorlevel 1 goto :fail

echo.
echo [2/3] 后端启动
start /b python run.py > %TEMP%\aiweb-smoke.log 2>&1
timeout /t 5 /nobreak >nul

echo [3/3] 接口冒烟
curl -s http://localhost:8000/api/health | findstr "ok" >nul
if errorlevel 1 goto :fail
echo   health OK
curl -s -o nul -w "windows-sso %%{http_code}\n" http://localhost:8000/api/auth/windows
curl -s -o nul -w "docs %%{http_code}\n" http://localhost:8000/docs

taskkill /f /im python.exe >nul 2>&1
echo.
echo 全部通过 ✓
pause
exit /b 0

:fail
taskkill /f /im python.exe >nul 2>&1
echo.
echo 存在失败项 ✗
pause
exit /b 1
