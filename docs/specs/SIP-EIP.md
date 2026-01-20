---
eip: XXXX
title: Shielded Intents Protocol (SIP) - Privacy Standard for Cross-Chain Transactions
description: A standard interface for privacy-preserving transactions using stealth addresses, Pedersen commitments, and viewing keys
author: SIP Protocol Team (@sip-protocol)
discussions-to: https://ethereum-magicians.org/t/eip-xxxx-shielded-intents-protocol
status: Draft
type: Standards Track
category: ERC
created: 2026-01-20
requires: 5564, 6538
---

## Abstract

The Shielded Intents Protocol (SIP) defines a standard interface for privacy-preserving blockchain transactions across any chain. SIP combines stealth addresses for recipient privacy, Pedersen commitments for amount hiding, and viewing keys for selective disclosure—enabling compliant privacy that satisfies both user confidentiality needs and regulatory requirements.

Unlike mixing protocols that obscure transaction history through pooling, SIP provides cryptographic privacy at the transaction level: senders, recipients, and amounts are hidden by default, with optional disclosure to authorized parties via viewing keys. This approach enables privacy without the regulatory concerns associated with mixers, making it suitable for institutional adoption.

SIP is chain-agnostic and settlement-agnostic, functioning as middleware between applications and blockchains. It extends EIP-5564 (Stealth Addresses) and EIP-6538 (Stealth Meta-Address Registry) with amount hiding, compliance features, and cross-chain support.

## Motivation

### The Privacy Gap in Web3

Blockchain transactions are inherently public. Every transfer reveals sender, recipient, and amount—creating a permanent, searchable record of financial activity. This transparency, while valuable for auditability, creates significant problems:

1. **Personal Security Risk**: Visible wallet balances make users targets for theft, extortion, and social engineering attacks.

2. **Business Confidentiality**: Companies cannot transact on-chain without exposing supplier relationships, salary information, and strategic financial movements to competitors.

3. **Financial Surveillance**: Transaction histories enable profiling, discrimination, and unauthorized tracking of individuals and organizations.

4. **Front-Running**: Visible pending transactions enable MEV extraction, costing users billions annually.

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| **Mixers (Tornado Cash)** | Regulatory risk, fixed denominations, no compliance option, chain-specific |
| **Privacy Chains (Monero, Zcash)** | Siloed ecosystems, limited DeFi integration, no cross-chain |
| **L2 Privacy (Aztec)** | Requires migration, not composable with existing protocols |
| **Stealth Addresses (EIP-5564)** | Recipient privacy only—amounts still visible |

None provide: (1) amount hiding, (2) compliance capability, (3) cross-chain support, and (4) integration with existing chains and protocols.

### The SIP Solution

SIP addresses these gaps by providing:

1. **Complete Transaction Privacy**
   - Stealth addresses hide recipients (extends EIP-5564)
   - Pedersen commitments hide amounts
   - Ephemeral keys prevent sender linkability

2. **Compliance by Design**
   - Viewing keys enable selective disclosure
   - Auditors can verify transactions without full transparency
   - Satisfies regulatory requirements (FATF, MiCA)

3. **Chain-Agnostic Architecture**
   - Works on Ethereum, Solana, NEAR, and any chain
   - Settlement-agnostic (direct chain, bridges, intents)
   - Single SDK for all integrations

4. **Developer-Friendly Integration**
   - One-line privacy toggle for existing applications
   - React hooks, CLI tools, REST API
   - No smart contract deployment required

### Stakeholder Benefits

**For Users:**
- Protect wallet balances from public view
- Transact without revealing financial history
- Maintain privacy while staying compliant

**For Developers:**
- Add privacy to any dApp with minimal code changes
- Single API across all chains
- No cryptographic expertise required

**For Institutions:**
- Meet privacy regulations (GDPR, financial privacy laws)
- Maintain confidentiality of business transactions
- Comply with AML/KYC via viewing keys

**For Regulators:**
- Viewing keys provide authorized access
- Clear audit trails when disclosed
- Better than mixers—designed for compliance

### Use Cases

1. **Private Payments**: Send tokens without revealing amounts or creating linkable history

2. **Salary Disbursement**: Pay employees without exposing compensation to the public

3. **DAO Treasury**: Execute treasury operations without front-running or competitive intelligence leakage

