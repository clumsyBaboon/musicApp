#!/bin/zsh

git add .

read -p "Enter name of commit: " commit_msg

if [ -z "$commit_msg" ]; then
    commit_msg="auto $(date +'%Y-%m-%d %H:%M:%S')"
fi

echo ""
echo "Using: \"$commit_msg\""
echo ""

git commit -m "$commit_msg"
git push

echo ""
echo "---done---"

read -p "Press [Enter] to continue..."