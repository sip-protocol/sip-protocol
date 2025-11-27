# Deployment Guide

This document describes CI/CD and deployment for SIP Protocol packages.

---

## Repository Structure

SIP Protocol uses two repositories:

| Repository | Purpose | Deployment |
|------------|---------|------------|
| `sip-protocol/sip-protocol` | Core SDK + Types (this repo) | npm registry |
| `sip-protocol/sip-website` | Website + Demo | VPS (Docker) |

**Demo Application:** The interactive demo lives at [sip-protocol/sip-website](https://github.com/sip-protocol/sip-website) and is deployed to `sip-protocol.org/demo`.

---

## CI/CD Workflows

This repository includes two GitHub Actions workflows:

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | Push/PR to main/dev | Lint, typecheck, test, build |
| Publish | `publish.yml` | GitHub Release | Publish packages to npm |

---

## Required Secrets

Configure in GitHub repository settings (`Settings > Secrets and variables > Actions`):

### npm Publishing

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `NPM_TOKEN` | npm automation token | npmjs.com > Access Tokens > Generate New Token (Automation) |

---

## Initial Setup

### 1. npm Account Setup

1. Create npm account at [npmjs.com](https://www.npmjs.com/)
2. Create organization `@sip-protocol` (or use personal scope)
3. Generate automation token: Account > Access Tokens > Generate New Token
4. Add token to GitHub secrets as `NPM_TOKEN`

### 2. Enable GitHub Actions

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

### Publish Workflow (`publish.yml`)

Triggers on GitHub Release or manual workflow dispatch.

**Jobs:**
1. **test** - Runs full test suite
2. **publish-sdk** - Publishes `@sip-protocol/types` then `@sip-protocol/sdk`
3. **publish-docs** - Generates and deploys API docs to GitHub Pages

---

## Publishing Packages

### Automated (Recommended)

1. Update versions in `packages/*/package.json`
2. Update CHANGELOG.md
3. Create GitHub Release with tag (e.g., `v0.1.0`)
4. Workflow automatically publishes to npm

### Manual

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

## Demo & Website Deployment

The demo application and marketing website are in a separate repository:

**Repository:** [sip-protocol/sip-website](https://github.com/sip-protocol/sip-website)

**Deployment:** VPS with Docker (blue-green deployment)
- **Production:** sip-protocol.org (ports 5000/5001)
- **Staging:** staging.sip-protocol.org (port 5002)

**Architecture:**
```
GitHub Push → GitHub Actions → GHCR → SSH Deploy → Docker Compose
```

See the [sip-website repository](https://github.com/sip-protocol/sip-website) for deployment details.

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

**Last Updated:** November 27, 2025