4. **OTC Trading**: Large trades without market impact from visible transactions

5. **Cross-Chain Privacy**: Move assets between chains while maintaining privacy

## Specification

*Full specification to be completed in subsequent EIP sections.*

### Overview

SIP defines three core primitives:

#### 1. Stealth Addresses

Compatible with EIP-5564, extended for multi-chain support:

```
sip:<chain>:<spendingPubKey>:<viewingPubKey>

Example: sip:ethereum:0x02abc...123:0x03def...456
```

- **Spending Key**: Controls funds (secp256k1 or ed25519)
- **Viewing Key**: Enables transaction discovery and disclosure

#### 2. Pedersen Commitments

Homomorphic commitments hiding transaction amounts:

```
C = v·G + r·H

Where:
  v = value (hidden)
  r = blinding factor (random)
  G, H = generator points
```

Properties:
- **Hiding**: Cannot determine `v` from `C`
- **Binding**: Cannot find different `v'`, `r'` producing same `C`
- **Homomorphic**: `C(v1) + C(v2) = C(v1 + v2)` (enables verification)

#### 3. Viewing Keys

Selective disclosure mechanism:

```typescript
interface ViewingKey {
  // Derive from spending key
  derive(spendingKey: PrivateKey): ViewingKey

  // Share with authorized party
  share(recipient: Address, permissions: Permissions): void

  // Scan for incoming transactions
  scan(startBlock: number): Transaction[]

  // Disclose specific transaction
  disclose(txHash: Hash): DisclosedTransaction
}
```

### Privacy Levels

SIP defines three privacy levels:

| Level | Sender | Amount | Recipient | Viewing Key |
|-------|--------|--------|-----------|-------------|
| `transparent` | Visible | Visible | Visible | N/A |
| `shielded` | Hidden | Hidden | Hidden | Optional |
| `compliant` | Hidden | Hidden | Hidden | Required |

### Interface

```solidity
interface ISIP {
    /// @notice Generate stealth address for recipient
    function generateStealthAddress(
        bytes calldata spendingPubKey,
        bytes calldata viewingPubKey
    ) external returns (address stealthAddress, bytes calldata ephemeralPubKey);

    /// @notice Create Pedersen commitment for amount
    function createCommitment(
        uint256 amount
    ) external returns (bytes32 commitment, bytes32 blindingFactor);

    /// @notice Verify commitment matches claimed amount
    function verifyCommitment(
        bytes32 commitment,
        uint256 amount,
        bytes32 blindingFactor
    ) external pure returns (bool valid);

    /// @notice Check if viewing key can decrypt transaction
    function canDecrypt(
        bytes calldata viewingKey,
        bytes32 encryptedData
    ) external view returns (bool);
}
```

### Events

```solidity
/// @notice Emitted when shielded transfer occurs
event ShieldedTransfer(
    bytes32 indexed commitment,
    address indexed stealthAddress,
    bytes ephemeralPubKey,
    bytes encryptedNote
);

/// @notice Emitted when viewing key is registered
event ViewingKeyRegistered(
    address indexed account,
    bytes32 indexed viewingKeyHash
);
```

## Rationale

### Why Stealth Addresses + Pedersen Commitments?

**Stealth addresses alone (EIP-5564)** hide recipients but leave amounts visible. Observers can still track value flows and identify high-value targets.

**Pedersen commitments alone** hide amounts but leave sender-recipient links visible. Transaction graphs remain analyzable.

**Combined**, they provide complete transaction privacy while maintaining verifiability—the recipient can prove they received the correct amount without revealing it.

### Why Viewing Keys?

Pure privacy systems face regulatory challenges. Viewing keys solve this by enabling:

1. **Selective Disclosure**: Users choose what to reveal and to whom
2. **Compliance Proofs**: Demonstrate transaction legitimacy without full transparency
3. **Institutional Adoption**: Banks and corporations can use privacy while meeting audit requirements

### Why Chain-Agnostic?

Privacy shouldn't require choosing a specific chain. SIP works as middleware:

```
Application → SIP SDK → Privacy Layer → Any Chain
```

This enables:
- Existing apps to add privacy without migration
- Cross-chain privacy (same privacy guarantees across bridges)
- Future-proofing as new chains emerge

### Comparison with EIP-5564

