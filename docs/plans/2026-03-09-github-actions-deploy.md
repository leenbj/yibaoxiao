# GitHub Actions Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the project buildable and deployable through GitHub Actions with a concrete container build and server deployment path.

**Architecture:** Keep the existing Docker plus Docker Compose production model, publish backend and frontend images to GHCR, and deploy by SSHing into the target server to pull new images and restart the stack. Pass the frontend Supabase configuration as build inputs so the static frontend is deployable.

**Tech Stack:** GitHub Actions, Docker Buildx, GHCR, Docker Compose, Vite, Supabase, Motia

### Task 1: Add frontend build-time environment support

**Files:**
- Modify: `Dockerfile.frontend`

**Step 1: Add build arguments for Vite environment variables**

Update the Dockerfile builder stage to accept:
- `ARG VITE_SUPABASE_URL`
- `ARG VITE_SUPABASE_ANON_KEY`

Export them with `ENV` before `npm run build`.

**Step 2: Keep runtime image unchanged**

Do not change the nginx runtime stage beyond what is required for a successful build.

**Step 3: Verify frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: Vite production build succeeds.

### Task 2: Replace image-only workflow with build-and-deploy workflow

**Files:**
- Modify: `.github/workflows/docker-build.yml`

**Step 1: Keep image publishing capability**

Retain GHCR login, metadata, caching, and image push for backend and frontend.

**Step 2: Add frontend build args**

Pass these build args into the frontend Docker build:
- `VITE_SUPABASE_URL=${{ secrets.VITE_SUPABASE_URL }}`
- `VITE_SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }}`

**Step 3: Add a deployment job**

Deploy only on:
- push to `main`
- manual dispatch when deploy input is true

Use SSH to the target server, ensure the deploy directory exists, update `docker-compose.prod.yml` and `.env`, log into GHCR with a deploy token, pull images, and restart the stack.

**Step 4: Add clear workflow inputs and job summary**

Expose manual deployment controls and document which secrets are required through step summary text.

### Task 3: Document the deployment contract

**Files:**
- Modify: `DEPLOYMENT_GUIDE.md`

**Step 1: Add required GitHub secrets list**

Document:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- `DEPLOY_ENV_FILE`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

**Step 2: Add deployment flow description**

Explain that pushes to `main` build and publish images, then update the remote server through SSH.

### Task 4: Verify the final path

**Files:**
- Verify only

**Step 1: Run frontend build**

Run: `npm run build`
Workdir: `frontend`
Expected: PASS

**Step 2: Run backend build**

Run: `npm run build`
Workdir: `.`
Expected: PASS

**Step 3: Review diff**

Run: `git diff -- Dockerfile.frontend .github/workflows/docker-build.yml DEPLOYMENT_GUIDE.md`
Expected: Only intended deployment-related changes appear.
