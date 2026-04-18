---
name: deploy
description: Push current code to GitHub (triggers Docker Hub CI build). Use when the user wants to deploy or ship changes.
disable-model-invocation: false
allowed-tools: Bash(git *)
---

# Deploy Unstuckarr

## Steps

1. **Check for uncommitted changes**
   Run `git status` in the `unstuckarr/` project directory. If there are uncommitted changes, warn the user and ask whether to commit them first.

2. **Check current branch**
   Run `git branch --show-current`. Only deploy from `main`.

3. **Push to GitHub**
   Run `git push origin main`.
   This triggers the GitHub Actions workflow (`.github/workflows/docker-publish.yml`) which builds and pushes to Docker Hub as `dockersftw/unstuckarr:latest`.

4. **Report the Actions URL**
   The GitHub Actions URL is: https://github.com/MikeTrysome/unstuckarr/actions
   Tell the user they can track the build there. Build typically takes 2–4 minutes.

5. **Update on Unraid (manual step — inform the user)**
   After the Docker Hub image is updated, the user needs to:
   - Open Unraid → Docker tab
   - Click the Unstuckarr container → Update (or use Watchtower if configured)
   - Or: `docker pull dockersftw/unstuckarr:latest && docker compose up -d`

## Notes
- Never push to a branch other than `main` without asking
- GitHub Actions only builds on pushes to `main`
- The Docker Hub repo is private (`dockersftw/unstuckarr`)
