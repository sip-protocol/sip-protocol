# Deployment Guide

This document describes how to set up CI/CD and deployment for SIP Protocol.

---

## CI/CD Workflows

The repository includes three GitHub Actions workflows:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | Push/PR to main/dev | Lint, typecheck, test, build |
| Deploy Demo | `deploy-demo.yml` | Push to main | Deploy demo app to Vercel |
| Publish | `publish.yml` | GitHub Release | Publish packages to npm |

---

## Required Secrets

Configure these secrets in GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Vercel Deployment

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `VERCEL_ORG_ID` | Vercel organization/user ID | Vercel Dashboard > Settings > General |
| `VERCEL_PROJECT_ID` | Vercel project ID | Create project in Vercel, check `.vercel/project.json` |
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard > Settings > Tokens |

### npm Publishing

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `NPM_TOKEN` | npm automation token | npmjs.com > Access Tokens > Generate New Token (Automation) |

---

## Initial Setup

### 1. Vercel Project Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to demo app
cd apps/demo

# Link to Vercel (creates project if needed)
vercel link

# This creates .vercel/project.json with orgId and projectId
cat .vercel/project.json
```

Copy the `orgId` and `projectId` to GitHub secrets.

### 2. npm Account Setup

1. Create npm account at [npmjs.com](https://www.npmjs.com/)
2. Create organization `@sip-protocol` (or use personal scope)
3. Generate automation token: Account > Access Tokens > Generate New Token
4. Add token to GitHub secrets as `NPM_TOKEN`

### 3. Enable GitHub Actions

Ensure GitHub Actions is enabled for the repository:
- Go to `Settings > Actions > General`
- Select "Allow all actions and reusable workflows"
- Save

---

## Workflow Details

### CI Workflow (`ci.yml`)

Runs on every push and pull request to `main` and `dev` branches.

**Jobs:**
1. **lint-and-typecheck** - Runs ESLint and TypeScript checks
2. **test** - Runs test suite with coverage, uploads to Codecov
3. **build** - Builds all packages, generates API docs

**Dependencies:**
- Test job requires lint-and-typecheck
- Build job runs in parallel

### Deploy Demo Workflow (`deploy-demo.yml`)

Triggers on push to `main` when changes affect:
- `apps/demo/**`
- `packages/**`
- `pnpm-lock.yaml`

**Jobs:**
1. **deploy** - Builds and deploys to Vercel production
2. **notify** - Reports deployment status

### Publish Workflow (`publish.yml`)

Triggers on GitHub Release or manual workflow dispatch.

**Jobs:**
1. **test** - Runs full test suite
2. **publish-sdk** - Publishes `@sip-protocol/types` then `@sip-protocol/sdk`
3. **publish-docs** - Generates and deploys API docs to GitHub Pages

---

## Manual Deployment

### Deploy Demo Manually

```bash
# From repository root
cd apps/demo
vercel --prod
```

### Publish Packages Manually

```bash
# Build all packages
pnpm build

# Publish types first (sdk depends on it)
cd packages/types
npm publish --access public

# Publish SDK
cd ../sdk
npm publish --access public
```

---

## Vercel Configuration

The demo app uses custom Vercel configuration (`apps/demo/vercel.json`):

- **Framework:** Next.js
- **Region:** IAD1 (US East)
- **Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## Troubleshooting

### CI Fails on Typecheck

```bash
# Run locally to see errors
pnpm typecheck
```

### Test Coverage Drop

```bash
# Check coverage locally
cd packages/sdk
pnpm test:coverage
```

### Vercel Build Fails

Check that the monorepo builds correctly:

```bash
# From root
pnpm install
pnpm build

# Then demo specifically
cd apps/demo
pnpm build
```

### npm Publish 403 Error

- Ensure package name is available or you own the scope
- Verify NPM_TOKEN has publish permissions
- Check if 2FA is required (use automation token)

---

## Version Management

Before publishing a release:

1. Update versions in `packages/*/package.json`
2. Update CHANGELOG.md
3. Create GitHub Release with tag (e.g., `v0.1.0`)
4. Workflow automatically publishes to npm

---

## Environment Variables

### Demo App (.env.local)

```env
# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=

# Optional: Feature flags
NEXT_PUBLIC_ENABLE_TESTNET=true
```

---

**Last Updated:** November 27, 2025
