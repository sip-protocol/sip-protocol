# SIP Protocol + Range SAS Integration

This example demonstrates how to integrate SIP Protocol viewing keys with Range's Solana Attestation Service (SAS) for compliance workflows.

## What is Range SAS?

[Range SAS](https://www.range.org/blog/introducing-solana-attestation-service) is a Solana Attestation Service that allows attesters (KYC providers, auditors, compliance officers) to make on-chain attestations about addresses.

## Why Combine with SIP?

SIP Protocol provides privacy through stealth addresses and Pedersen commitments. Range SAS provides compliance through attestations. Together, they enable:

- **Privacy by default**: Transactions are private using stealth addresses
- **Selective disclosure**: Viewing keys allow authorized parties to see transaction details
- **Attestation-gated access**: Only attestation holders can receive viewing keys
- **Audit trails**: Compliance teams can verify without breaking privacy for everyone

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  USER (Private Transactions)                                    │
│  └─ Sends/receives using stealth addresses                      │
│  └─ Amounts hidden with Pedersen commitments                    │
│  └─ Holds master viewing key                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  RANGE SAS (Attestation Layer)                                  │
│  └─ Auditor requests attestation from KYC provider              │
│  └─ Attestation stored on-chain (proves auditor identity)       │
│  └─ User verifies attestation before sharing viewing key        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  VIEWING KEY DELEGATION                                         │
│  └─ User creates time-limited viewing key for auditor           │
│  └─ Key derived from master key with attestation-based scope    │
│  └─ Auditor can now decrypt user's transactions                 │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# SIP Protocol
npm install @sip-protocol/sdk

# Range SAS (when available)
npm install @range-protocol/sas
```

## Files

- [viewing-key-delegation.ts](./viewing-key-delegation.ts) - Core viewing key delegation with attestation verification
- [compliance-workflow.ts](./compliance-workflow.ts) - Complete compliance workflow example
- [types.ts](./types.ts) - TypeScript types for the integration

## Quick Example

```typescript
import { deriveAuditorViewingKey, verifyAttestation } from './viewing-key-delegation'

// 1. Auditor presents their SAS attestation
const attestation = {
  attester: 'KYC_PROVIDER_ADDRESS',
  subject: 'AUDITOR_ADDRESS',
  schema: 'compliance-auditor-v1',
  expiresAt: new Date('2026-12-31'),
}

// 2. User verifies the attestation on-chain
const isValid = await verifyAttestation(connection, attestation)
if (!isValid) {
  throw new Error('Invalid or expired attestation')
}

// 3. User derives a time-limited viewing key for the auditor
const auditorViewingKey = deriveAuditorViewingKey({
  masterViewingKey: userMasterKey,
  auditorAddress: attestation.subject,
  attestationId: attestation.id,
  validUntil: new Date('2026-03-31'), // Q1 audit window
  scope: 'full', // or 'specific-transactions'
})

// 4. Auditor can now decrypt user's transactions
const transactions = await scanWithViewingKey(auditorViewingKey, userAddress)
```

## Use Cases

### 1. Quarterly Financial Audit

```typescript
// Auditor from Deloitte presents attestation
const deloitteAttestation = await getAttestationBySubject(
  connection,
  DELOITTE_AUDITOR_ADDRESS,
  'certified-auditor'
)

// User grants Q1 viewing access
const q1AuditKey = deriveAuditorViewingKey({
  masterViewingKey,
  auditorAddress: DELOITTE_AUDITOR_ADDRESS,
  attestationId: deloitteAttestation.id,
  validUntil: new Date('2026-03-31'),
  scope: 'full',
})
```

### 2. DAO Treasury Transparency

```typescript
// DAO members with governance attestation can view treasury
const memberAttestation = await getAttestationBySubject(
  connection,
  memberAddress,
  'dao-member-v1'
)

if (memberAttestation) {
  const memberViewingKey = deriveAuditorViewingKey({
    masterViewingKey: treasuryMasterKey,
    auditorAddress: memberAddress,
    attestationId: memberAttestation.id,
    scope: 'proposals', // Only approved proposals
  })
}
```

### 3. Regulatory Request

```typescript
// Regulator presents attestation from recognized authority
const regulatorAttestation = await getAttestationBySubject(
  connection,
  REGULATOR_ADDRESS,
  'sec-authorized-examiner'
)

// Grant access only to specific transactions
const regulatoryKey = deriveAuditorViewingKey({
  masterViewingKey,
  auditorAddress: REGULATOR_ADDRESS,
  attestationId: regulatorAttestation.id,
  scope: 'specific-transactions',
  transactionIds: ['tx1', 'tx2', 'tx3'], // Only these transactions
  validUntil: new Date('2026-02-28'),
})
```

## Security Considerations

1. **Attestation Verification**: Always verify attestations on-chain before delegating keys
2. **Time Limits**: Set appropriate expiration dates for viewing keys
3. **Scope Limits**: Use minimum required scope (specific transactions vs full access)
4. **Revocation**: Monitor for attestation revocations and invalidate keys
5. **Audit Logging**: Log all key derivations for compliance records

## Resources

- [Range SAS Documentation](https://docs.range.org/sas)
- [SIP Protocol Viewing Keys](https://docs.sip-protocol.org/viewing-keys)
- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)

## License

MIT - SIP Protocol
