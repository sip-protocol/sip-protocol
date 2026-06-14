/**
 * Relayer fee model for gasless cash-out.
 *
 * The relayer fronts the SOL transaction fee on behalf of a stealth recipient
 * and recovers its cost from the SPL tokens being cashed out (fee-from-claim).
 * The fee is `max(flatFloor, amount * bps / 10_000)`: the floor guarantees the
 * fixed SOL gas cost is covered even on tiny claims; bps scales on large ones.
 * No price oracle in v1 — the floor is set in the token's base units.
 */

/** Relayer fee configuration (per token mint). */
export interface RelayerFeeConfig {
  /** Flat floor fee in the token's base units. Guarantees gas coverage on small claims. */
  flatFloor: bigint
  /** Basis points of the claim amount (1 bps = 0.01%). e.g. 10 = 0.1%. */
  bps: number
}

/**
 * Compute the relayer fee for a claim.
 *
 * @param amount - Gross amount available in the stealth token account (base units)
 * @param config - Fee model
 * @returns Fee in the token's base units (always >= flatFloor)
 * @throws If `bps` is negative or non-integer, or if `amount` is negative
 */
export function computeRelayerFee(amount: bigint, config: RelayerFeeConfig): bigint {
  if (!Number.isInteger(config.bps) || config.bps < 0) {
    throw new Error('bps must be a non-negative integer')
  }
  if (amount < 0n) {
    throw new Error('amount must be a non-negative bigint')
  }
  const bpsFee = (amount * BigInt(config.bps)) / 10_000n
  return bpsFee > config.flatFloor ? bpsFee : config.flatFloor
}
