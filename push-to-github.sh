#!/bin/bash
# =============================================================
# GitHub Push Script - Restaurant Billing App
# Run this ONCE after downloading the project to push to GitHub
# =============================================================

echo ""
echo "🍽️  RestoBill — GitHub Push Script"
echo "===================================="
echo ""

# Check git is installed
if ! command -v git &> /dev/null; then
  echo "❌ Git is not installed. Download from https://git-scm.com/downloads"
  exit 1
fi

# Ask for repo URL
echo "Step 1: Enter your GitHub repository URL"
echo "   (looks like: https://github.com/YourUsername/restaurant-billing-app.git)"
echo ""
read -p "Repo URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
  echo "❌ No URL entered. Exiting."
  exit 1
fi

# Init git if not already
if [ ! -d ".git" ]; then
  git init
  echo "✓ Git initialized"
fi

# Create .gitignore for safety (ensure .env is never pushed)
cat > .gitignore << 'EOF'
node_modules/
.next/
.env
*.env.local
.DS_Store
npm-debug.log*
EOF
echo "✓ .gitignore updated (your .env file will NOT be pushed - it contains passwords)"

# Stage all files
git add .

# Commit
git commit -m "feat: initial restaurant billing app setup (Phase 1-6)"

# Set main branch
git branch -M main

# Add remote (remove old if exists)
git remote remove origin 2>/dev/null
git remote add origin "$REPO_URL"

# Push
echo ""
echo "Pushing to GitHub... (you may be asked for your GitHub password/token)"
echo ""
git push -u origin main

echo ""
echo "✅ Done! Your code is now on GitHub."
echo "   Open: $REPO_URL"
echo ""
echo "📌 For future updates, just run:"
echo "   git add ."
echo "   git commit -m 'your change description'"
echo "   git push"
echo ""
