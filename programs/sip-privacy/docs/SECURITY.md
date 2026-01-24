# Security Considerations

## Overview

SIP Privacy is a Solana program implementing shielded SOL transfers with Pedersen commitments, stealth addresses, and viewing keys for compliance.

## Access Control

### Authority

- Single authority controls `Config` account
- Authority can pause/unpause the program
- Authority can update fee basis points (max 1000 = 10%)
- No transfer of authority currently implemented

### PDAs

| PDA | Seeds | Purpose |
|-----|-------|---------|
| `Config` | `["config"]` | Global configuration |
| `TransferRecord` | `["transfer_record", sender, index]` | Per-transfer metadata |

## Cryptographic Security

### Pedersen Commitments

- 33-byte compressed curve points (secp256k1)
- `C = v*G + r*H` where `v` = amount, `r` = blinding factor
- Hiding: Commitment reveals nothing about `v` without `r`
- Binding: Cannot open commitment to different value

### Stealth Addresses

- ed25519 public keys derived from recipient's viewing/spending keys
- One-time addresses prevent linkability
- Ephemeral keypairs provide forward secrecy

### Viewing Keys

- SHA-256 hash of viewing key stored on-chain
- Enables selective disclosure for compliance
- Does not reveal key itself (hash is one-way)

### Encrypted Amounts

- XOR with viewing key hash (placeholder)
- Production: XChaCha20-Poly1305 AEAD
- Only viewing key holder can decrypt

## Known Limitations

### Mock ZK Proofs

Current implementation uses mock proofs (128 bytes of deterministic data). Production deployment requires:

1. Real Groth16/PLONK proofs from Noir circuits
2. On-chain verifier (Sunspot or similar)
3. Proof validation before accepting transfers

### Timing Side Channels

- `curve25519-dalek` 3.2.1 has timing vulnerability (RUSTSEC-2024-0344)
- Transitive dependency from Solana SDK
- Awaiting upstream fix

### Amount Encryption

- Current XOR encryption is placeholder
- Upgrade to XChaCha20-Poly1305 before mainnet

## Recommendations

1. **Before Mainnet**
   - Implement real ZK proof verification
   - Upgrade amount encryption to AEAD
   - Add authority transfer mechanism
   - Add emergency withdrawal for stuck funds

2. **Monitoring**
   - Track `paused` state changes
   - Alert on fee changes
   - Monitor large transfers

3. **Operational**
   - Use hardware wallet for authority key
   - Implement multisig for authority (Squads)
   - Regular key rotation schedule
