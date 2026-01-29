# Solana Privacy Hackathon Submission Checklist

## Hackathon Info

| Field | Value |
|-------|-------|
| **Hackathon** | Solana Privacy Hack |
| **Deadline** | January 2026 |
| **Project** | SIP Protocol |

---

## Track Submissions

### ✅ Open Track (Light Protocol) — $18,000

| Requirement | Status | Notes |
|-------------|--------|-------|
| Working demo | ✅ | app.sip-protocol.org |
| GitHub repo | ✅ | github.com/sip-protocol/sip-protocol |
| Documentation | ✅ | docs.sip-protocol.org |
| Demo video | ✅ | 3 min max (handled manually) |
| Submission writeup | ✅ | light-protocol-open-track.md |

### ✅ Open Source Tooling (QuickNode) — $3,000

| Requirement | Status | Notes |
|-------------|--------|-------|
| Open source repo | ✅ | MIT licensed |
| Provider documentation | ✅ | PR #597 |
| RPC provider agnostic | ✅ | Helius, QuickNode, Triton, Generic |
| Unified interface | ✅ | `SolanaRPCProvider` interface |

### ✅ Security (Hacken) — $2,000 Voucher

| Requirement | Status | Notes |
|-------------|--------|-------|
| Security architecture doc | ✅ | ARCHITECTURE.md |
| Threat model | ✅ | THREAT-MODEL.md |
| Audit scope | ✅ | AUDIT-SCOPE.md |
| Dependency audit | ✅ | DEPENDENCY-AUDIT.md |
| Hacken prep guide | ✅ | HACKEN-PREP.md |

### ✅ End-to-End Private DeFi (Arcium) — $10,000

| Requirement | Status | Notes |
|-------------|--------|-------|
| Arcium MPC program | ✅ | github.com/sip-protocol/sip-arcium-program |
| Program deployed | ✅ | `S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9` (devnet) |
| Mobile integration | ✅ | ArciumAdapter in sip-mobile |
| Real MXE encryption | ✅ | Proper x25519 ECDH with MXE public key |
| Real Jupiter swaps | ✅ | No mocks, real on-chain txs |
| Stealth addresses | ✅ | SIP Native integration |
| 632 tests passing | ✅ | sip-mobile test suite |
| Submission writeup | ✅ | arcium-private-defi.md |

**Prizes:**
- Best Overall App: $5,000
- Best Integration into Existing App: $3,000
- Most \<encrypted\> Potential: 2 × $1,000

---

## Submission Materials

### Required

- [x] Project name: **SIP Protocol**
- [x] Tagline: **The Privacy Standard for Solana**
- [x] Description (short): Privacy middleware layer for Solana with viewing keys for compliance
- [x] GitHub URL: https://github.com/sip-protocol/sip-protocol
- [x] Demo URL: https://app.sip-protocol.org
- [x] Documentation: https://docs.sip-protocol.org

### Demo Video (TODO)

**Script outline:**
```
0:00 - Hook: "Privacy on Solana is fragmented"
0:30 - Problem: Different approaches, no standard
1:00 - Solution: SIP Protocol as middleware layer
1:30 - Demo: Create private payment
2:00 - Demo: Viewing keys for compliance
2:30 - Demo: Backend switching
2:45 - Value prop: One SDK, any backend
3:00 - CTA: GitHub link
```

**Technical requirements:**
- [x] 3 minutes max
- [x] 1080p minimum
- [x] Audio narration
- [x] Show code + UI

---

## Technical Requirements

### Build Verification

```bash
# Clone and build
git clone https://github.com/sip-protocol/sip-protocol
cd sip-protocol
pnpm install
pnpm build

# Run tests
pnpm test -- --run
# Expected: 6,661+ tests pass

# Type check
pnpm typecheck
# Expected: No errors
```

### Live Deployments

| Service | URL | Status |
|---------|-----|--------|
| Website | sip-protocol.org | ✅ Live |
| Docs | docs.sip-protocol.org | ✅ Live |
| App | app.sip-protocol.org | ✅ Live |
| Blog | blog.sip-protocol.org | ✅ Live |

### npm Packages

| Package | Version | Status |
|---------|---------|--------|
| @sip-protocol/sdk | 0.6.x | ✅ Published |
| @sip-protocol/types | 0.6.x | ✅ Published |
| @sip-protocol/react | 0.6.x | ✅ Published |
| @sip-protocol/cli | 0.6.x | ✅ Published |
| @sip-protocol/api | 0.6.x | ✅ Published |

---

## Pre-Submission Checklist

### Documentation

- [x] README is comprehensive
- [x] Installation instructions work
- [x] Code examples are accurate
- [x] API documentation exists
- [x] Security documentation complete

### Code Quality

- [x] All tests pass
- [x] TypeScript strict mode
- [x] No security vulnerabilities (critical)
- [x] Dependencies up to date

### Submission Form

- [ ] Project registered on hackathon platform
- [ ] Team members added
- [ ] Track(s) selected
- [ ] Demo video uploaded
- [ ] Submission description completed

---

## Post-Submission

- [ ] Announce on Twitter/X
- [ ] Share in Discord communities
- [ ] Respond to judge questions promptly
- [ ] Monitor for feedback

---

## Contact

| Role | Contact |
|------|---------|
| Lead | rector@rectorspace.com |
| GitHub | @rz1989s |
