# Migration Guide: RECTOR-LABS → sip-protocol

> Guide for migrating repository from `RECTOR-LABS/sip-protocol` to `sip-protocol/sip-protocol`

---

## Pre-Migration Checklist

- [ ] Create GitHub organization: `sip-protocol`
- [ ] Ensure you have admin access to both orgs
- [ ] Backup any org-level secrets/settings
- [ ] Notify collaborators (if any)

---

## Step 1: Create Organization

1. Go to https://github.com/organizations/new
2. Organization name: `sip-protocol`
3. Contact email: your email
4. Plan: Free (can upgrade later)

---

## Step 2: Transfer Repository

1. Go to: https://github.com/RECTOR-LABS/sip-protocol/settings
2. Scroll to **Danger Zone**
3. Click **Transfer ownership**
4. New owner: `sip-protocol`
5. Type repo name to confirm: `sip-protocol`
6. Click **I understand, transfer this repository**

**Note**: GitHub will automatically redirect the old URL to new URL for a period.

---

## Step 3: Update Files

### Files Requiring Updates

| File | Change | Priority |
|------|--------|----------|
| `package.json` | repository.url, author | 🔴 Critical |
| `docs/spec/SIP-SPEC.md` | Authors field | 🟡 Medium |
| `docs/specs/WALLET-ADAPTER-SPEC.md` | Author field | 🟡 Medium |
| `docs/specs/ZK-ARCHITECTURE.md` | Author field | 🟡 Medium |
| `docs/specs/ZCASH-PROVING-EVALUATION.md` | Author field | 🟡 Medium |

### Detailed Changes

#### 1. `/package.json` (Line 6-10)

**Before:**
```json
"repository": {
  "type": "git",
  "url": "https://github.com/RECTOR-LABS/sip-protocol.git"
},
"author": "RECTOR Labs",
```

**After:**
```json
"repository": {
  "type": "git",
  "url": "https://github.com/sip-protocol/sip-protocol.git"
},
"author": "SIP Protocol",
```

#### 2. `/docs/spec/SIP-SPEC.md` (Line 6)

**Before:**
```markdown
**Authors**: RECTOR Labs
```

**After:**
```markdown
**Authors**: SIP Protocol Team
```

#### 3. `/docs/specs/WALLET-ADAPTER-SPEC.md` (Line 6)

**Before:**
```markdown
> **Author**: RECTOR + CIPHER
```

**After:**
```markdown
> **Author**: SIP Protocol Team
```

#### 4. `/docs/specs/ZK-ARCHITECTURE.md` (Line 6)

**Before:**
```markdown
> **Author**: RECTOR + CIPHER
```

**After:**
```markdown
> **Author**: SIP Protocol Team
```

#### 5. `/docs/specs/ZCASH-PROVING-EVALUATION.md` (Line 6)

**Before:**
```markdown
> **Author**: RECTOR + CIPHER
```

**After:**
```markdown
> **Author**: SIP Protocol Team
```

---

## Step 4: Update Local Git Remote

After transfer, update your local repository:

```bash
# Check current remote
git remote -v

# Update remote URL
git remote set-url origin https://github.com/sip-protocol/sip-protocol.git

# Verify
git remote -v
```

---

## Step 5: Commit Changes

```bash
# Stage all changes
git add -A

# Commit
git commit -m "chore: migrate to sip-protocol organization

- Update repository URLs
- Update author references
- Prepare for public launch"

# Push
git push origin dev
```

---

## Post-Migration Checklist

- [ ] Verify repository accessible at new URL
- [ ] Verify old URL redirects correctly
- [ ] Update any external documentation/links
- [ ] Update npm package.json if publishing
- [ ] Update CI/CD secrets (if any)
- [ ] Update GitHub organization settings
  - [ ] Organization profile
  - [ ] Default repository permissions
  - [ ] Member privileges

---

## Files NOT Requiring Changes

These files use relative paths and will work correctly after migration:

| File | Why It's Fine |
|------|---------------|
| `ROADMAP.md` | Uses relative issue links `../../issues/` |
| `CONTRIBUTING.md` | No org-specific links |
| `README.md` | No org-specific links |
| `.github/ISSUE_TEMPLATE/*` | Relative paths |
| `.github/pull_request_template.md` | Relative paths |

---

## Private Files (gitignored)

These files contain `RECTOR` references but are not committed:

| File | Action |
|------|--------|
| `.strategy/HACKATHON-STRATEGY.md` | Update locally if desired |
| `.strategy/ROADMAP-INTERNAL.md` | No RECTOR references |

---

## Rollback Plan

If something goes wrong:

1. GitHub keeps redirects active for transferred repos
2. You can transfer back to RECTOR-LABS if needed
3. Git history is preserved

---

## Estimated Time

| Task | Time |
|------|------|
| Create org | 2 min |
| Transfer repo | 5 min |
| Update files | 10 min |
| Test & verify | 10 min |
| **Total** | **~30 min** |

---

## Quick Script (Run After Transfer)

```bash
#!/bin/bash
# Run this after transferring the repo

# Update git remote
git remote set-url origin https://github.com/sip-protocol/sip-protocol.git

# Verify
echo "New remote:"
git remote -v

echo ""
echo "Files to update manually:"
echo "1. package.json - repository.url, author"
echo "2. docs/spec/SIP-SPEC.md - Authors"
echo "3. docs/specs/WALLET-ADAPTER-SPEC.md - Author"
echo "4. docs/specs/ZK-ARCHITECTURE.md - Author"
echo "5. docs/specs/ZCASH-PROVING-EVALUATION.md - Author"
```

---

*Created: November 27, 2025*
