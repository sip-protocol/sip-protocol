# Architecture: Solana Same-Chain Privacy

How SIP Protocol achieves private transactions on Solana.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SENDER                                                                  │
│  1. Parse recipient's SIP address (meta-address)                        │
│  2. Generate ephemeral keypair                                           │
│  3. Derive stealth address via ECDH                                      │
│  4. Create Pedersen commitment: C = amount·G + blinding·H               │
│  5. Call shielded_transfer instruction                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SIP PRIVACY PROGRAM (on-chain)                                         │
│  • Verify commitment format (valid curve point)                         │
│  • Create TransferRecord PDA with encrypted metadata                    │
│  • Transfer SOL to stealth address                                      │
│  • Emit ShieldedTransferEvent for indexing                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT                                                               │
│  1. Scan events using viewing key (view tag optimization)               │
│  2. Identify payments addressed to them via ECDH check                  │
│  3. Derive stealth private key from spending key + shared secret        │
│  4. Claim funds to main wallet                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Cryptographic Components

### 1. Stealth Addresses (EIP-5564 Style)

Stealth addresses enable one-time recipient addresses derived from a public meta-address.

**Meta-Address Format:**
```
sip:<chain>:<spending_pubkey>:<viewing_pubkey>
sip:solana:0x02abc...123:0x03def...456
```

**Key Derivation:**
```
Sender:
  ephemeral_privkey = random()
  ephemeral_pubkey = ephemeral_privkey · G
  shared_secret = hash(ephemeral_privkey · viewing_pubkey)
  stealth_pubkey = spending_pubkey + shared_secret · G

Recipient:
  shared_secret = hash(viewing_privkey · ephemeral_pubkey)
  stealth_privkey = spending_privkey + shared_secret
```

**Curve:** ed25519 for Solana-native compatibility

### 2. Pedersen Commitments

Hide transfer amounts while allowing verification.

```
C = v·G + r·H

Where:
  v = amount (value)
  r = blinding factor (random)
  G = generator point
  H = hash-to-curve("SIP_PEDERSEN_H")
```

**Properties:**
- **Hiding:** C reveals nothing about v without r
- **Binding:** Cannot open to different value
- **Homomorphic:** C1 + C2 = (v1+v2)·G + (r1+r2)·H

### 3. Viewing Keys

Enable selective disclosure for compliance.

```
viewing_key_hash = SHA256(viewing_public_key)
encrypted_amount = XChaCha20Poly1305(amount, viewing_key)
```

**Who Can See:**
- Recipient (has viewing key)
- Auditors (if recipient shares viewing key)
- Regulators (with viewing key disclosure)

### 4. View Tags (Optimization)

Fast filtering without full ECDH computation.

```
view_tag = shared_secret[0]  // First byte
```

Recipients check view_tag first (1 byte comparison) before doing full ECDH (expensive).

## On-Chain Program

### Program ID
```
S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at (devnet)
```

### Accounts

| Account | Type | Description |
|---------|------|-------------|
| Config | PDA `["config"]` | Global settings (authority, fees, pause) |
| TransferRecord | PDA `["transfer_record", sender, index]` | Per-transfer metadata |
| NullifierRecord | PDA `["nullifier", hash]` | Prevents double-claims |

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create config (admin) |
| `shielded_transfer` | Execute private SOL transfer |
| `shielded_token_transfer` | Execute private SPL transfer |
| `claim_transfer` | Claim as recipient |
| `set_paused` | Emergency pause (admin) |
| `update_fee` | Update fee bps (admin) |

### Events

```rust
ShieldedTransferEvent {
  sender: Pubkey,
  stealth_recipient: Pubkey,
  amount_commitment: [u8; 33],
  ephemeral_pubkey: [u8; 33],
  viewing_key_hash: [u8; 32],
  timestamp: i64,
  transfer_id: Pubkey,
}
```

## Data Flow

### Send Flow

```
1. SDK: Parse recipient SIP address
2. SDK: Generate ephemeral keypair
3. SDK: Compute stealth address via ECDH
4. SDK: Create Pedersen commitment
5. SDK: Encrypt amount with viewing key
6. SDK: Build shielded_transfer instruction
7. Wallet: Sign transaction
8. RPC: Submit to Solana
9. Program: Verify commitment, transfer SOL, emit event
```

### Receive Flow

```
1. Indexer: Watch ShieldedTransferEvent logs
2. SDK: Filter by view_tag (fast)
3. SDK: Perform full ECDH check
4. SDK: Decrypt amount with viewing key
5. SDK: Derive stealth private key
6. SDK: Build claim_transfer instruction
7. Wallet: Sign with stealth key
8. Program: Verify ownership, transfer to recipient
```

## Security Model

### What's Hidden

| Element | Hidden From | Visible To |
|---------|-------------|------------|
| Amount | Everyone | Recipient, viewing key holders |
| Recipient | On-chain observers | Recipient (derives address) |
| Sender | Nobody (currently) | Everyone (future: shielded sender) |

### Trust Assumptions

1. **ed25519 is secure** - Discrete log is hard
2. **SHA256 is collision-resistant** - Viewing key hash is binding
3. **Program is correct** - Verified via audit (pending)
4. **RPC is honest** - For scanning (or run own node)

### Known Limitations

1. **Sender visible** - v1 does not hide sender
2. **Mock ZK proofs** - Real verification in M18
3. **Timing correlation** - Careful with claim timing

## Integration Points

### RPC Providers

```typescript
import { createProvider } from '@sip-protocol/sdk'

// Helius (recommended - has DAS API)
const provider = createProvider('helius', { apiKey: 'xxx' })

// Generic RPC
const provider = createProvider('generic', {
  endpoint: 'https://api.mainnet-beta.solana.com'
})
```

### Wallet Adapters

Works with any wallet that implements `signTransaction`:
- Phantom
- Solflare
- Backpack
- Mobile Wallet Adapter (MWA)

### Indexing

For production scanning, use:
- Helius webhooks (real-time)
- Yellowstone gRPC (streaming)
- Custom indexer with getProgramAccounts

## Next Steps

- [API Reference](./api-reference.md) - Full SDK documentation
- [Security](./security.md) - Security considerations
- [Examples](./examples/) - Code samples