| Feature | EIP-5564 | SIP |
|---------|----------|-----|
| Recipient privacy | ✅ | ✅ |
| Amount hiding | ❌ | ✅ (Pedersen) |
| Viewing keys | Basic | Full (selective disclosure) |
| Multi-chain | Single | Any chain |
| Compliance mode | ❌ | ✅ |

SIP is a superset of EIP-5564, maintaining compatibility while extending functionality.

## Backwards Compatibility

SIP is fully backwards compatible with:

- **EIP-5564**: SIP stealth addresses can be used with existing EIP-5564 infrastructure
- **EIP-6538**: SIP integrates with the Stealth Meta-Address Registry
- **Existing Tokens**: Works with any ERC-20, native tokens, or NFTs

No changes to existing contracts or infrastructure required.

## Reference Implementation

Reference implementations available at:
- TypeScript SDK: `@sip-protocol/sdk`
- Rust SDK: `sip-protocol-rs`
- Python SDK: `sip-protocol-py`
- Go SDK: `github.com/sip-protocol/sip-protocol/sdks/go`

Example usage:

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk'

// Initialize client
const sip = new SIP()

// Generate stealth address for recipient
const { stealthAddress, ephemeralPubKey } = await sip.generateStealthAddress(
  recipientSpendingPubKey,
  recipientViewingPubKey
)

// Create shielded transfer
const tx = await sip.transfer({
  to: stealthAddress,
  amount: parseEther('1.0'),
  privacyLevel: PrivacyLevel.SHIELDED,
  ephemeralPubKey,
})

// Recipient scans for incoming transfers
const incoming = await sip.scan({
  viewingKey: recipientViewingKey,
  startBlock: 12345678,
})
```

## Security Considerations

### Cryptographic Assumptions

SIP security relies on:
1. **Discrete Logarithm Problem (DLP)**: Stealth addresses and Pedersen commitments
2. **Decisional Diffie-Hellman (DDH)**: Key agreement for ephemeral keys
3. **Random Oracle Model**: Hash functions (SHA-256, Keccak-256)

### Attack Vectors and Mitigations

| Attack | Risk | Mitigation |
|--------|------|------------|
| Stealth address reuse | Medium | Generate new address per transaction |
| Viewing key compromise | High | Key rotation, hierarchical keys |
| Timing attacks | Low | Constant-time implementations |
| Metadata leakage | Medium | Encrypted notes, decoy transactions |
| Quantum computing | Future | Migration path to post-quantum (WOTS+) |

### Key Management

- Spending keys MUST be stored securely (hardware wallet recommended)
- Viewing keys MAY be shared but should be rotated periodically
- Ephemeral keys MUST be generated fresh for each transaction

### Privacy Guarantees

SIP provides:
- **Sender Privacy**: Ephemeral keys prevent sender identification
- **Recipient Privacy**: Stealth addresses prevent recipient tracking
- **Amount Privacy**: Pedersen commitments hide values
- **Unlinkability**: No connection between deposits and withdrawals

SIP does NOT protect against:
- Network-level surveillance (IP tracking)
- Side-channel attacks on client implementations
- Compromised viewing keys revealing past transactions

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).

---

## Appendix A: Prior Art

### EIP-5564: Stealth Addresses

Defines stealth address generation for Ethereum. SIP extends this with:
- Amount hiding via Pedersen commitments
- Selective disclosure via viewing keys
- Multi-chain support

### EIP-6538: Stealth Meta-Address Registry

Defines on-chain registry for stealth meta-addresses. SIP is fully compatible and recommends using this registry for discoverability.

### Zcash Sapling

Inspiration for viewing key design. SIP adapts the incoming/outgoing viewing key concept for EVM compatibility.

### Pedersen Commitments (Confidential Transactions)

Originally proposed by Maxwell for Bitcoin. SIP uses the same cryptographic construction for amount hiding.

## Appendix B: Test Vectors

*Test vectors to be added in implementation phase.*

## Appendix C: Reference Links

- SIP Protocol: https://sip-protocol.org
- Documentation: https://docs.sip-protocol.org
- GitHub: https://github.com/sip-protocol
- EIP-5564: https://eips.ethereum.org/EIPS/eip-5564
- EIP-6538: https://eips.ethereum.org/EIPS/eip-6538
