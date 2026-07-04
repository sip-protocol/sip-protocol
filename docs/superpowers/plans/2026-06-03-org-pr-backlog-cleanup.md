# sip-protocol Org PR Backlog Cleanup — Implementation Plan

> **For agentic workers:** This is an operational **PR-triage runbook**, not a code-implementation plan. Execute per-repo with `superpowers:executing-plans` discipline (checkpoints between repos). Steps use checkbox (`- [ ]`) syntax. The `git-tools:pr-audit` skill is org-aware and can drive the bulk dependabot merges; use manual `gh` for majors + human PRs.

**Goal:** Clear the 69 open PRs across the 7 sip-protocol org repos — merge all CI-green safe dependabot bumps, close superseded/obsolete ones, defer framework majors, and review the 3 non-dependabot PRs — before resuming the HERALD go-live work.

**Approach:** Per-repo sweep in risk order (warm-up → core → deploy-sensitive → biggest). Lean on the newest "minor-and-patch group" PR in each repo to collapse many individual bumps at once. Auto-merge CI-green safe bumps, pause for RECTOR's OK before moving to the next repo.

**Tech context:** All web repos (docs-sip, blog-sip, sip-website, sip-app) now **auto-deploy on Vercel** on push to `main` — every merge triggers a production rebuild. sip-protocol is an npm library monorepo (CI = test suite). circuits = Noir. sip-mobile = Expo (no web deploy).

---

## Locked Decisions (RECTOR, 2026-06-03)

