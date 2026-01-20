# SIP Bridge Integration Guide

**Version:** 1.0.0
**Audience:** Bridge Developers, Protocol Integrators
**Prerequisites:** Understanding of cross-chain bridges, SIP basics

---

## Overview

This guide explains how to integrate SIP privacy features into cross-chain bridge protocols. By following this guide, bridge developers can enable privacy-preserving cross-chain transfers while maintaining compliance capabilities.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [Integration Patterns](#3-integration-patterns)
4. [Implementation Guide](#4-implementation-guide)
5. [Security Considerations](#5-security-considerations)
6. [Testing](#6-testing)
7. [Deployment Checklist](#7-deployment-checklist)

---

## 1. Quick Start

### 1.1 Installation

```bash
# Install SIP SDK and bridge adapter
npm install @sip-protocol/sdk @sip-protocol/bridge-adapters
```

### 1.2 Basic Integration (5 Minutes)

```typescript
import { SIP } from '@sip-protocol/sdk'
import { WormholeAdapter } from '@sip-protocol/bridge-adapters'

// Initialize SIP with bridge adapter
const sip = new SIP({
  bridges: [new WormholeAdapter()]
})

// Create privacy-preserving cross-chain transfer
const transfer = await sip.createCrossChainTransfer({
  sourceChain: 'ethereum',
  destChain: 'solana',
  recipient: 'sip:universal:0x02abc...123:0x03def...456',
  amount: 1000000n,
  token: 'USDC',
  privacyLevel: 'shielded'
})

// Execute transfer
const result = await transfer.execute()
console.log(`Bridge message: ${result.bridgeMessageId}`)
```

### 1.3 What You Get

| Feature | Description |
|---------|-------------|
| **Hidden Sender** | Source address not linked to destination |
| **Hidden Recipient** | One-time stealth address on destination chain |
| **Hidden Amount** | Pedersen commitment hides transfer amount |
| **Compliance Ready** | Viewing keys for authorized disclosure |

---

## 2. Architecture

### 2.1 Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BRIDGE INTEGRATION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  YOUR APPLICATION                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ User Interface                                                        │ │
│  │ • Select source/dest chains                                           │ │
│  │ • Enter recipient meta-address                                        │ │
│  │ • Choose privacy level                                                │ │
│  └────────────────────────────────────────┬──────────────────────────────┘ │
│                                           │                                 │
│                                           ▼                                 │
│  SIP SDK (Integration Point 1)                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Create shielded intent                                              │ │
│  │ • Generate stealth address for destination                            │ │
│  │ • Create amount commitment                                            │ │
│  │ • Encrypt memo (optional)                                             │ │
│  └────────────────────────────────────────┬──────────────────────────────┘ │
│                                           │                                 │
│                                           ▼                                 │
│  BRIDGE ADAPTER (Integration Point 2)                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Format SIP payload for bridge                                       │ │
│  │ • Call bridge contracts                                               │ │
│  │ • Handle bridge-specific logic                                        │ │
│  └────────────────────────────────────────┬──────────────────────────────┘ │
│                                           │                                 │
│                                           ▼                                 │
│  YOUR BRIDGE (Integration Point 3)                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • Relay encrypted SIP payload                                         │ │
│  │ • Verify proofs (optional)                                            │ │
│  │ • Execute on destination chain                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
SOURCE CHAIN                    BRIDGE                    DESTINATION CHAIN
     │                            │                            │
     │  1. Create shielded intent │                            │
     │  ┌──────────────────────┐  │                            │
     │  │ Amount commitment    │  │                            │
     │  │ Stealth address     │  │                            │
     │  │ Encrypted memo      │  │                            │
     │  └──────────┬───────────┘  │                            │
     │             │              │                            │
     │  2. Lock tokens + emit    │                            │
     │     SIP payload           │                            │
     │─────────────┼─────────────▶│                            │
     │             │              │  3. Relay encrypted        │
     │             │              │     payload                │
     │             │              │────────────────────────────▶│
     │             │              │                            │
     │             │              │  4. Announce stealth       │
     │             │              │     payment                │
     │             │              │  ┌──────────────────────┐  │
     │             │              │  │ Stealth address      │  │
     │             │              │  │ Ephemeral pubkey     │  │
     │             │              │  │ View tag             │  │
     │             │              │  └──────────────────────┘  │
     │             │              │                            │
```

---

## 3. Integration Patterns

### 3.1 Pattern A: Payload Wrapper (Recommended)

Wrap your existing bridge payload with SIP privacy layer:

```typescript
// Before: Standard bridge transfer
const payload = {
  recipient: '0x1234...abcd',  // Visible on-chain
  amount: 1000000n,            // Visible on-chain
  token: 'USDC'
}

// After: SIP-wrapped transfer
const sipPayload = {
  recipient: stealthAddress,    // One-time address
  amountCommitment: commitment, // Hidden amount
  ephemeralPubKey: ephPubKey,   // For stealth derivation
  viewTag: viewTag,             // For efficient scanning
  encryptedData: encrypted,     // Contains original data
  token: 'USDC'
}
```

**Advantages:**
- Minimal changes to existing bridge
- Privacy layer is additive
- Fallback to standard transfers

### 3.2 Pattern B: Native Integration

Build SIP into your bridge's core protocol:

```solidity
// Source chain contract
contract SIPBridge {
    event ShieldedTransfer(
        bytes32 indexed destChainId,
        bytes32 stealthAddress,
        bytes ephemeralPubKey,
        uint8 viewTag,
        bytes32 amountCommitment,
        bytes encryptedMemo
    );

    function initiateShieldedTransfer(
        bytes32 destChainId,
        bytes32 stealthAddress,
        bytes calldata ephemeralPubKey,
        uint8 viewTag,
        bytes32 amountCommitment,
        bytes calldata encryptedMemo,
        address token,
        bytes32 viewingKeyHash  // For compliance
    ) external {
        // Lock tokens
        IERC20(token).transferFrom(msg.sender, address(this), decodeAmount(amountCommitment));

        // Emit shielded event
        emit ShieldedTransfer(
            destChainId,
            stealthAddress,
            ephemeralPubKey,
            viewTag,
            amountCommitment,
            encryptedMemo
        );

        // Relay to destination
        _relayMessage(destChainId, _encodePayload(...));
    }
}
```

### 3.3 Pattern C: Shielded Pool

Maximum privacy with pool-based mixing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SHIELDED POOL PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. DEPOSIT (Source Chain)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ User deposits to shielded pool                                      │   │
│  │ Receives: commitment = hash(amount, nullifier, secret)              │   │
│  │ Pool tree: Merkle tree of all commitments                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  2. CROSS-CHAIN MESSAGE (Bridge)                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ZK Proof: "I know a valid commitment in the source pool"            │   │
│  │ No link to specific deposit                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  3. WITHDRAWAL (Destination Chain)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ User withdraws to stealth address                                   │   │
│  │ Nullifier prevents double-spend                                     │   │
│  │ No link to source deposit or bridge message                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Guide

### 4.1 Step 1: Create Bridge Adapter

```typescript
import { SIPBridgeAdapter, ShieldedTransferParams } from '@sip-protocol/sdk'

export class MyBridgeAdapter implements SIPBridgeAdapter {
  readonly bridgeId = 'my-bridge'
  readonly supportedChains = ['ethereum', 'solana', 'polygon']

  constructor(private config: MyBridgeConfig) {}

  async initiateShieldedTransfer(
    params: ShieldedTransferParams
  ): Promise<TransferResult> {
    // 1. Validate parameters
    this.validateParams(params)

    // 2. Encode SIP payload
    const sipPayload = this.encodeSIPPayload(params)

    // 3. Call your bridge contract
    const tx = await this.bridgeContract.initiateTransfer(
      params.destChain,
      sipPayload,
      { value: this.calculateFees(params) }
    )

    // 4. Wait for confirmation
    const receipt = await tx.wait()

    // 5. Extract bridge message ID
    const messageId = this.extractMessageId(receipt)

    return {
      sourceChainTxHash: receipt.hash,
      bridgeMessageId: messageId,
      estimatedArrival: this.estimateArrival(params)
    }
  }

  private encodeSIPPayload(params: ShieldedTransferParams): Uint8Array {
    // Encode according to SIP specification
    return encode({
      version: 1,
      stealthAddress: params.destStealthAddress.address,
      ephemeralPubKey: params.destStealthAddress.ephemeralPublicKey,
      viewTag: params.destStealthAddress.viewTag,
      amountCommitment: params.sourceCommitment.value,
      encryptedMemo: params.encryptedMemo,
      viewingKeyHash: params.viewingKeyHash
    })
  }

  async completeShieldedTransfer(
    proof: TransferProof
  ): Promise<CompletionResult> {
    // Called on destination chain to finalize transfer
    const tx = await this.destContract.completeTransfer(
      proof.bridgeMessageId,
      proof.sipPayload
    )

    return {
      destChainTxHash: tx.hash,
      stealthAddress: proof.sipPayload.stealthAddress
    }
  }

  async scanBridgeAnnouncements(
    viewingKey: ViewingKey
  ): Promise<BridgeAnnouncement[]> {
    // Scan for incoming cross-chain transfers
    const events = await this.destContract.queryFilter(
      this.destContract.filters.ShieldedTransferReceived()
    )

    return events
      .filter(e => this.isForViewer(e, viewingKey))
      .map(e => this.parseAnnouncement(e))
  }

  private isForViewer(event: Event, viewingKey: ViewingKey): boolean {
    // Quick view tag check
    const sharedSecret = ecdh(viewingKey.privateKey, event.ephemeralPubKey)
    const expectedViewTag = sha256(sharedSecret)[0]
    return expectedViewTag === event.viewTag
  }
}
```

### 4.2 Step 2: Source Chain Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SIPBridgeSource {
    using SafeERC20 for IERC20;

    // SIP payload structure
    struct SIPPayload {
        bytes32 stealthAddress;     // 32 bytes
        bytes ephemeralPubKey;      // 33 bytes (compressed)
        uint8 viewTag;              // 1 byte
        bytes32 amountCommitment;   // 32 bytes
        bytes encryptedMemo;        // Variable
        bytes32 viewingKeyHash;     // 32 bytes (for compliance)
    }

    // Events
    event ShieldedTransferInitiated(
        bytes32 indexed destChainId,
        bytes32 indexed viewingKeyHash,
        bytes sipPayload,
        uint256 timestamp
    );

    // Your bridge interface
    IBridge public immutable bridge;

    constructor(address _bridge) {
        bridge = IBridge(_bridge);
    }

    function initiateShieldedTransfer(
        bytes32 destChainId,
        SIPPayload calldata payload,
        address token,
        uint256 amount
    ) external payable {
        // 1. Transfer tokens to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // 2. Encode SIP payload
        bytes memory encodedPayload = abi.encode(
            payload.stealthAddress,
            payload.ephemeralPubKey,
            payload.viewTag,
            payload.amountCommitment,
            payload.encryptedMemo,
            payload.viewingKeyHash
        );

        // 3. Approve bridge to spend tokens
        IERC20(token).approve(address(bridge), amount);

        // 4. Call bridge with encoded payload
        bridge.sendTokenWithPayload{value: msg.value}(
            destChainId,
            token,
            amount,
            encodedPayload
        );

        // 5. Emit event for indexing
        emit ShieldedTransferInitiated(
            destChainId,
            payload.viewingKeyHash,
            encodedPayload,
            block.timestamp
        );
    }
}
```

### 4.3 Step 3: Destination Chain Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SIPBridgeDestination {
    // Announcement event (EIP-5564 compatible)
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    // Your bridge receiver
    function onBridgeMessage(
        bytes32 sourceChainId,
        bytes calldata payload,
        address token,
        uint256 amount
    ) external onlyBridge {
        // 1. Decode SIP payload
        (
            bytes32 stealthAddressBytes,
            bytes memory ephemeralPubKey,
            uint8 viewTag,
            bytes32 amountCommitment,
            bytes memory encryptedMemo,
            bytes32 viewingKeyHash
        ) = abi.decode(payload, (bytes32, bytes, uint8, bytes32, bytes, bytes32));

        // 2. Convert stealth address
        address stealthAddress = address(uint160(uint256(stealthAddressBytes)));

        // 3. Transfer tokens to stealth address
        IERC20(token).transfer(stealthAddress, amount);

        // 4. Emit announcement for scanning
        bytes memory metadata = abi.encode(
            viewTag,
            amountCommitment,
            encryptedMemo,
            viewingKeyHash,
            sourceChainId
        );

        emit Announcement(
            1,  // schemeId: secp256k1
            stealthAddress,
            address(this),
            ephemeralPubKey,
            metadata
        );
    }

    modifier onlyBridge() {
        require(msg.sender == address(bridge), "Only bridge");
        _;
    }
}
```

### 4.4 Step 4: Register Adapter

```typescript
import { SIP } from '@sip-protocol/sdk'
import { MyBridgeAdapter } from './my-bridge-adapter'

// Register your adapter
SIP.registerBridgeAdapter(new MyBridgeAdapter({
  sourceContract: '0x...',
  destContracts: {
    'ethereum': '0x...',
    'solana': 'Program...',
    'polygon': '0x...'
  }
}))

// Now users can use your bridge with SIP
const sip = new SIP()
const transfer = await sip.createCrossChainTransfer({
  bridge: 'my-bridge',  // Your bridge ID
  sourceChain: 'ethereum',
  destChain: 'solana',
  recipient: metaAddress,
  amount: 1000000n,
  privacyLevel: 'shielded'
})
```

---

## 5. Security Considerations

### 5.1 Payload Validation

Always validate SIP payloads:

```typescript
function validateSIPPayload(payload: SIPPayload): void {
  // 1. Validate stealth address format
  if (!isValidStealthAddress(payload.stealthAddress)) {
    throw new Error('Invalid stealth address')
  }

  // 2. Validate ephemeral public key is on curve
  if (!isOnCurve(payload.ephemeralPubKey)) {
    throw new Error('Invalid ephemeral public key')
  }

  // 3. Validate commitment format
  if (!isValidCommitment(payload.amountCommitment)) {
    throw new Error('Invalid amount commitment')
  }

  // 4. Validate view tag range
  if (payload.viewTag > 255) {
    throw new Error('Invalid view tag')
  }

  // 5. Validate encrypted memo size
  if (payload.encryptedMemo.length > MAX_MEMO_SIZE) {
    throw new Error('Memo too large')
  }
}
```

### 5.2 Replay Protection

Prevent cross-chain replay attacks:

```solidity
contract SIPBridgeWithReplayProtection {
    // Track used nullifiers per source chain
    mapping(bytes32 => mapping(bytes32 => bool)) public usedNullifiers;

    function onBridgeMessage(
        bytes32 sourceChainId,
        bytes calldata payload,
        bytes32 nullifier  // Unique per transfer
    ) external onlyBridge {
        // Check nullifier not used
        require(!usedNullifiers[sourceChainId][nullifier], "Replay");

        // Mark nullifier as used
        usedNullifiers[sourceChainId][nullifier] = true;

        // Process transfer...
    }
}
```

### 5.3 Bridge Security

| Threat | Mitigation |
|--------|------------|
| Payload tampering | Signed by source chain |
| Relay censorship | Multiple relay options |
| Double-spend | Nullifier tracking |
| Front-running | Commit-reveal scheme |

---

## 6. Testing

### 6.1 Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { MyBridgeAdapter } from './my-bridge-adapter'
import { generateMetaAddress, deriveStealthAddress } from '@sip-protocol/sdk'

describe('MyBridgeAdapter', () => {
  it('should encode SIP payload correctly', async () => {
    const adapter = new MyBridgeAdapter(testConfig)
    const metaAddress = generateMetaAddress()
    const stealthAddress = deriveStealthAddress(metaAddress)

    const payload = adapter.encodeSIPPayload({
      destStealthAddress: stealthAddress,
      sourceCommitment: createCommitment(1000000n),
      viewingKeyHash: computeViewingKeyHash(metaAddress.viewingPublicKey)
    })

    expect(payload.length).toBeGreaterThan(0)
    expect(payload[0]).toBe(1)  // Version
  })

  it('should detect transfers for viewer', async () => {
    const adapter = new MyBridgeAdapter(testConfig)
    const viewingKey = generateViewingKey()

    // Create mock announcement matching viewing key
    const announcement = createMockAnnouncement(viewingKey.publicKey)

    const isForViewer = adapter.isForViewer(announcement, viewingKey)
    expect(isForViewer).toBe(true)
  })
})
```

### 6.2 Integration Tests

```typescript
describe('Cross-Chain Transfer', () => {
  it('should complete shielded transfer E2E', async () => {
    // Setup
    const sender = await setupWallet('ethereum')
    const recipient = await setupWallet('solana')
    const metaAddress = recipient.getMetaAddress()

    // Create transfer
    const sip = new SIP({ bridges: [new MyBridgeAdapter(config)] })
    const transfer = await sip.createCrossChainTransfer({
      sourceChain: 'ethereum',
      destChain: 'solana',
      recipient: metaAddress,
      amount: 1000000n,
      privacyLevel: 'shielded'
    })

    // Execute
    const result = await transfer.execute()
    expect(result.bridgeMessageId).toBeDefined()

    // Wait for completion
    await waitForBridge(result.bridgeMessageId)

    // Verify recipient can scan
    const payments = await recipient.scanForPayments('solana')
    expect(payments.length).toBe(1)
    expect(payments[0].amount).toBe(1000000n)
  })
})
```

### 6.3 Testnet Deployment

```bash
# Deploy to testnets
npx hardhat deploy --network goerli --tags SIPBridgeSource
npx hardhat deploy --network solana-devnet --tags SIPBridgeDestination

# Run E2E tests on testnet
TESTNET=true npm run test:e2e
```

---

## 7. Deployment Checklist

### Pre-Deployment

- [ ] Security audit completed
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] Testnet deployment verified
- [ ] Documentation complete
- [ ] Gas optimization reviewed

### Contracts

- [ ] Source chain contract deployed
- [ ] Destination chain contracts deployed
- [ ] Bridge permissions configured
- [ ] Admin keys secured (multisig)

### Adapter

- [ ] Adapter registered with SIP SDK
- [ ] Fee estimation accurate
- [ ] Error handling comprehensive
- [ ] Logging/monitoring in place

### Post-Deployment

- [ ] Monitor first transfers
- [ ] Set up alerts for failures
- [ ] Document known issues
- [ ] Publish integration guide

---

## Support

- **Documentation:** https://docs.sip-protocol.org/bridges
- **Discord:** https://discord.gg/sip-protocol
- **GitHub Issues:** https://github.com/sip-protocol/sip-protocol/issues

---

**Last Updated:** 2026-01-21
