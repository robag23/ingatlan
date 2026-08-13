@echo off
chcp 65001 >nul
title Sziget-Baracsi Ingatlan - Import + GitHub
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    py -m venv .venv
    if errorlevel 1 (
        echo Python nincs telepitve.
        pause
        exit /b 1
    )
    call ".venv\Scripts\activate.bat"
    python -m pip install --upgrade pip
    pip install -r requirements-local.txt
) else (
    call ".venv\Scripts\activate.bat"
)

python scripts\local_import.py --push
pause