1. **Framework majors → DEFER.** Do not upgrade Next 15→16, Astro 5→6, @astrojs/node 9→10, or eslint-config-next 15→16 in this pass. Merge the safe *patch* alternative where one exists (sip-website#198 Next→15.5.18) and **close** the conflicting major (#183). Leave the remaining framework-major PRs **open**, labeled `deferred`, for a dedicated post-HERALD task (each with local build verification). See "Deferred — Framework Majors" below.
2. **Human sip-mobile PRs → REVIEW BOTH.** Next session, read #59 + #76 in full and recommend disposition (merge/close/changes). #76 (contributor feature) gets a real code review.
3. **Execution → AUTO + PER-REPO CHECKPOINTS.** Per repo: auto-merge all CI-green safe dependabot PRs + close superseded/obsolete, then pause for RECTOR's OK before the next repo. Manual review only for majors + human PRs.

---

## Inventory (69 PRs)

| Repo | Open | Deploy target | Group-bump PR | Notes |
|------|------|---------------|---------------|-------|
| sip-app | 21 | Vercel (Next 16) | **#275** (24 updates, May 25 — newest) | biggest; group collapses most |
| docs-sip | 16 | Vercel (Astro Starlight) | **#65** (6 updates, Mar 16) | several `BLOCKED`; #68 SDK bump; #93 major |
| sip-website | 12 | Vercel (Next 15) | **#193** (21 updates, Mar 30) | #198 patch vs #183 major conflict |
| blog-sip | 9 | Vercel (Astro) | **#121** (14 updates, Apr 13) | #125/#123 majors |
| sip-protocol | 7 | npm (CI=tests) | **#1078** (33 updates, Apr 27) | core library |
| sip-mobile | 2 | Expo (none) | — | both human (#59, #76) |
| circuits | 2 | none (Noir) | — | both CLEAN — warm-up |

**66 dependabot + 3 non-dependabot** (docs-sip#68 github-actions SDK bump, sip-mobile#76 ZakIIDev feature, sip-mobile#59 RECTOR docs).

---

## Execution Toolkit (reusable commands — DRY)

Run all from a clone of the target repo, or with `-R sip-protocol/<repo>`.

**Refresh mergeability (poll TWICE — first call triggers lazy compute):**
```bash
gh pr view <N> -R sip-protocol/<repo> --json mergeable,mergeStateStatus
sleep 3; gh pr view <N> -R sip-protocol/<repo> --json mergeable,mergeStateStatus
```

**Check CI:**
```bash
gh pr checks <N> -R sip-protocol/<repo>
```

**Merge (global rule — `--merge --delete-branch`, NOT squash):**
```bash
gh pr merge <N> -R sip-protocol/<repo> --merge --delete-branch
```

**Rebase a stale dependabot PR (do this for old group-bumps before merging):**
```bash
gh pr comment <N> -R sip-protocol/<repo> --body "@dependabot rebase"
# wait ~1-2 min, then re-check CI + mergeability
```

**Close superseded / obsolete:**
```bash
gh pr close <N> -R sip-protocol/<repo> --comment "Superseded by #<group> — closing."   # or: obsolete after Vercel migration
```

**Admin-merge a BLOCKED-but-safe PR (RECTOR is org owner):**
```bash
gh pr merge <N> -R sip-protocol/<repo> --merge --delete-branch --admin   # only when CI is green and the block is a stale required-check/review
```

### Safety rules (apply to EVERY merge)
- **CI must be green** before merge. No green, no merge — investigate or close.
- **Merge to `main` = live Vercel deploy** for web repos. After each repo's merges, confirm the latest deploy built green (`gh run list -R sip-protocol/<repo> --branch main --limit 3` or the Vercel dashboard).
- **NO AI-attribution** in any comment/commit. GPG auto-signs.
- **Group-bump first:** rebase + merge the newest "minor-and-patch group" PR, THEN close the individual bumps it supersedes, THEN merge any safe individuals not in the group.
- **`BLOCKED` state:** inspect why (`gh pr view <N> --json mergeStateStatus,statusCheckRollup`). If it's a stuck/duplicate required check on an otherwise-green safe bump, `--admin` merge. If it's a real failing check, fix or close.
- **gitleaks:** if any PR touches the gitleaks action, recall the org needs the binary install, not `gitleaks-action@v2` (paid-license trap). Don't merge a PR that switches to `@v2`.
- **Deferred majors:** never merge in this pass (see decision 1).

---

## Task 1: circuits (2 PRs) — warm-up, validate the flow

**Both `mergeable=MERGEABLE, state=CLEAN`. CI-action bumps. Lowest risk.**

- [ ] Check CI on #5 (actions/checkout 4→6) and #6 (webfactory/ssh-agent 0.9→0.10).
- [ ] Merge both if green: `gh pr merge 5 -R sip-protocol/circuits --merge --delete-branch` then `#6`.
- [ ] Confirm `nargo`/CI passed on `main`.
- [ ] **CHECKPOINT:** report to RECTOR (2 merged) before proceeding.

---

## Task 2: sip-protocol (7 PRs) — core library

**Disposition:**
| PR | Bump | Action |
|----|------|--------|
| **#1078** | group (33 updates) | **Rebase first** (Apr 27, stale) → merge if green. Collapses the rest. |
| #1086 | turbo 2.8.9→2.9.14 (dev) | Merge if green (or close if in #1078) |
| #1074 | pnpm/action-setup 4→6 | Merge if green — **verify CI still resolves the right pnpm version** |
| #1072 | codecov/codecov-action 5→6 | Merge if green |
| #1069 | webfactory/ssh-agent 0.9.1→0.10 | Merge if green |
| #1066 | express-rate-limit 8.2.1→8.2.2 | Merge if green (or close if in #1078) |
| #1064 | actions/upload-artifact 6→7 | Merge if green |

- [ ] Rebase #1078, wait, re-check CI (full test suite ~4 min) + mergeability.
- [ ] Merge #1078 if green. Then `gh pr list -R sip-protocol/sip-protocol --state open` — close any of #1066/#1086 now superseded.
- [ ] Merge remaining green CI-action bumps (#1064, #1069, #1072, #1074) one at a time, re-checking CI between (each merge rebases the next).
- [ ] Confirm `main` CI + Release + Mirror-to-GitLab green.
- [ ] **CHECKPOINT.**

---

## Task 3: blog-sip (9 PRs) — Vercel (Astro)

**Disposition:**
| PR | Bump | Action |
|----|------|--------|
| **#121** | group (14 updates) | Rebase → merge if green. Collapses. |
| #126 | devalue 5.6→5.8 | Merge if green (or close if in #121) |
| #114 | docker/metadata-action 5→6 | Merge if green* |
| #109 | webfactory/ssh-agent 0.9→0.9.1 | Merge if green* |
| #107 | appleboy/ssh-action 1.2.4→1.2.5 | Merge if green* |
| #101 | actions/setup-node 4→6 | Merge if green |
| #100 | actions/checkout 4→6 | Merge if green |
| #125 | **astro 5→6 MAJOR** | **DEFER** — label `deferred`, leave open |
| #123 | **@astrojs/node 9→10 MAJOR** | **DEFER** — label `deferred`, leave open |

\* `blog-sip/.github/workflows/deploy.yml` still exists; if reading it shows it's a dead VPS deploy (superseded by Vercel git-integration), **close** #114/#109/#107 as obsolete instead of merging.

- [ ] Rebase #121 → merge if green → close superseded (#126?).
- [ ] Audit `deploy.yml`: VPS-dead → close #114/#109/#107; still live → merge if green.
- [ ] Merge #100, #101 if green.
- [ ] Label #123, #125 `deferred` (`gh pr edit <N> --add-label deferred`; create label if absent).
- [ ] Confirm Vercel deploy green.
- [ ] **CHECKPOINT.**

---

## Task 4: docs-sip (16 PRs) — Vercel (Astro Starlight)

**Disposition:**
| PR | Bump | Action |
|----|------|--------|
| **#65** | group (6 updates) | Rebase → merge if green |
| #68 | @sip-protocol/sdk → 0.9.0 (github-actions) | **Verify**: current SDK is 0.9.0. If docs-sip already on 0.9.0 → **close as satisfied**; else merge |
| #94 | devalue 5.6→5.8 | Merge if green |
| #87 | postcss 8.5.6→8.5.13 | Merge if green |
| #81 | vite 6.4.1→6.4.2 | Merge if green |
| #80 | defu 6.1.4→6.1.6 | Merge if green |
| #77 | picomatch | Merge if green |
| #76 | smol-toml 1.6.0→1.6.1 | Merge if green |
| #72 | webfactory/ssh-agent 0.9.1→0.10 (CLEAN) | Merge |
| #70 | h3 1.15.5→1.15.9 | Merge if green |
| #67 | lodash-es + mermaid | Merge if green |
| #71 | docker/metadata-action 5→6 (**BLOCKED**) | Investigate block → merge/`--admin`/close* |
| #73 | docker/build-push-action 6→7 (**BLOCKED**) | Investigate block → merge/`--admin`/close* |
| #74 | slackapi/slack-github-action 2→3 (**BLOCKED**) | Investigate block → merge/`--admin`/close* |
| #75 | docker/login-action 3→4 (**BLOCKED**) | Investigate block → merge/`--admin`/close* |
| #93 | **astro + starlight MAJOR** | **DEFER** — label `deferred`, leave open |

\* docs-sip has BOTH `deploy.yml` AND `deploy-vps.yml`. Read both: if `deploy-vps.yml` is the dead VPS path (Vercel migration), **close** the docker/* PRs (#71/#73/#75) as obsolete. The `BLOCKED` state likely = required status check or review on these — if the bump is safe and CI green, `--admin` merge; if a genuinely-failing/obsolete check, close.

- [ ] Resolve #68 first (check `docs-sip` package.json SDK version vs 0.9.0).
- [ ] Rebase #65 → merge if green → close superseded.
- [ ] Merge the clean dep patches (#94, #87, #81, #80, #77, #76, #72, #70, #67) if green.
- [ ] Investigate the 4 `BLOCKED` CI-action PRs; merge/`--admin`/close per the workflow audit.
- [ ] Label #93 `deferred`.
- [ ] Confirm Vercel deploy green.
- [ ] **CHECKPOINT.**

---

## Task 5: sip-website (12 PRs) — Vercel (Next 15)

**Disposition:**
| PR | Bump | Action |
|----|------|--------|
| **#193** | group (21 updates) | Rebase (Mar 30, stale) → merge if green |
| #199 | axios 1.13→1.16.1 (security) | Merge if green |
| #198 | **next 15.5.10→15.5.18 (PATCH)** | **Merge if green** — the safe Next path (stays on 15) |
| #183 | **next 15→16 MAJOR** | **CLOSE** after #198 merges (conflicts; major deferred) |
| #181 | **eslint-config-next 15→16 (dev)** | **DEFER** — tied to Next 16; label `deferred` |
| #182 | jsdom 27→28 (dev/test) | Merge if green |
| #184 | actions/upload-artifact 6→7 | Merge if green |
| #189/#188/#187/#186 | docker/* (metadata/setup-buildx/login/build-push) | Merge if green* |
| #177 | webfactory/ssh-agent 0.9→0.9.1 | Merge if green* |

\* check `sip-website/deploy.yml` relevance (VPS-dead post-Vercel → close; live → merge).

- [ ] **Merge #198 (Next patch) BEFORE closing #183.** Then close #183 with a "deferring Next 16 to a focused task" comment.
- [ ] Rebase #193 → merge if green → close superseded.
- [ ] Merge #199, #182, #184 + green docker/ssh PRs.
- [ ] Label #181 `deferred`.
- [ ] Confirm Vercel deploy green (this is the apex — extra care).
- [ ] **CHECKPOINT.**

---

## Task 6: sip-app (21 PRs) — Vercel (Next 16), biggest

**Strategy: merge the NEWEST group #275 first — it likely supersedes most of the older individual bumps (#237–#264), collapsing 21 → a handful.**

| PR | Bump | Action |
|----|------|--------|
| **#275** | group (24 updates, May 25 — newest) | Merge if green (rebase if needed). **Then close everything it supersedes.** |
| #270 | next 16.1.6→16.2.6 (MINOR within 16) | Merge if green — safe, not a major |
| #274 | @protobufjs/utf8 1.1.0→1.1.1 | Merge if green / close if in #275 |
| #267 | axios 1.13→1.16 (security) | Merge if green / close if in #275 |
| #266 | ip-address 10.1→10.2 | " |
| #264 | follow-redirects 1.15→1.16 (security) | " |
| #260 | vite 7.3.1→7.3.2 | " |
| #258 | defu 6.1.4→6.1.6 | " |
| #256 | happy-dom 20.7→20.8 (dev) | " |
| #255 | brace-expansion (security) | " |
| #254 | yaml 2.8.2→2.8.3 | " |
| #252 | picomatch | " |
| #250 | flatted | " |
| #249 | socket.io-parser (security) | " |
| #246 | webfactory/ssh-agent | Merge if green* |
| #243/#242/#241/#240 | docker/* | Merge if green* |
| #239 | jsdom 27→28 (dev) | Merge if green / close if in #275 |
| #237 | rollup 4.58→4.59 | " |

\* check `sip-app/deploy.yml` relevance.

- [ ] Rebase #275 if stale → merge if green.
- [ ] `gh pr list -R sip-protocol/sip-app --state open` → close every individual bump now superseded by #275 (comment "Superseded by #275").
- [ ] Merge #270 (Next minor) + any remaining green non-superseded individuals + docker/ssh PRs.
- [ ] Confirm Vercel deploy green.
- [ ] **CHECKPOINT.**

---

## Task 7: sip-mobile (2 PRs) — human review

- [ ] **#59** (rz1989s, "docs: dApp Store reference", CLEAN, Jan 24): read the diff; recommend merge (likely) or close. RECTOR's own PR — surface, don't auto-merge.
- [ ] **#76** (ZakIIDev, "feat: privacy provider architecture + prototype UI", EPIC #73, Feb 1): full code review — check it builds, tests, aligns with current M17 privacy-backends architecture, and isn't superseded. Recommend merge / request-changes / close-with-thanks. **Do not auto-close a contributor PR.**
- [ ] Present both recommendations to RECTOR for the call.
- [ ] **CHECKPOINT (final).**

---

## Deferred — Framework Majors (separate post-HERALD task)

Left **open + labeled `deferred`** (not merged this pass). Each needs: local checkout → `pnpm install` → `pnpm build` → verify Vercel preview → then merge or close.

| PR | Bump | Repo on |
|----|------|---------|
| sip-website#183 | Next 15→16 | **CLOSED this pass** (re-open as a fresh upgrade task) |
| sip-website#181 | eslint-config-next 15→16 | tied to Next 16 |
| blog-sip#125 | Astro 5→6 | Astro |
| blog-sip#123 | @astrojs/node 9→10 | Astro adapter |
| docs-sip#93 | Astro + Starlight | Astro Starlight |

---

## Final Verification

- [ ] `gh search prs --owner sip-protocol --state open --limit 200 --json repository --jq '.[].repository.name' | sort | uniq -c` → only the deferred majors (4) + any held human PRs remain.
- [ ] Every web repo's latest `main` deploy is green (Vercel).
- [ ] sip-protocol `main` CI green.
- [ ] Report final counts: merged / closed-superseded / deferred / human-reviewed.

---

## Self-Review (coverage check)

- **All 69 PRs assigned a disposition?** Yes — circuits 2, sip-protocol 7, blog-sip 9, docs-sip 16, sip-website 12, sip-app 21, sip-mobile 2 = 69. ✓
- **Decisions honored?** Majors deferred (not merged); #183 closed in favor of patch #198; human PRs reviewed not auto-merged; per-repo checkpoints. ✓
- **No placeholders?** Commands are concrete; the only conditional is the per-PR CI-green gate + the `deploy.yml`-relevance audit (an explicit check step, not a vague TODO). ✓
- **Risk ordering?** circuits (warm-up) → sip-protocol (core, no deploy) → blog/docs/website/app (Vercel, group-collapse) → sip-mobile (human). ✓
