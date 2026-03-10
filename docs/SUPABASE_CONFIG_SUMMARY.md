# Supabase Cloud Deployment - Configuration Summary

## Configuration Complete

### Supabase Project Info

| Item | Value |
|------|-------|
| Project ID | `dxyogcecxoxsnulgnzhh` |
| Project URL | `https://dxyogcecxoxsnulgnzhh.supabase.co` |
| Region | Auto-assigned by Supabase |

### Database Schema

Successfully pushed:
- 10 tables: profiles, expenses, reports, report_items, loans, payment_accounts, budget_projects, ai_configs, attachments, token_usage
- 5 enum types: expense_status, report_status, user_role, attachment_type, ai_provider
- RLS policies enabled on all tables
- Storage bucket: `attachments`

### Frontend Environment Variables

File created: `frontend/.env`

```env
VITE_SUPABASE_URL=https://dxyogcecxoxsnulgnzhh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## GitHub Actions Required Secrets

Configure these in your GitHub repository: Settings → Secrets and variables → Actions

### Required Secrets

| Secret Name | Value |
|-------------|-------|
| `VITE_SUPABASE_URL` | `https://dxyogcecxoxsnulgnzhh.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eW9nY2VjeG94c251bGduemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxOTQ0MzMsImV4cCI6MjA1ODc3MDQzM30.sb_publishable__MIg3JfN7RbSskFerd2dFg_a49AfJ75` |

### Deployment Secrets (Optional - for auto-deploy)

| Secret Name | Description |
|-------------|-------------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_PORT` | SSH port (default: 22) |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |
| `DEPLOY_PATH` | Deployment path on server |
| `GHCR_USERNAME` | GitHub username |
| `GHCR_TOKEN` | GitHub Personal Access Token (write:packages) |

---

## Deployment Commands

### Local Development

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao/frontend
npm run dev
# Open http://localhost:5173
```

### Local Build Test

```bash
npm run build
# Output: dist/
```

### Manual Docker Build

```bash
cd /Users/ethan/Desktop/开发项目/yibaoxiao/yibaoxiao

docker build \
  --build-arg VITE_SUPABASE_URL=https://dxyogcecxoxsnulgnzhh.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJhbGci... \
  -f Dockerfile.frontend \
  -t yibaoxiao-frontend:local \
  .
```

### Push to GitHub (Trigger CI/CD)

```bash
git add .
git commit -m "feat: migrate to Supabase cloud backend"
git push origin main
```

---

## Post-Deployment Checklist

1. [ ] Configure Supabase Auth redirect URLs
   - Dashboard → Authentication → URL Configuration
   - Add your domain to Site URL and Redirect URLs

2. [ ] Disable email confirmation (optional, for testing)
   - Dashboard → Authentication → Providers → Email
   - Turn off "Confirm email"

3. [ ] Test user registration
   - Register a new user
   - Check profiles table for auto-created record

4. [ ] Test file upload
   - Upload an attachment
   - Check Storage → attachments bucket

5. [ ] Configure custom domain (optional)
   - Dashboard → Settings → Custom Domains

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│                 │     │           Supabase Cloud             │
│   Frontend      │     │  ┌─────────────────────────────────┐ │
│   (Docker)      │────▶│  │  PostgreSQL Database            │ │
│   Nginx         │     │  │  - profiles, expenses, reports  │ │
│   Static Files  │     │  │  - loans, attachments, etc.     │ │
│                 │     │  └─────────────────────────────────┘ │
│                 │     │  ┌─────────────────────────────────┐ │
│                 │     │  │  Authentication (GoTrue)        │ │
│                 │     │  │  - Email/Password               │ │
│                 │     │  └─────────────────────────────────┘ │
│                 │     │  ┌─────────────────────────────────┐ │
│                 │     │  │  Storage                        │ │
│                 │     │  │  - attachments bucket           │ │
│                 │     │  └─────────────────────────────────┘ │
└─────────────────┘     └──────────────────────────────────────┘
```

---

## Support

- Supabase Dashboard: https://app.supabase.com/project/dxyogcecxoxsnulgnzhh
- Documentation: `docs/SUPABASE_DEPLOYMENT_GUIDE.md`
