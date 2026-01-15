# SIP Ethereum Contracts - Audit Package

**Version:** 1.0.0
**Date:** 2026-01-15
**Contracts:** SIPPrivacy, PedersenVerifier, ZKVerifier, StealthAddressRegistry

---

## 1. Executive Summary

This audit package covers the SIP Protocol's Ethereum smart contracts for privacy-preserving transfers. The contracts implement:

- **Shielded Transfers**: ETH and ERC20 transfers with hidden amounts using Pedersen commitments
- **Stealth Addresses**: EIP-5564 compliant one-time addresses preventing recipient linkability
- **ZK Verification**: On-chain verification of Noir/UltraHonk zero-knowledge proofs
- **Compliance**: Viewing key support for selective disclosure to auditors

### Contract Summary

| Contract | LOC | Purpose |
|----------|-----|---------|
| SIPPrivacy.sol | ~600 | Main privacy contract |
| PedersenVerifier.sol | ~320 | Pedersen commitment verification |
| ZKVerifier.sol | ~400 | ZK proof verification |
| StealthAddressRegistry.sol | ~300 | EIP-5564 stealth address registry |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER APPLICATION                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SIPPrivacy.sol                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ shieldedTransfer│  │ claimTransfer   │  │ Admin Functions             │ │
│  │ (ETH + ERC20)   │  │ (with nullifier)│  │ (pause, fees, verifiers)    │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘ │
│           │                    │                                            │
│           ▼                    ▼                                            │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │ PedersenVerifier│  │ ZKVerifier      │                                  │
│  │ (commitment)    │  │ (Noir proofs)   │                                  │
│  └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      StealthAddressRegistry.sol                              │
│                    (EIP-5564 compatible announcements)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Model

### 3.1 Trust Assumptions

| Entity | Trust Level | Capabilities |
|--------|-------------|--------------|
| Contract Owner | Trusted | Can pause, update fees, set verifiers |
| Sender | Untrusted | Creates shielded transfers |
| Recipient | Untrusted | Claims transfers with nullifiers |
| ZK Verifier | Semi-trusted | Validates proofs (owner-configurable) |
| Pedersen Verifier | Semi-trusted | Validates commitments (external contract) |

### 3.2 Attack Vectors

#### 3.2.1 Double-Spend Attacks
- **Threat**: Claiming same transfer twice
- **Mitigation**: Nullifier tracking with `nullifiers[nullifier] = true`
- **Risk**: LOW - nullifiers are unique per transfer

#### 3.2.2 Front-Running
- **Threat**: MEV bots front-running transfers or claims
- **Mitigation**: Stealth addresses make recipient unpredictable
- **Risk**: MEDIUM - amount extraction possible via commitment analysis

#### 3.2.3 Replay Attacks
- **Threat**: Replaying proofs across transfers
- **Mitigation**: Nullifiers include transfer-specific data
- **Risk**: LOW - nullifiers are transfer-bound

#### 3.2.4 Commitment Malleability
- **Threat**: Creating valid commitment for different amount
- **Mitigation**: Pedersen commitments are computationally binding
- **Risk**: LOW - requires solving discrete log

#### 3.2.5 View Tag Leakage
- **Threat**: Analyzing view tags to link transactions
- **Mitigation**: View tags only leak ~1 bit per transaction
- **Risk**: LOW - statistical analysis requires many transactions

### 3.3 External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| EVM Precompiles | LOW | Standard, audited precompiles |
| ERC20 Tokens | MEDIUM | SafeERC20 patterns, return value checks |
| External Verifiers | MEDIUM | Owner-controlled, can be disabled |

---

## 4. Security Checklist

### 4.1 Re-entrancy Protection

- [x] All external calls follow checks-effects-interactions
- [x] `nonReentrant` modifier on all state-changing functions
- [x] Custom ReentrancyGuard implementation (minimal, audited pattern)

### 4.2 Integer Safety

- [x] Solidity 0.8.24 with built-in overflow protection
- [x] Explicit bounds checking where needed
- [x] No unchecked arithmetic in critical paths

### 4.3 Access Control

- [x] Owner-only admin functions
- [x] Pausable for emergency response
- [x] No unprotected selfdestruct
- [x] No delegatecall to untrusted contracts

