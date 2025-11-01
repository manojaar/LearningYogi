#!/bin/bash

# Helper script to set up Git and prepare for GitHub push
# Usage: ./setup-github.sh [github-username] [repository-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== LearningYogi GitHub Setup Script ===${NC}\n"

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: Git is not installed. Please install Git first.${NC}"
    echo "Visit: https://git-scm.com/downloads"
    exit 1
fi

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Check if already a git repo
if [ -d .git ]; then
    echo -e "${YELLOW}Warning: Git repository already initialized.${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo -e "${GREEN}Initializing Git repository...${NC}"
    git init
fi

# Create root .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo -e "${GREEN}Creating root .gitignore...${NC}"
    cat > .gitignore << 'EOF'
# Environment files
.env
.env.local
.env.*.local
*.env

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
env.bak/
venv.bak/
*.egg-info/
dist/
build/
*.egg

# Virtual environments
.venv/
virtualenv/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.cursor/

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
Thumbs.db
desktop.ini

# Logs
logs/
*.log
*.log.*

# Build outputs
dist/
build/
*.tsbuildinfo

# Test coverage
coverage/
htmlcov/
.nyc_output/
.coverage
.pytest_cache/

# Docker
.docker/

# Database files
*.db
*.sqlite
*.sqlite3

# Data directories (exclude large uploads, keep structure)
data/uploads/*
!data/uploads/.gitkeep
data/processed/*
!data/processed/.gitkeep
data/database/*
!data/database/.gitkeep

# Keep sample timetables
!data/sample_timetables/

# Temporary files
*.tmp
*.temp
*.bak
*.backup

# Compiled files
*.class
*.dll
*.exe
*.o
*.so

# Archives
*.zip
*.tar
*.tar.gz
*.rar

# Local settings
settings.local.json
*.local.json

# Terraform
*.tfstate
*.tfstate.*
.terraform/

# Kubernetes secrets
*.secret.yaml
*.secret.yml
EOF
    echo -e "${GREEN}✓ Created .gitignore${NC}"
else
    echo -e "${YELLOW}.gitignore already exists, skipping...${NC}"
fi

# Check Git config
echo -e "\n${GREEN}Checking Git configuration...${NC}"
if [ -z "$(git config user.name)" ]; then
    echo -e "${YELLOW}Git user.name is not set.${NC}"
    read -p "Enter your name: " git_name
    git config user.name "$git_name"
fi

if [ -z "$(git config user.email)" ]; then
    echo -e "${YELLOW}Git user.email is not set.${NC}"
    read -p "Enter your email: " git_email
    git config user.email "$git_email"
fi

echo -e "${GREEN}✓ Git configured:${NC}"
echo "  Name: $(git config user.name)"
echo "  Email: $(git config user.email)"

# Show status
echo -e "\n${GREEN}Current Git status:${NC}"
git status --short | head -20
if [ $(git status --short | wc -l) -gt 20 ]; then
    echo "... (and more files)"
fi

# Ask if user wants to stage files
echo -e "\n${YELLOW}Do you want to stage all files now? (y/n)${NC}"
read -p "> " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Staging files...${NC}"
    git add .
    echo -e "${GREEN}✓ Files staged${NC}"
    
    echo -e "\n${YELLOW}Enter commit message (or press Enter for default):${NC}"
    read -p "> " commit_msg
    if [ -z "$commit_msg" ]; then
        commit_msg="Initial commit: LearningYogi POC implementations"
    fi
    
    git commit -m "$commit_msg"
    echo -e "${GREEN}✓ Files committed${NC}"
fi

# Check for remote
if git remote | grep -q origin; then
    echo -e "\n${YELLOW}Remote 'origin' already exists:${NC}"
    git remote -v
else
    echo -e "\n${YELLOW}No remote repository configured yet.${NC}"
    GITHUB_USER="${1:-}"
    REPO_NAME="${2:-LearningYogi}"
    
    if [ -z "$GITHUB_USER" ]; then
        echo -e "${YELLOW}To add remote, you'll need to:${NC}"
        echo "1. Create a repository on GitHub"
        echo "2. Run: git remote add origin https://github.com/USERNAME/$REPO_NAME.git"
        echo "   Or: git remote add origin git@github.com:USERNAME/$REPO_NAME.git"
        echo "3. Run: git push -u origin main"
    else
        echo -e "\n${GREEN}Would you like to add remote now?${NC}"
        read -p "GitHub username (default: $GITHUB_USER): " input_user
        GITHUB_USER="${input_user:-$GITHUB_USER}"
        
        read -p "Repository name (default: $REPO_NAME): " input_repo
        REPO_NAME="${input_repo:-$REPO_NAME}"
        
        echo -e "\n${YELLOW}Choose remote URL type:${NC}"
        echo "1) HTTPS (requires Personal Access Token)"
        echo "2) SSH (requires SSH keys configured)"
        read -p "Enter choice (1 or 2): " url_choice
        
        if [ "$url_choice" = "1" ]; then
            git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
            echo -e "${GREEN}✓ Added HTTPS remote${NC}"
        elif [ "$url_choice" = "2" ]; then
            git remote add origin "git@github.com:$GITHUB_USER/$REPO_NAME.git"
            echo -e "${GREEN}✓ Added SSH remote${NC}"
        else
            echo -e "${RED}Invalid choice. Remote not added.${NC}"
        fi
    fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
echo -e "\n${GREEN}Current branch: $CURRENT_BRANCH${NC}"

# Summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. If you haven't created a GitHub repository yet:"
echo "   - Go to https://github.com/new"
echo "   - Create a repository named: LearningYogi"
echo "   - DO NOT initialize with README/gitignore"
echo ""
echo "2. If remote is not added, add it:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/LearningYogi.git"
echo ""
echo "3. Push to GitHub:"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "4. For authentication:"
echo "   - HTTPS: Use Personal Access Token as password"
echo "   - SSH: Ensure SSH keys are set up"
echo "   - Or use: gh auth login (if GitHub CLI installed)"
echo ""
echo -e "${GREEN}See GITHUB_SETUP.md for detailed instructions!${NC}"

