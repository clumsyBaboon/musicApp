@echo off

git add .

if "%~1" == "" (
    git commit -m "auto %date%  %time%"
) else (
    git commit -m "%*"
)

git push

echo ---done---
pause

git clone https://github.com/example.git