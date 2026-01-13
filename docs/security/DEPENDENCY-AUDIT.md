# Dependency Security Audit

| Field | Value |
|-------|-------|
| **Document** | DEP-AUDIT-001 |
| **Version** | 1.0.0 |
| **Date** | 2026-01-13 |
| **Tool** | pnpm audit |
| **Status** | Active |

## Executive Summary

This document tracks known vulnerabilities in SIP Protocol dependencies and their mitigation status.

**Current Status**: 2 HIGH severity vulnerabilities identified (transitive dependencies)

## 1. Vulnerability Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✅ |
| High | 2 | ⚠️ Transitive, mitigated |
| Medium | 0 | ✅ |
| Low | 0 | ✅ |

## 2. Detailed Findings

### 2.1 bigint-buffer (HIGH)

| Field | Value |
|-------|-------|
| **Package** | bigint-buffer |
| **Vulnerable Versions** | <=1.1.5 |
| **Patched Versions** | None available |
| **Advisory** | [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) |
| **Description** | Buffer Overflow via toBigIntLE() Function |

**Dependency Path**:
```
@sip-protocol/sdk
└── @solana/spl-token@0.4.14
    └── @solana/buffer-layout-utils@0.2.0
        └── bigint-buffer@1.1.5 ⚠️
```

**Risk Assessment**:
- **Exploitability**: Low - requires crafted input to trigger overflow
- **Impact on SIP**: Low - SIP does not use toBigIntLE() directly
- **Data Flow**: This dependency is used for Solana token operations, not privacy-critical code

**Mitigation**:
- Upstream fix pending (no patched version available)
- SIP code does not call vulnerable function directly
- Monitor for @solana/spl-token update

### 2.2 qs (HIGH)

| Field | Value |
|-------|-------|
| **Package** | qs |
| **Vulnerable Versions** | <6.14.1 |
| **Patched Versions** | >=6.14.1 |
| **Advisory** | [GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p) |
| **Description** | arrayLimit bypass allows DoS via memory exhaustion |

**Dependency Path**:
```
@sip-protocol/api
└── express@5.2.1
    └── qs@6.14.0 ⚠️
```

**Risk Assessment**:
- **Exploitability**: Medium - requires malicious query string
- **Impact on SIP**: Low - @sip-protocol/api is optional package for REST endpoints
- **Data Flow**: Only affects query string parsing in API routes

**Mitigation**:
- Upgrade express when patch available
- API package includes rate limiting (express-rate-limit)
- Input validation on all endpoints

## 3. Security-Critical Dependencies

These are the core cryptographic dependencies - all audited:

| Package | Version | Audit | Notes |
|---------|---------|-------|-------|
| @noble/curves | 1.8.x | [Cure53 2022](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-cure53-audit-nbl2.pdf) | ECC operations |
| @noble/hashes | 1.7.x | [Cure53 2022](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-cure53-audit-nbl2.pdf) | Hash functions |
| @noble/ciphers | 1.2.x | [Cure53 2024](https://github.com/paulmillr/noble-ciphers/blob/main/audit/2024-08-cure53-audit.pdf) | Symmetric encryption |
| @aztec/bb.js | 0.x | Aztec Internal | ZK proving |
| @solana/web3.js | 1.x | Solana Foundation | Chain interaction |

## 4. Dependency Categories

### 4.1 Production Dependencies (@sip-protocol/sdk)

| Category | Packages | Security Relevance |
|----------|----------|-------------------|
| **Cryptographic** | @noble/curves, @noble/hashes, @noble/ciphers | Critical - core security |
| **ZK Proving** | @aztec/bb.js | High - proof generation |
| **Chain Interaction** | @solana/web3.js, @solana/spl-token | Medium - external data |
| **Utilities** | @scure/base | Low - encoding |

### 4.2 Development Dependencies

Development dependencies are not shipped with production builds and pose no runtime security risk.

## 5. Supply Chain Security

### 5.1 Package Verification

| Check | Status |
|-------|--------|
| Lock file integrity | ✅ pnpm-lock.yaml committed |
| Dependency pinning | ✅ Exact versions in lock file |
| GitHub provenance | ⚠️ Not all packages have provenance |
| npm 2FA | ⚠️ @sip-protocol packages require 2FA |

### 5.2 Recommendations

1. **Enable npm provenance** when publishing @sip-protocol packages
2. **Dependabot alerts** enabled on GitHub repository
3. **Regular audits** - run `pnpm audit` before each release
4. **Lock file review** - review lock file changes in PRs

## 6. Update Schedule

| Frequency | Action |
|-----------|--------|
| Weekly | Run `pnpm audit`, review new advisories |
| Monthly | Evaluate minor version updates |
| Quarterly | Evaluate major version updates |
| On Advisory | Immediate assessment of critical CVEs |

## 7. Audit Commands

```bash
# Check for vulnerabilities
pnpm audit

# Check specific package
pnpm why bigint-buffer

# Update to patched versions
pnpm update --latest

# Force audit resolution (use with caution)
pnpm audit --fix
```

## 8. Contact

For security concerns related to SIP Protocol dependencies:
- **Email**: security@sip-protocol.org
- **GitHub**: Open private security advisory

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-13 | 1.0.0 | Initial dependency audit |
