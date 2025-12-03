# Noir Upgrade Tracking

**Issue:** [#144](https://github.com/sip-protocol/sip-protocol/issues/144)
**Last Updated:** December 2024

## Current Status

| Package | Current Version | Latest Stable | Notes |
|---------|----------------|---------------|-------|
| `@noir-lang/noir_js` | 1.0.0-beta.16 | 1.0.0-beta.16 | Pre-release (updated Dec 2024) |
| `@noir-lang/types` | 1.0.0-beta.16 | 1.0.0-beta.16 | Pre-release (updated Dec 2024) |
| `@aztec/bb.js` | 0.63.1 | 2.1.8 | Barretenberg backend (major upgrade available) |

**Note:** Updated from beta.15 to beta.16 on 2024-12-03. All 1,459 tests passing.

## Noir 1.0 Release Timeline

Based on [Aztec's roadmap](https://aztec.network/roadmap) and [Noir 1.0 Pre-Release announcement](https://aztec.network/blog/the-future-of-zk-development-is-here-announcing-the-noir-1-0-pre-release):

| Milestone | Target | Status |
|-----------|--------|--------|
| Noir 1.0 Pre-Release | Q4 2024 | ✅ Released |
| Security Audits | Q1 2025 | 🔄 In Progress |
| Noir 1.0 Stable | Q1-Q2 2025 | ⏳ Pending |
| Aztec Public Testnet | May 1, 2025 | ✅ Launched |
| Aztec Mainnet | Q4 2025 | ⏳ Planned |

## Upgrade Blockers

1. **No stable release yet** - Noir 1.0 is still in pre-release/beta
2. **Audit completion pending** - Security audits must complete before stable
3. **Breaking changes possible** - Beta versions may have API changes

## Monitoring Checklist

- [ ] Check [Noir npm](https://www.npmjs.com/package/@noir-lang/noir_js) for 1.0.0 stable release
- [ ] Review [Noir changelog](https://github.com/noir-lang/noir/releases) for breaking changes
- [ ] Test circuit compilation with new version
- [ ] Verify UltraHonk backend compatibility
- [ ] Update circuit artifacts if ABI changes
- [ ] Run full test suite

## Pre-Upgrade Testing Plan

When stable release is available:

### 1. Dependency Update (Branch: `feat/noir-stable`)
```bash
pnpm update @noir-lang/noir_js @noir-lang/types @aztec/bb.js
```

### 2. Circuit Recompilation
```bash
cd /path/to/circuits
nargo compile --force
```

### 3. Artifact Validation
```bash
node scripts/validate-circuits.js
```

### 4. Test Suite
```bash
pnpm test -- --run
```

### 5. Benchmark Comparison
```bash
node scripts/run-benchmarks.js --compare
```

## Expected Changes in 1.0

Based on pre-release notes:

1. **Automatic Folding** - Improved recursive proof performance
2. **Library Registry** - Better dependency management
3. **LSP Upgrades** - Enhanced editor support
4. **Stabilized ABI** - No breaking changes after 1.0

## Fallback Strategy

If upgrade introduces regressions:

1. Pin to last working beta version
2. Document specific incompatibilities
3. Report issues to Aztec team
4. Maintain parallel branch for testing

## Related Documentation

- [Noir Documentation](https://noir-lang.org/docs/)
- [Aztec Roadmap](https://aztec.network/roadmap)
- [Barretenberg Repository](https://github.com/AztecProtocol/barretenberg)
- [NoirCon0 Announcements](https://aztec.network/topic/noir)

## Action Items

| Action | Owner | Timeline |
|--------|-------|----------|
| Monitor npm for 1.0 stable | CI/Manual | Weekly |
| Test with beta.9 nightlies | Developer | Optional |
| Prepare upgrade branch | Developer | When 1.0 RC available |
| Full regression testing | QA | Before merge |
| Update documentation | Developer | After upgrade |

## Upgrade History

### beta.16 (2024-12-03)
- Upgraded from beta.15 → beta.16
- All 1,459 tests passing
- No breaking changes detected
- bb.js kept at 0.63.1 (major 2.x available but deferred)

## Current Recommendation

**Continue monitoring for Noir 1.0 stable release** (expected Q1-Q2 2025)

Status:
- ✅ Updated to beta.16 - working well
- ⏳ bb.js 2.x upgrade - evaluate for next milestone
- ⏳ Noir 1.0 stable - wait for official release

When 1.0 stable releases:
1. Create feature branch
2. Update dependencies
3. Recompile circuits
4. Run full test suite + benchmarks
5. If passing, merge and publish new SDK version
