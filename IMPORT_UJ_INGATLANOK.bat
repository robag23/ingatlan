@echo off
chcp 65001 >nul
title Sziget-Baracsi Ingatlan - Uj ingatlanok importalasa
cd /d "%~dp0"

echo.
echo ==============================================
echo   SZIGET-BARACSI INGATLAN - HELYI IMPORT
echo ==============================================
echo.
echo Csak az uj, meg nem importalt hirdeteseket olvassa be.
echo.

if not exist ".venv\Scripts\python.exe" (
    echo Elso inditas - Python kornyezet letrehozasa...
    py -m venv .venv
    if errorlevel 1 (
        echo.
        echo HIBA: Python nincs telepitve vagy a "py" parancs nem erheto el.
        echo Telepits Python 3.11 vagy ujabb verziot.
        pause
        exit /b 1
    )
    call ".venv\Scripts\activate.bat"
    python -m pip install --upgrade pip
    pip install -r requirements-local.txt
) else (
    call ".venv\Scripts\activate.bat"
)

echo.
python scripts\local_import.py
echo.
echo Kesz. Ha minden jo, Commit/Push GitHubra.
pause
