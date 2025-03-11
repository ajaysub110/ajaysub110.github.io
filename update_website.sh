#!/bin/bash

# Check if Python script exists
if [ ! -f "parse_resume.py" ]; then
    echo "Error: parse_resume.py not found"
    exit 1
fi

# Run the Python script to update publications
python3 parse_resume.py

# Add all changes to git
git add index.html

# Commit changes if there are any
if [ -n "$(git status --porcelain)" ]; then
    git commit -m "Update resume from resume.tex"
    git push
    echo "Website updated successfully!"
else
    echo "No changes to commit"
fi 