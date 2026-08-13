@echo off
chcp 65001 >nul
title Sziget-Baracsi - Ingatlan kepek helyi letoltese
cd /d "%~dp0"

echo.
echo ==============================================
echo   INGATLAN KEPEK LETOLTESE GITHUBHOZ
echo ==============================================
echo.
echo Ez csak a properties.json-ban mar meglevo
echo kep URL-eket tolti le. Nem olvassa ujra a
echo hirdetes oldalakat.
echo.

if not exist ".imagevenv\Scripts\python.exe" (
    echo Elso inditas - Python kornyezet letrehozasa...
    py -m venv .imagevenv
    if errorlevel 1 (
        echo.
        echo HIBA: Python nincs telepitve.
        echo Telepits Python 3.11 vagy ujabb verziot.
        pause
        exit /b 1
    )

    call ".imagevenv\Scripts\activate.bat"
    python -m pip install --upgrade pip
    pip install -r requirements-images.txt
) else (
    call ".imagevenv\Scripts\activate.bat"
)

echo.
python scripts\download_property_images.py
echo.
pause
