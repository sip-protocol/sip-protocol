import { describe, it, expect } from 'vitest'
import { computeRelayerFee, type RelayerFeeConfig } from '../../../src/chains/solana/relayer-fee'

describe('computeRelayerFee', () => {
  const cfg: RelayerFeeConfig = { flatFloor: 10_000n, bps: 10 } // 0.01 USDC floor, 0.1%

  it('uses the flat floor when bps fee is smaller (small claim)', () => {
    // 1 USDC * 10bps = 1000 < 10_000 floor
    expect(computeRelayerFee(1_000_000n, cfg)).toBe(10_000n)
  })

  it('uses the bps fee when it exceeds the floor (large claim)', () => {
    // 1000 USDC * 10bps = 1_000_000 > 10_000 floor
    expect(computeRelayerFee(1_000_000_000n, cfg)).toBe(1_000_000n)
  })

  it('returns the floor exactly at the crossover', () => {
    // floor 10_000 == amount*10/10000 => amount = 10_000_000
    expect(computeRelayerFee(10_000_000n, cfg)).toBe(10_000n)
  })

  it('returns the floor for a zero-amount claim', () => {
    expect(computeRelayerFee(0n, cfg)).toBe(10_000n)
  })

  it('supports a zero floor (pure bps)', () => {
    expect(computeRelayerFee(2_000_000n, { flatFloor: 0n, bps: 25 })).toBe(5_000n)
  })

  it('throws on negative bps', () => {
    expect(() => computeRelayerFee(1n, { flatFloor: 0n, bps: -1 })).toThrow('bps must be')
  })

  it('throws on fractional bps', () => {
    expect(() => computeRelayerFee(1n, { flatFloor: 0n, bps: 1.7 })).toThrow('bps must be')
  })

  it('throws on a negative amount', () => {
    expect(() => computeRelayerFee(-1n, cfg)).toThrow('amount must be')
  })

  it('switches to the bps fee just past the crossover', () => {
    // floor=10_000; bps fee overtakes the floor once amount*10/10_000 > 10_000,
    // i.e. amount >= 10_001_000 (integer division floors). 10_001_000*10/10_000 = 10_001.
    expect(computeRelayerFee(10_001_000n, cfg)).toBe(10_001n)
  })
})
