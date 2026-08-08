@echo off
cd /d %~dp0
title Chabos United - CMS Sync to Local
where python >nul 2>&1
if errorlevel 1 (
    echo Python wurde nicht gefunden.
    pause
    exit /b 1
)
python sync_cms_from_cloudflare.py
echo.
pause
