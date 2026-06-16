# Privacy-Tier Fee Schedule

The protocol fee charged by a SIP privacy vault is **gated on the privacy guarantee it delivers** — not on transaction volume or elapsed time. The fee rises only when a stronger cryptographic guarantee ships.

## The schedule

| Tier | Fee | Privacy guarantee |
|------|-----|-------------------|
| `TIER_1` | **10 bps** (0.10%) | **Commingled pool** — funds are pooled in a shared vault; withdrawals are authorized per-depositor. |
| `TIER_2` | **30 bps** (0.30%) | **Unlinkable withdrawal** — trustless, nullifier-authorized withdrawal severs the on-chain deposit→withdrawal link without a trusted operator. |
| `TIER_3` | **50 bps** (0.50%) | **Confidential amounts** — settlement amounts are cryptographically hidden (Pedersen commitments / proof composition). |

`TIER_1` is live today. `TIER_2` and `TIER_3` are a published commitment: their rates apply **only when** the corresponding privacy guarantee ships. The single source of truth for what has shipped is `CURRENT_PRIVACY_TIER`.

## Principles

- **More privacy, higher fee — never the reverse.** The schedule is monotonic: a stronger tier never costs less than a weaker one.
- **No volume or time component.** The rate is a pure function of the privacy tier. It does not change with how much you transact or when.
- **Frozen commitment.** The basis-point values are a frozen constant in the SDK; there is no API to mutate them at runtime.

## Usage

```ts
import {
  PrivacyTier,
  getCurrentPrivacyTierFee,
  getPrivacyTierFee,
  getPrivacyTierSchedule,
  computePrivacyTierFee,
} from '@sip-protocol/sdk'

// What does the vault charge today?
getCurrentPrivacyTierFee()
// → { tier: 'tier_1', bps: 10, label: 'Commingled pool', description: '…', isActive: true }

// Inspect a specific tier (including not-yet-shipped ones).
getPrivacyTierFee(PrivacyTier.TIER_2).isActive // false (until unlinkable withdrawal ships)

// Render the full roadmap.
getPrivacyTierSchedule().map((f) => `${f.label}: ${f.bps} bps`)

// Compute a concrete fee (base units, basis-point floor division, no flat floor).
computePrivacyTierFee(1_000_000n, PrivacyTier.TIER_1) // 1_000n
```

## Two distinct fees

A gasless vault cash-out involves **two additive fees**, kept separate in the SDK:

1. **Protocol privacy fee** — `computePrivacyTierFee`, described here. The vault's revenue.
2. **Relayer gas-recovery fee** — `computeRelayerFee`. Compensates whoever fronts the on-chain transaction fee on behalf of a stealth recipient. It floors at a fixed minimum to guarantee gas coverage; the protocol fee does not.

They are computed independently and summed by the caller.
