/**
 * Privacy-Tier Fee Model
 *
 * The protocol fee charged by a SIP privacy vault is gated on which privacy
 * milestone has SHIPPED — not on volume or time. The fee rises only when a
 * stronger cryptographic guarantee is delivered:
 *
 * - TIER_1 (10 bps) — commingled pool. Funds are pooled in a shared vault;
 *   withdrawals are authorized per-depositor. LIVE today.
 * - TIER_2 (30 bps) — unlinkable withdrawal. Trustless, nullifier-authorized
 *   withdrawal severs the on-chain deposit-to-withdrawal link. Scheduled.
 * - TIER_3 (50 bps) — confidential amounts. Settlement amounts are
 *   cryptographically hidden (Pedersen commitments / proof composition).
 *   Scheduled.
 *
 * The schedule is a frozen public commitment: the basis-point values cannot be
 * mutated at runtime. `CURRENT_PRIVACY_TIER` is the single source of truth for
 * which tier's privacy has shipped — bump it (and only it) when a tier lands.
 *
 * This is the protocol fee (the vault's revenue). It is distinct from the
 * relayer gas-recovery fee (`computeRelayerFee`) and from the legacy
 * volume-tiered calculator in the `fees/` module. A gasless vault cash-out pays
 * both the protocol fee and the relayer fee, additively.
 *
 * @module fees/privacy-tier
 */

/** Ordinal privacy milestone. The protocol fee rate is gated on which tier has shipped. */
export enum PrivacyTier {
  /** Commingled pool — 10 bps. Live. */
  TIER_1 = 'tier_1',
  /** Unlinkable withdrawal — 30 bps. Scheduled. */
  TIER_2 = 'tier_2',
  /** Confidential amounts — 50 bps. Scheduled. */
  TIER_3 = 'tier_3',
}

/** A privacy tier's fee descriptor. */
export interface PrivacyTierFee {
  /** The tier this descriptor describes. */
  tier: PrivacyTier
  /** Protocol fee in basis points (1 bps = 0.01%). One of 10 | 30 | 50. */
  bps: number
  /** Short human-readable label. */
  label: string
  /** The privacy guarantee earned at this tier. */
  description: string
  /** Whether this tier's privacy has shipped (derived from CURRENT_PRIVACY_TIER). */
  isActive: boolean
}

/** Canonical tier ordering, lowest privacy → highest. Drives ordinal comparisons and the monotonic invariant. */
const PRIVACY_TIER_ORDER: readonly PrivacyTier[] = Object.freeze([
  PrivacyTier.TIER_1,
  PrivacyTier.TIER_2,
  PrivacyTier.TIER_3,
])

/** Static facts per tier. `isActive` is derived at read time, never stored here. */
interface PrivacyTierSpec {
  bps: number
  label: string
  description: string
}

const PRIVACY_TIER_SCHEDULE: Readonly<Record<PrivacyTier, PrivacyTierSpec>> = Object.freeze({
  [PrivacyTier.TIER_1]: Object.freeze({
    bps: 10,
    label: 'Commingled pool',
    description: 'Funds are pooled in a shared vault; withdrawals are authorized per-depositor.',
  }),
  [PrivacyTier.TIER_2]: Object.freeze({
    bps: 30,
    label: 'Unlinkable withdrawal',
    description:
      'Trustless, nullifier-authorized withdrawal severs the on-chain deposit-to-withdrawal link without a trusted operator.',
  }),
  [PrivacyTier.TIER_3]: Object.freeze({
    bps: 50,
    label: 'Confidential amounts',
    description: 'Settlement amounts are cryptographically hidden (Pedersen commitments / proof composition).',
  }),
})

/**
 * The single source of truth for which privacy tier has shipped.
 * Bump this — and only this — when a stronger tier lands.
 */
export const CURRENT_PRIVACY_TIER: PrivacyTier = PrivacyTier.TIER_1

/**
 * Validate the whole fee model at module load, so a bad future edit fails fast
 * at import instead of crashing cryptically at call time. Asserts that every
 * ordered tier has a schedule entry with a non-negative integer bps, that the
 * bps values are non-decreasing across tiers (equal is allowed; a decrease is
 * not), and that CURRENT_PRIVACY_TIER is one of the ordered tiers. This is what
 * makes the "frozen public commitment" a real load-time invariant.
 */
