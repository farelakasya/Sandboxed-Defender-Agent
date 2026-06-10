# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment to Vercel.

---

## Pre-Deployment

### Code Preparation
- [ ] All code changes are committed to Git
- [ ] Code is pushed to GitHub/GitLab/Bitbucket
- [ ] `.env.local` is in `.gitignore` (verify secrets are not committed)
- [ ] `.env.example` is up-to-date with all required variables
- [ ] Remove any hardcoded secrets or API keys from code

### Local Testing
- [ ] Run `npm install` to ensure dependencies are installed
- [ ] Run `npm run build` successfully (no build errors)
- [ ] Run `npm run dev` and test all features locally
- [ ] Test with mock mode: `NEXT_PUBLIC_USE_MOCK_DATA=true`
- [ ] Test with external mode (if applicable): `NEXT_PUBLIC_USE_MOCK_DATA=false`
- [ ] Run `npm run lint` and fix any linting errors

---

## Vercel Account Setup

- [ ] Create/login to Vercel account at [vercel.com](https://vercel.com)
- [ ] Connect your Git provider (GitHub/GitLab/Bitbucket)
- [ ] Install Vercel CLI: `npm i -g vercel` (if using CLI method)

---

## Deployment Configuration

### Project Settings
- [ ] Import your repository to Vercel
- [ ] Set **Root Directory** to `frontend`
- [ ] Framework detected as **Next.js** (auto-detected)
- [ ] Build command: `npm run build`
- [ ] Output directory: `.next`
- [ ] Install command: `npm install`
- [ ] Node.js version: 20.x

### Environment Variables - Mock Mode (Start Here)
Copy these to Vercel Dashboard → Settings → Environment Variables:

- [ ] `NEXT_PUBLIC_APP_BASE_URL` = `https://your-app.vercel.app` (update after first deploy)
- [ ] `NEXT_PUBLIC_API_BASE_URL` = `http://54.84.126.64:8001`
- [ ] `NEXT_PUBLIC_USE_MOCK_DATA` = `true`
- [ ] `TESTING_AGENT_MODE` = `mock`
- [ ] `DETECTION_MODE` = `mock`
- [ ] `REDTEAM_SCAN_MODE` = `mock`

### Environment Variables - External Mode (Production)
Only add these if you need AWS Bedrock integration:

- [ ] `NEXT_PUBLIC_USE_MOCK_DATA` = `false`
- [ ] `TESTING_AGENT_MODE` = `external`
- [ ] `TESTING_AGENT_BACKEND_URL` = `https://your-backend-api.com`
- [ ] `TESTING_AGENT_API_KEY` = `your-api-key`
- [ ] `DETECTION_MODE` = `external`
- [ ] `REDTEAM_SCAN_MODE` = `external`
- [ ] `LAMBDA_FUNCTION_URL` = `https://...lambda-url...on.aws/`
- [ ] `REDTEAM_SCAN_TIMEOUT_MS` = `300000`
- [ ] `AWS_REGION` = `us-east-1`
- [ ] `AWS_ACCESS_KEY_ID` = `AKIA...` (server-only, no NEXT_PUBLIC_)
- [ ] `AWS_SECRET_ACCESS_KEY` = `...` (server-only, no NEXT_PUBLIC_)
- [ ] `AWS_SESSION_TOKEN` = `...` (only if using temporary credentials)

---

## First Deployment

### Deploy
- [ ] Click **"Deploy"** button in Vercel Dashboard
- [ ] Wait for build to complete (2-3 minutes)
- [ ] Check build logs for errors
- [ ] Note your deployment URL (e.g., `https://sandboxed-defender-frontend.vercel.app`)

### Update App Base URL
- [ ] Go to Settings → Environment Variables
- [ ] Update `NEXT_PUBLIC_APP_BASE_URL` with your actual Vercel URL
- [ ] Click "Save"
- [ ] Go to Deployments tab
- [ ] Click "..." on latest deployment → "Redeploy"
- [ ] Uncheck "Use existing Build Cache"
- [ ] Click "Redeploy"

---

## Post-Deployment Testing

### Functional Testing
- [ ] Visit your Vercel URL
- [ ] Application loads without console errors
- [ ] Dashboard page renders correctly
- [ ] Navigation works (all pages accessible)
- [ ] Charts and visualizations display
- [ ] Mock data loads (if using mock mode)

### API Testing (Mock Mode)
- [ ] Red team simulation works
- [ ] Blue team detection works
- [ ] Event logs display
- [ ] Detection tickets create successfully
- [ ] Check browser console for API errors

### API Testing (External Mode)
- [ ] Backend API endpoints respond (check Network tab)
- [ ] AWS Lambda functions execute successfully
- [ ] Bedrock agents invoke correctly
- [ ] Check Vercel Function Logs for errors
- [ ] Check AWS CloudWatch logs

### Performance Testing
- [ ] Page loads in < 3 seconds
- [ ] No JavaScript errors in console
- [ ] Images and assets load correctly
- [ ] API responses are reasonable (< 2s for most endpoints)

---

## Production Readiness (Optional)

### Custom Domain
- [ ] Add custom domain in Settings → Domains
- [ ] Configure DNS records (A/CNAME)
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Update `NEXT_PUBLIC_APP_BASE_URL` to custom domain
- [ ] Redeploy
- [ ] Test custom domain URL

### Security
- [ ] Enable Vercel's deployment protection
- [ ] Set up password protection (if needed)
- [ ] Review environment variables (no secrets exposed as NEXT_PUBLIC_)
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set up IP allowlist (if needed)

### Monitoring
- [ ] Enable Vercel Analytics (Settings → Analytics)
- [ ] Enable Speed Insights (Settings → Speed Insights)
- [ ] Set up AWS CloudWatch alarms (for Lambda/Bedrock)
- [ ] Configure error tracking (Sentry, LogRocket, etc.)

### Git Integration
- [ ] Enable automatic deployments from `main` branch
- [ ] Enable preview deployments for pull requests
- [ ] Enable PR comments with preview links
- [ ] Set up branch protection rules on GitHub

---

## Continuous Deployment Setup

### Git Workflow
- [ ] Production branch: `main` (auto-deploys to production)
- [ ] Feature branches create preview deployments
- [ ] Pull requests show preview URL in comments
- [ ] Merge to `main` triggers production deployment

### Deployment Notifications
- [ ] Enable Slack/Discord notifications (Settings → Integrations)
- [ ] Enable email notifications for failed deployments
- [ ] Set up deployment webhooks (if needed)

---

## Troubleshooting

### If Build Fails
- [ ] Check build logs in Vercel Dashboard
- [ ] Run `npm run build` locally to reproduce error
- [ ] Verify all dependencies are in `package.json`
- [ ] Check Node.js version matches (20.x)
- [ ] Ensure `frontend` is set as Root Directory

### If App Doesn't Load
- [ ] Check Function Logs in Vercel Dashboard
- [ ] Check browser console for JavaScript errors
- [ ] Verify `NEXT_PUBLIC_APP_BASE_URL` is correct
- [ ] Check that all environment variables are set
- [ ] Try redeploying without build cache

### If API Calls Fail
- [ ] Check `NEXT_PUBLIC_API_BASE_URL` is accessible from Vercel
- [ ] Verify CORS is enabled on backend
- [ ] Check Function Logs for API errors
- [ ] Verify environment variables are set correctly
- [ ] Test API endpoints with curl/Postman

### If AWS Integration Fails
- [ ] Verify AWS credentials are valid (not expired)
- [ ] Check IAM permissions for Lambda invocation
- [ ] Verify Lambda function URL is correct
- [ ] Check Lambda execution role has Bedrock permissions
- [ ] Review CloudWatch logs for Lambda errors
- [ ] Increase `REDTEAM_SCAN_TIMEOUT_MS` if timeouts occur

---

## Rollback Plan

### If Deployment Has Issues
- [ ] Go to Deployments tab in Vercel
- [ ] Find a previous working deployment
- [ ] Click "..." → "Promote to Production"
- [ ] Confirm rollback
- [ ] Test rolled-back version
- [ ] Fix issues in development
- [ ] Redeploy when ready

---

## Maintenance

### Regular Tasks
- [ ] Monitor deployment status weekly
- [ ] Review Vercel Analytics monthly
- [ ] Update dependencies (`npm outdated`)
- [ ] Review and rotate AWS credentials quarterly
- [ ] Check Vercel billing and usage
- [ ] Review error logs and fix issues

### Before Each Deployment
- [ ] Test changes locally
- [ ] Run `npm run build` successfully
- [ ] Review changed files
- [ ] Update documentation if needed
- [ ] Create preview deployment first (via PR)
- [ ] Test preview deployment
- [ ] Merge to production

---

## Support & Resources

### Vercel Support
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Vercel Status Page](https://vercel-status.com)

### Next.js Support
- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js GitHub](https://github.com/vercel/next.js)
- [Next.js Discord](https://nextjs.org/discord)

### AWS Support
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Support](https://aws.amazon.com/support/)

---

## Deployment Complete! 🎉

Once all items are checked:
- [ ] Deployment is live and working
- [ ] URL shared with team/stakeholders
- [ ] Documentation updated with deployment URL
- [ ] Monitoring and alerts configured
- [ ] Team trained on deployment process

**Your Vercel URL**: _______________________________________

**Custom Domain (if applicable)**: _______________________________________

**Deployment Date**: _______________________________________

**Deployed By**: _______________________________________

**Notes**:
_______________________________________________________________________

_______________________________________________________________________

_______________________________________________________________________
