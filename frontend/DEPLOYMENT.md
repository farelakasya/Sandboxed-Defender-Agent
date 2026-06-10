# Vercel Deployment Guide

## Pre-Deployment Checklist

- [ ] Code is committed to Git (GitHub, GitLab, or Bitbucket)
- [ ] All dependencies are listed in `package.json`
- [ ] `.env.local` is in `.gitignore` (secrets not committed)
- [ ] `.env.example` is up to date with all required variables
- [ ] Application builds successfully locally (`npm run build`)
- [ ] Application runs successfully locally (`npm run dev`)

## Deployment Methods

### Method 1: Vercel CLI (Quick Setup)

#### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

#### Step 2: Login to Vercel
```bash
vercel login
```

#### Step 3: Navigate to Frontend Directory
```bash
cd frontend
```

#### Step 4: Deploy (Preview)
```bash
vercel
```

Follow the interactive prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your Vercel account
- **Link to existing project?** → No (first deployment) or Yes (subsequent)
- **What's your project's name?** → `sandboxed-defender-frontend`
- **In which directory is your code located?** → `./`
- **Want to override the settings?** → No

#### Step 5: Deploy to Production
```bash
vercel --prod
```

---

### Method 2: Vercel Dashboard (Git Integration - Recommended)

#### Step 1: Push Code to Git Repository

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

#### Step 2: Connect Repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Sign in with your Git provider (GitHub/GitLab/Bitbucket)
3. Click "Import Project"
4. Select your repository: `Sandboxed-Defender-Agent`

#### Step 3: Configure Project Settings

**Build & Development Settings:**
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `frontend` ⚠️ **IMPORTANT: Set this!**
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

**Node.js Version:**
- Use Node.js 20.x (matches your local dev environment)

#### Step 4: Configure Environment Variables

See the "Environment Variables Configuration" section below.

#### Step 5: Deploy

Click **"Deploy"** and wait for the build to complete (usually 2-3 minutes).

---

## Environment Variables Configuration

### Quick Start: Mock Mode (No External Dependencies)

Perfect for demos and testing without AWS/backend setup:

```env
# Public variables (exposed to browser)
NEXT_PUBLIC_APP_BASE_URL=https://your-app-name.vercel.app
NEXT_PUBLIC_API_BASE_URL=http://54.84.126.64:8001
NEXT_PUBLIC_USE_MOCK_DATA=true

# Server-only variables
TESTING_AGENT_MODE=mock
DETECTION_MODE=mock
REDTEAM_SCAN_MODE=mock
```

### Production: External Mode (Full AWS Integration)

For production use with real backend and AWS Bedrock:

```env
# Public variables
NEXT_PUBLIC_APP_BASE_URL=https://your-app-name.vercel.app
NEXT_PUBLIC_API_BASE_URL=http://54.84.126.64:8001
NEXT_PUBLIC_USE_MOCK_DATA=false

# Server-only variables
TESTING_AGENT_MODE=external
TESTING_AGENT_BACKEND_URL=https://your-backend-api.com
TESTING_AGENT_API_KEY=your-api-key-here

DETECTION_MODE=external

REDTEAM_SCAN_MODE=external
LAMBDA_FUNCTION_URL=https://n23oucit2pdvxg4uqfnktj4dia0gield.lambda-url.us-east-1.on.aws/
REDTEAM_SCAN_TIMEOUT_MS=300000

# AWS Credentials (server-only - NEVER add NEXT_PUBLIC_ prefix)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_SESSION_TOKEN=your-session-token  # Only needed for temporary credentials
```

### How to Add Environment Variables in Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in the sidebar
4. For each variable:
   - Enter **Key** (e.g., `NEXT_PUBLIC_APP_BASE_URL`)
   - Enter **Value** (e.g., `https://your-app.vercel.app`)
   - Select environments: **Production**, **Preview**, **Development**
   - Click **"Add"**

⚠️ **SECURITY NOTE**: 
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Server-only secrets (AWS keys, API keys) should NEVER have `NEXT_PUBLIC_` prefix
- Never commit `.env.local` to Git

---

## Post-Deployment Steps

### Step 1: Update App Base URL

After your first deployment, Vercel assigns you a URL (e.g., `https://sandboxed-defender-frontend.vercel.app`).

1. Go to **Settings → Environment Variables**
2. Update `NEXT_PUBLIC_APP_BASE_URL` with your actual Vercel URL
3. **Redeploy** to apply changes (Deployments tab → "..." → Redeploy)

