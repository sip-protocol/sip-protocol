# Noir on Solana Demo

Production-ready ZK proofs using Noir (Aztec) on Solana.

## Overview

This demo showcases SIP Protocol's Noir integration for Solana:

1. **Privacy Proofs**: Funding, Validity, and Fulfillment proofs
2. **Compliance Proofs**: Viewing key access, sanctions clearance
3. **Solana Verification**: Off-chain and on-chain proof verification

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  NOIR ZK PROOFS ON SOLANA                                   │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ NoirProofProvider│    │ BrowserNoirProvider│            │
│  │ (Node.js)       │    │ (Browser WASM)  │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      │                                      │
│                      ▼                                      │
│           ┌─────────────────────┐                          │
│           │ SolanaNoirVerifier  │                          │
│           │ - verifyOffChain()  │                          │
│           │ - verifyOnChain()   │                          │
│           └─────────────────────┘                          │
│                      │                                      │
│                      ▼                                      │
│           ┌─────────────────────┐                          │
│           │   Solana Devnet     │                          │
│           └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Run Node.js demo
npm run demo

# Run browser demo (opens in browser)
npm run demo:browser
```

## Circuits

SIP Protocol uses three Noir circuits:

| Circuit | Purpose | Constraints |
|---------|---------|-------------|
| Funding | Prove balance >= minimum | ~2,000 |
| Validity | Prove intent authorization | ~72,000 |
| Fulfillment | Prove correct execution | ~22,000 |

## Code Examples

### Generate a Funding Proof (Node.js)

```typescript
import { NoirProofProvider } from '@sip-protocol/sdk'

const provider = new NoirProofProvider()
await provider.initialize()

const { proof, publicInputs } = await provider.generateFundingProof({
  balance: 100n,
  minimumRequired: 50n,
  blindingFactor: new Uint8Array(32),
  assetId: '0xABCD',
  userAddress: '0x1234...',
  ownershipSignature: new Uint8Array(64),
})

console.log('Proof generated:', proof.type)
console.log('Public inputs:', publicInputs)
```

### Generate a Funding Proof (Browser)

```typescript
import { BrowserNoirProvider } from '@sip-protocol/sdk'

const provider = new BrowserNoirProvider({ useWorker: true })

await provider.initialize((progress) => {
  console.log(`Loading: ${progress.percent}%`)
})

const { proof } = await provider.generateFundingProof(
  params,
  (progress) => {
    updateProgressBar(progress.percent)
  }
)
```

### Verify on Solana

```typescript
import { SolanaNoirVerifier } from '@sip-protocol/sdk'

const verifier = new SolanaNoirVerifier({ network: 'devnet' })
await verifier.initialize()

// Off-chain verification (fast)
const isValid = await verifier.verifyOffChain(proof)

// On-chain verification (submits transaction)
const result = await verifier.verifyOnChain(proof, wallet)
console.log('Transaction:', result.signature)
```

### Compliance Proofs

```typescript
import { ComplianceProofProvider } from '@sip-protocol/sdk'

const compliance = new ComplianceProofProvider()
await compliance.initialize()

// Prove viewing key access to auditor
const result = await compliance.generateViewingKeyAccessProof({
  viewingKey: myViewingKey,
  transactionHash: '0x...',
  encryptedData: encryptedTx,
  auditorPublicKey: auditorKey,
  timestamp: Date.now() / 1000,
})

// Share proof with auditor (no data revealed)
await sendToAuditor(result.proof)
```

## Bounty Categories

This demo targets three Aztec/Noir bounty categories:

### Best Overall ZK Application ($5,000)

- **Pitch**: Production-ready privacy SDK with 2,757+ tests
- **Differentiator**: Not a toy - real SDK used by developers
- **Features**: Multi-chain support, React hooks, CLI

### Best Non-Financial ZK Use Case ($2,500)

- **Pitch**: Viewing Key Compliance Proofs
- **Example**: Prove transaction validity to auditor without revealing amount
- **Innovation**: Privacy + compliance (not just hiding)

### Most Creative Use of Noir ($2,500)

- **Pitch**: Privacy Aggregator with Multi-Backend Proof Composition
- **Example**: Same privacy API, multiple proof systems underneath
- **Vision**: Noir as part of larger privacy standard

## Stats

- **Tests**: 2,757+ passing
- **Circuits**: 3 production (funding, validity, fulfillment)
- **Platforms**: Node.js + Browser WASM
- **SDK**: Full TypeScript with React hooks

## Resources

- [SIP Protocol Documentation](https://docs.sip-protocol.org)
- [Noir Language](https://noir-lang.org)
- [Aztec Network](https://aztec.network)

## License

MIT