function assertScheduleIntegrity(): void {
  let prevBps = -1
  for (const tier of PRIVACY_TIER_ORDER) {
    const spec = PRIVACY_TIER_SCHEDULE[tier]
    if (!spec) {
      throw new Error(`Privacy-tier fee schedule is missing an entry for ${tier}`)
    }
    if (!Number.isInteger(spec.bps) || spec.bps < 0) {
      throw new Error(`Privacy-tier fee for ${tier} must be a non-negative integer bps, got ${String(spec.bps)}`)
    }
    if (spec.bps < prevBps) {
      throw new Error(
        `Privacy-tier fee schedule must be non-decreasing; ${tier} (${spec.bps} bps) is below the preceding tier (${prevBps} bps)`,
      )
    }
    prevBps = spec.bps
  }
  if (!PRIVACY_TIER_ORDER.includes(CURRENT_PRIVACY_TIER)) {
    throw new Error(`CURRENT_PRIVACY_TIER (${String(CURRENT_PRIVACY_TIER)}) must be one of the ordered privacy tiers`)
  }
}

assertScheduleIntegrity()

function tierOrdinal(tier: PrivacyTier): number {
  const idx = PRIVACY_TIER_ORDER.indexOf(tier)
  if (idx === -1) {
    throw new Error(`Unknown privacy tier: ${String(tier)}`)
  }
  return idx
}

/** Whether `tier`'s privacy has shipped (its order <= the current tier's order). */
function isTierActive(tier: PrivacyTier): boolean {
  return tierOrdinal(tier) <= tierOrdinal(CURRENT_PRIVACY_TIER)
}

/**
 * Get the full fee descriptor for a privacy tier.
 *
 * @param tier - The privacy tier
 * @returns The descriptor (bps, label, description, derived isActive)
 * @throws If `tier` is not a known PrivacyTier
 *
 * @example
 * ```ts
 * getPrivacyTierFee(PrivacyTier.TIER_1)
 * // { tier: 'tier_1', bps: 10, label: 'Commingled pool', description: '…', isActive: true }
 * ```
 */
export function getPrivacyTierFee(tier: PrivacyTier): PrivacyTierFee {
  const spec = PRIVACY_TIER_SCHEDULE[tier]
  if (!spec) {
    throw new Error(`Unknown privacy tier: ${String(tier)}`)
  }
  return {
    tier,
    bps: spec.bps,
    label: spec.label,
    description: spec.description,
    isActive: isTierActive(tier),
  }
}

/**
 * Get the basis-point fee for a privacy tier.
 *
 * @param tier - The privacy tier
 * @returns Fee in basis points (10 | 30 | 50)
 * @throws If `tier` is not a known PrivacyTier
 *
 * @example
 * ```ts
 * getPrivacyTierFeeBps(PrivacyTier.TIER_2) // 30
 * ```
 */
export function getPrivacyTierFeeBps(tier: PrivacyTier): number {
  return getPrivacyTierFee(tier).bps
}

/**
 * Get the fee descriptor for the currently-shipped privacy tier.
 *
 * @returns The descriptor for CURRENT_PRIVACY_TIER (always isActive: true)
 *
 * @example
 * ```ts
 * getCurrentPrivacyTierFee().bps // 10 (today)
 * ```
 */
export function getCurrentPrivacyTierFee(): PrivacyTierFee {
  return getPrivacyTierFee(CURRENT_PRIVACY_TIER)
}

/**
 * Get the full fee schedule, ordered lowest → highest privacy.
 *
 * @returns All tier descriptors in canonical order (for display / transparency)
 *
 * @example
 * ```ts
 * getPrivacyTierSchedule().map((f) => f.bps) // [10, 30, 50]
 * ```
 */
export function getPrivacyTierSchedule(): PrivacyTierFee[] {
  return PRIVACY_TIER_ORDER.map((tier) => getPrivacyTierFee(tier))
}

/** Basis-point denominator (10_000 bps = 100%). */
const BPS_DENOMINATOR = 10_000n

/**
 * Compute the protocol fee for a gross amount at a given privacy tier.
 *
 * The fee is `amount * bps / 10_000` using bigint floor division — bps-only,
 * with NO flat floor (deliberately unlike `computeRelayerFee`, which floors to
 * guarantee gas coverage). A sub-threshold amount rounds to 0; it is never
 * bumped to a minimum.
 *
 * @param amount - Gross amount in the token's base units (non-negative)
 * @param tier - The privacy tier whose rate applies
 * @returns Fee in the token's base units
 * @throws If `amount` is negative, or `tier` is not a known PrivacyTier
 *
 * @example
 * ```ts
 * computePrivacyTierFee(1_000_000n, PrivacyTier.TIER_1) // 1_000n (10 bps)
 * computePrivacyTierFee(99n, PrivacyTier.TIER_1)        // 0n     (no flat floor)
 * ```
 */
export function computePrivacyTierFee(amount: bigint, tier: PrivacyTier): bigint {
  if (typeof amount !== 'bigint' || amount < 0n) {
    throw new Error('amount must be a non-negative bigint')
  }
  const bps = getPrivacyTierFeeBps(tier)
  return (amount * BigInt(bps)) / BPS_DENOMINATOR
}
