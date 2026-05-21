@echo off
title Bin Group AI Server
echo ========================================
echo    Bin Group AI - Starting...
echo ========================================
cd /d "C:\Users\FBF TECH\.gemini\antigravity\scratch\commandcenter-ai"
set PATH=C:\Program Files\nodejs;%PATH%
node server/index.js
pause
