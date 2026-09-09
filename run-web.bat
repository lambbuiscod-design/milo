@echo off
title Milo Web Dashboard
echo Starting Milo Web Server at http://localhost:3000 ...
cd /d "C:\Users\abdul\Desktop\Buisness codex\milo"
pnpm --filter @milo/web dev
pause
