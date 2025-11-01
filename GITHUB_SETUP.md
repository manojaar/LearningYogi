# Detailed Steps to Check Work into Personal GitHub

This guide will walk you through setting up Git and pushing your LearningYogi project to your personal GitHub account.

## Prerequisites

1. **Git installed** - Check if Git is installed:
   ```bash
   git --version
   ```
   If not installed, install it: https://git-scm.com/downloads

2. **GitHub account** - Make sure you have a GitHub account at https://github.com

3. **GitHub authentication** - You'll need either:
   - Personal Access Token (recommended for HTTPS)
   - SSH key configured (for SSH)
   - GitHub CLI (`gh`) authenticated

---

## Step-by-Step Instructions

### Step 1: Initialize Git Repository

Navigate to your project root and initialize Git:

```bash
cd /Users/manojramakrishnapillai/LearningYogi
git init
```

### Step 2: Create Root-Level .gitignore (if needed)

Create a comprehensive `.gitignore` file at the root level to exclude unnecessary files:

```bash
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
```

### Step 3: Configure Git (if not already configured)

Set your Git identity (if not already set globally):

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

To set globally for all repositories:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 4: Check Git Status

See what files will be tracked:

```bash
git status
```

### Step 5: Add Files to Staging

Add all files (respecting .gitignore):

```bash
git add .
```

Or add files selectively:
```bash
git add README.md
git add docs/
git add POCImplementations/
# ... etc
```

### Step 6: Make Your First Commit

```bash
git commit -m "Initial commit: LearningYogi POC implementations"
```

Use descriptive commit messages:
- `git commit -m "Add: POCDemoImplementation with timetable extraction"`
- `git commit -m "Docs: Add architecture documentation"`

### Step 7: Create GitHub Repository

**Option A: Using GitHub Website**
1. Go to https://github.com/new
2. Repository name: `LearningYogi` (or your preferred name)
3. Description: "Learning Yogi POC implementations for timetable extraction and AI chatbot"
4. Choose: **Private** (recommended) or **Public**
5. **DO NOT** initialize with README, .gitignore, or license (since you already have files)
6. Click "Create repository"

**Option B: Using GitHub CLI** (if installed)
```bash
gh repo create LearningYogi --private --source=. --remote=origin --push
```

### Step 8: Add Remote Repository

After creating the repository on GitHub, add it as a remote:

**For HTTPS:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/LearningYogi.git
```

**For SSH:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/LearningYogi.git
```

Replace `YOUR_USERNAME` with your actual GitHub username.

Verify the remote was added:
```bash
git remote -v
```

### Step 9: Authenticate (if using HTTPS)

If using HTTPS, GitHub requires authentication:

**Option 1: Personal Access Token (PAT)**
1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy the token
5. When pushing, use the token as password:
   ```bash
   git push -u origin main
   # Username: YOUR_USERNAME
   # Password: YOUR_PERSONAL_ACCESS_TOKEN
   ```

**Option 2: GitHub CLI (easier)**
```bash
gh auth login
```

**Option 3: SSH Keys** (if using SSH)
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your.email@example.com"`
2. Add to GitHub: https://github.com/settings/keys
3. Test: `ssh -T git@github.com`

### Step 10: Push to GitHub

Push your code to GitHub:

```bash
# If your default branch is 'main'
git branch -M main
git push -u origin main

# Or if it's 'master'
git branch -M master
git push -u origin master
```

The `-u` flag sets up tracking so future pushes can just use `git push`.

### Step 11: Verify on GitHub

1. Go to your repository on GitHub: `https://github.com/YOUR_USERNAME/LearningYogi`
2. Verify all files are uploaded correctly
3. Check that large/unnecessary files are excluded

---

## Quick Command Summary

```bash
# Initialize and setup
cd /Users/manojramakrishnapillai/LearningYogi
git init
git add .
git commit -m "Initial commit: LearningYogi project"

# Create repo on GitHub (via website or CLI)
# Then connect and push:
git remote add origin https://github.com/YOUR_USERNAME/LearningYogi.git
git branch -M main
git push -u origin main
```

---

## Common Issues and Solutions

### Issue: Authentication failed
**Solution:** Use Personal Access Token instead of password, or set up SSH keys

### Issue: Large file warning
**Solution:** 
- Check `.gitignore` is working
- Use `git rm --cached <file>` to remove tracked large files
- Consider Git LFS for large files: `git lfs install`

### Issue: Branch name mismatch
**Solution:**
```bash
git branch -M main  # Rename to main
# or
git branch -M master  # Rename to master
```

### Issue: Want to exclude more files
**Solution:** Add patterns to `.gitignore` and commit the change

---

## Best Practices Going Forward

1. **Regular Commits**: Make small, frequent commits with descriptive messages
   ```bash
   git commit -m "Fix: API key validation issue"
   ```

2. **Branch Strategy**: Use branches for features
   ```bash
   git checkout -b feature/new-feature
   # ... make changes ...
   git commit -m "Add: new feature"
   git push -u origin feature/new-feature
   ```

3. **Commit Messages**: Follow conventional commits
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
   - `test:` - Tests
   - `chore:` - Maintenance

4. **Keep .gitignore Updated**: Review periodically to exclude new file types

5. **Don't Commit Secrets**: Never commit API keys, passwords, or `.env` files

---

## Next Steps

- Set up GitHub Actions for CI/CD (optional)
- Add a README.md with project overview
- Create issues for tracking work
- Set up branch protection rules (if working with others)

---

## Need Help?

- Git documentation: https://git-scm.com/doc
- GitHub Guides: https://guides.github.com
- GitHub CLI docs: https://cli.github.com/manual/

