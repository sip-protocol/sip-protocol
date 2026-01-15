# SIP Ethereum Contracts

Privacy-preserving transfers on Ethereum using Pedersen commitments, stealth addresses, and ZK proofs.

## Overview

SIP (Shielded Intents Protocol) enables private transfers on Ethereum where:
- **Amounts are hidden** using Pedersen commitments
- **Recipients are unlinkable** using EIP-5564 stealth addresses
- **Transfers are verifiable** using ZK proofs
- **Compliance is possible** using viewing keys

## Contracts

| Contract | Description |
|----------|-------------|
| `SIPPrivacy.sol` | Main privacy contract for shielded transfers |
| `PedersenVerifier.sol` | On-chain Pedersen commitment verification |
| `ZKVerifier.sol` | Noir/UltraHonk ZK proof verification |
| `StealthAddressRegistry.sol` | EIP-5564 stealth address registry |

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Solidity 0.8.24+

### Installation

```bash
cd contracts/sip-ethereum
forge install
```

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Deploy (Local)

```bash
# Start local node
anvil

# Deploy
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
```

## Usage

### Creating a Shielded Transfer

```solidity
// 1. Generate stealth address off-chain using SDK
// 2. Create Pedersen commitment to amount
// 3. Generate ZK proof (optional)
// 4. Call shieldedTransfer

sipPrivacy.shieldedTransfer{value: 1 ether}(
    commitment,           // Pedersen commitment
    stealthRecipient,     // Generated stealth address
    ephemeralPubKey,      // For deriving shared secret
    viewingKeyHash,       // For compliance scanning
    encryptedAmount,      // Amount encrypted with viewing key
    proof                 // Optional ZK proof
);
```

### Claiming a Transfer

```solidity
// 1. Scan events with viewing key off-chain
// 2. Derive stealth private key
// 3. Generate nullifier
// 4. Call claimTransfer

sipPrivacy.claimTransfer(
    transferId,   // Transfer to claim
    nullifier,    // Prevents double-spend
    proof,        // Optional ownership proof
    recipient     // Final recipient
);
```

### Registering Stealth Meta-Address

```solidity
// Register your stealth meta-address for receiving
registry.registerKeys(
    1,                    // Scheme: secp256k1 with view tags
    spendingPubKey,       // 33 bytes compressed
    viewingPubKey         // 33 bytes compressed
);
```

## Architecture

```
User App → SIPPrivacy.sol
              │
              ├── PedersenVerifier.sol (commitment validation)
              ├── ZKVerifier.sol (proof validation)
              └── StealthAddressRegistry.sol (EIP-5564 announcements)
```

## Security

See [AUDIT.md](./AUDIT.md) for the complete audit package and [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for detailed security analysis.

### Key Security Features

- **Re-entrancy Protection**: All state-changing functions use `nonReentrant`
- **Pausable**: Owner can pause in emergencies
- **Input Validation**: Comprehensive checks on all inputs
- **Nullifier Tracking**: Prevents double-claiming

## Gas Costs

| Operation | Gas (estimated) |
|-----------|-----------------|
| shieldedTransfer (ETH) | ~150,000 |
| shieldedTransfer (ERC20) | ~200,000 |
| claimTransfer | ~80,000 |
| With ZK verification | +300,000 |

## Configuration

### Constructor Parameters

**SIPPrivacy**:
- `owner`: Admin address
- `feeCollector`: Fee recipient
- `feeBps`: Initial fee (basis points, max 1000 = 10%)

**ZKVerifier**:
- `owner`: Admin who can set verification keys

### Admin Functions

```solidity
// Pause/unpause
sipPrivacy.setPaused(true);

// Update fee (max 10%)
sipPrivacy.setFee(100); // 1%

// Set verifiers
sipPrivacy.setPedersenVerifier(address);
sipPrivacy.setZkVerifier(address);
```

## EIP-5564 Compatibility

The contracts emit standard EIP-5564 `Announcement` events:

```solidity
event Announcement(
    uint256 indexed schemeId,      // 1 = secp256k1 with view tags
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata                  // viewTag + encryptedAmount
);
```

This allows standard EIP-5564 scanners to detect SIP transfers.

## Development

### Project Structure

```
contracts/sip-ethereum/
├── foundry.toml
├── src/
│   ├── SIPPrivacy.sol
│   ├── PedersenVerifier.sol
│   ├── ZKVerifier.sol
│   ├── StealthAddressRegistry.sol
│   ├── interfaces/
│   └── utils/
├── test/
└── script/
```

### Running Tests

```bash
# All tests
forge test

# With verbosity
forge test -vvv

# Specific test
forge test --match-test testShieldedTransfer

# Coverage
forge coverage
```

### Static Analysis

```bash
# Slither
slither src/

# Mythril
myth analyze src/SIPPrivacy.sol
```

## License

MIT License - see [LICENSE](../../LICENSE)

## Links

- **Documentation**: https://docs.sip-protocol.org
- **Website**: https://sip-protocol.org
- **GitHub**: https://github.com/sip-protocol
- **SDK**: `@sip-protocol/sdk`
