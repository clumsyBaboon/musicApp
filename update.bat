@echo off

git add .

set /p "commit_msg=Enter name of commit: "

if "%commit_msg%"=="" (
    set "commit_msg=auto %date% %time%"
)

echo.
echo Using: "%commit_msg%"

git commit -m "%commit_msg%"
git push

echo.
echo ---done---
pause