### Step 2: Configure Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain (e.g., `defender.yourdomain.com`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_BASE_URL` to your custom domain
5. Redeploy

### Step 3: Test Deployment

Visit your deployed URL and verify:

- [ ] Application loads without errors
- [ ] Dashboard displays correctly
- [ ] Mock data works (if using mock mode)
- [ ] API endpoints respond (check browser console for errors)
- [ ] Red team / Blue team simulation features work
- [ ] Charts and visualizations render

### Step 4: Set Up Continuous Deployment

With Git integration, Vercel automatically:
- **Deploys to production** on pushes to `main` branch
- **Creates preview deployments** for pull requests
- **Runs build checks** before deployment

---

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
```bash
# Solution: Ensure all dependencies are in package.json
cd frontend
npm install
npm run build  # Test locally first
```

**Error: "Root directory not found"**
- Go to Settings → General → Root Directory
- Set to `frontend`
- Redeploy

### Runtime Errors

**Error: "Failed to fetch API"**
- Check `NEXT_PUBLIC_API_BASE_URL` is correct
- Verify backend is accessible from Vercel
- Check CORS settings on your backend

**Error: "AWS credentials not found"**
- Ensure AWS variables are set (without `NEXT_PUBLIC_` prefix)
- Verify `REDTEAM_SCAN_MODE=external` is set
- Check AWS credentials are valid

**Error: "Lambda timeout"**
- Increase `REDTEAM_SCAN_TIMEOUT_MS` (default: 300000)
- Verify Lambda function URL is correct
- Check Lambda execution time limits

### Environment Variable Issues

**Variables not updating:**
1. Update in Vercel Dashboard → Settings → Environment Variables
2. Go to Deployments tab
3. Click "..." on latest deployment → "Redeploy"
4. Check "Use existing Build Cache" is UNCHECKED

---

## Vercel Project Settings Reference

### Recommended Settings

**General:**
- Node.js Version: 20.x
- Framework: Next.js
- Root Directory: `frontend`

**Build & Development:**
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Development Command: `npm run dev`

**Git Integration:**
- Production Branch: `main`
- Enable automatic deployments: ✓
- Enable preview deployments: ✓
- Enable comments on pull requests: ✓

**Functions:**
- Function Region: auto (or select closest to your users)
- Max Duration: 10s (or increase if needed)

---

## Development Workflow

### Local Development
```bash
cd frontend
npm install
npm run dev
```
App runs on `http://localhost:3001`

### Preview Deployments (Branch/PR)
```bash
git checkout -b feature/new-feature
# Make changes
git push origin feature/new-feature
```
Vercel automatically creates preview deployment

### Production Deployment
```bash
git checkout main
git merge feature/new-feature
git push origin main
```
Vercel automatically deploys to production

---

## Monitoring & Analytics

### View Deployment Logs
1. Go to Deployments tab
2. Click on a deployment
3. View "Build Logs" and "Function Logs"

### Enable Vercel Analytics (Optional)
1. Go to Analytics tab
2. Enable Web Analytics
3. View real-time visitor data

### Enable Speed Insights (Optional)
1. Go to Speed Insights tab
2. Enable to track Core Web Vitals
3. Monitor performance metrics

---

## Cost Considerations

**Vercel Free Tier Includes:**
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic HTTPS
- Preview deployments
- Edge Functions

**AWS Costs (if using external mode):**
- Lambda invocations
- Bedrock API calls
- Data transfer

---

## Security Best Practices

- [ ] Never commit `.env.local` or secrets to Git
- [ ] Use server-only variables for AWS credentials (no `NEXT_PUBLIC_` prefix)
- [ ] Enable Vercel's attack challenge mode for DDoS protection
- [ ] Rotate AWS credentials regularly
- [ ] Use IAM roles with minimal permissions
- [ ] Enable AWS CloudWatch for Lambda monitoring
- [ ] Set up Vercel deployment protection for production

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Environment Variables Best Practices](https://vercel.com/docs/concepts/projects/environment-variables)

---

## Quick Reference Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy production
vercel --prod

# Check deployment status
vercel ls

# View project info
vercel inspect

# Pull environment variables to local
vercel env pull .env.local

# Add environment variable via CLI
vercel env add VARIABLE_NAME

# Remove deployment
vercel remove [deployment-url]
```

---

## Support

For issues specific to:
- **Vercel Platform**: [Vercel Support](https://vercel.com/support)
- **Next.js Framework**: [Next.js GitHub Issues](https://github.com/vercel/next.js/issues)
- **This Project**: Check the main README.md or create an issue in your repository