### 4.4 Input Validation

- [x] Zero address checks
- [x] Amount bounds checking
- [x] Proof size limits
- [x] Commitment format validation

### 4.5 External Calls

- [x] Return value checks on all transfers
- [x] Gas limits on external calls
- [x] No arbitrary external calls

### 4.6 Cryptographic Security

- [x] Standard EVM precompiles for EC operations
- [x] No custom cryptographic implementations
- [x] Secure randomness not required on-chain

### 4.7 Event Emission

- [x] Events for all state changes
- [x] Indexed parameters for efficient filtering
- [x] EIP-5564 compatible Announcement events

---

## 5. Known Limitations

### 5.1 Gas Costs

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| shieldedTransfer (ETH) | ~150,000 | Without ZK verification |
| shieldedTransfer (ERC20) | ~200,000 | Includes token transfer |
| claimTransfer | ~80,000 | Without ZK verification |
| ZK verification | ~300,000-500,000 | Depends on circuit |
| Pedersen verification | ~50,000 | Using precompiles |

### 5.2 Privacy Considerations

1. **Transaction Graph**: On-chain observers can see sender → stealth address
2. **Amount Correlation**: Same amounts may be correlatable over time
3. **Timing Analysis**: Block timestamps visible
4. **Gas Analysis**: Gas usage patterns may leak information

### 5.3 Upgrade Path

Contracts are NOT upgradeable by design. Upgrades require:
1. Deploy new contracts
2. Users migrate funds
3. Update SDK/frontend

---

## 6. Test Coverage Requirements

### 6.1 Unit Tests

- [ ] All public/external functions
- [ ] All error conditions
- [ ] Edge cases (zero amounts, max values)
- [ ] Access control checks

### 6.2 Integration Tests

- [ ] Full shielded transfer flow
- [ ] Multi-transfer scenarios
- [ ] Fee collection
- [ ] Verifier integration

### 6.3 Fuzz Tests

- [ ] Random commitment values
- [ ] Random proof data
- [ ] Random amounts

### 6.4 Invariant Tests

- [ ] Total balance always matches deposits - withdrawals
- [ ] Nullifier can only be used once
- [ ] Only unclaimed transfers can be claimed

---

## 7. Deployment Checklist

### 7.1 Pre-Deployment

- [ ] All tests passing
- [ ] Slither analysis clean
- [ ] Gas profiling complete
- [ ] Admin addresses confirmed
- [ ] Initial fee rate confirmed
- [ ] Verification keys generated

### 7.2 Deployment Order

1. Deploy PedersenVerifier
2. Deploy ZKVerifier
3. Deploy StealthAddressRegistry
4. Deploy SIPPrivacy (with verifier addresses)
5. Set verification keys in ZKVerifier
6. Verify all contracts on Etherscan

### 7.3 Post-Deployment

- [ ] Verify contract ownership
- [ ] Test small transfer
- [ ] Monitor first 24h of transactions
- [ ] Document deployed addresses

---

## 8. Contact Information

**Security Issues**: security@sip-protocol.org
**General Inquiries**: hello@sip-protocol.org
**Documentation**: https://docs.sip-protocol.org

---

## 9. File Inventory

```
contracts/sip-ethereum/
├── foundry.toml                 # Foundry configuration
├── AUDIT.md                     # This file
├── SECURITY_CHECKLIST.md        # Detailed security analysis
├── README.md                    # Setup and usage guide
└── src/
    ├── SIPPrivacy.sol           # Main privacy contract
    ├── PedersenVerifier.sol     # Pedersen commitment verifier
    ├── ZKVerifier.sol           # ZK proof verifier
    ├── StealthAddressRegistry.sol # EIP-5564 registry
    ├── interfaces/
    │   ├── IERC20.sol           # ERC20 interface
    │   ├── IPedersenVerifier.sol # Pedersen interface
    │   └── IZKVerifier.sol      # ZK verifier interface
    └── utils/
        └── ReentrancyGuard.sol  # Re-entrancy protection
```

---

**Prepared for audit by SIP Protocol Team**
**Last Updated**: 2026-01-15
