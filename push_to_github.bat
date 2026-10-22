@echo off
chcp 65001 >nul
title GitHub ga Push Qilish - Bourkhan Trans
cd /d D:\btrans
echo ========================================================
echo   BOURKHAN TRANS LOYIHASINI GITHUB GA PUSH QILISH
echo ========================================================
echo.
echo GitHub hisobingizga kirish oynasi ochilsa, "Sign in with your browser"
echo tugmasini bosing yoki ruxsat bering.
echo.
"D:\Program Files\Git\cmd\git.exe" push -u origin main
echo.
echo ========================================================
echo   Push jarayoni yakunlandi.
echo ========================================================
echo.
pause
