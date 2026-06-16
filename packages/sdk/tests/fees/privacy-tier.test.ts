import { describe, it, expect } from 'vitest'
import {
  PrivacyTier,
  CURRENT_PRIVACY_TIER,
  getPrivacyTierFee,
  getPrivacyTierFeeBps,
  getCurrentPrivacyTierFee,
  getPrivacyTierSchedule,
  computePrivacyTierFee,
  type PrivacyTierFee,
} from '../../src/fees/privacy-tier'

describe('privacy-tier fee schedule', () => {
  it('maps each tier to its locked basis-point rate', () => {
    expect(getPrivacyTierFeeBps(PrivacyTier.TIER_1)).toBe(10)
    expect(getPrivacyTierFeeBps(PrivacyTier.TIER_2)).toBe(30)
    expect(getPrivacyTierFeeBps(PrivacyTier.TIER_3)).toBe(50)
  })

  it('returns a full descriptor for a tier', () => {
    const fee: PrivacyTierFee = getPrivacyTierFee(PrivacyTier.TIER_1)
    expect(fee).toEqual({
      tier: PrivacyTier.TIER_1,
      bps: 10,
      label: 'Commingled pool',
      description: 'Funds are pooled in a shared vault; withdrawals are authorized per-depositor.',
      isActive: true,
    })
  })

  it('marks only the current tier (and lower) as active', () => {
    expect(getPrivacyTierFee(PrivacyTier.TIER_1).isActive).toBe(true)
    expect(getPrivacyTierFee(PrivacyTier.TIER_2).isActive).toBe(false)
    expect(getPrivacyTierFee(PrivacyTier.TIER_3).isActive).toBe(false)
  })

  it('exposes the current shipped tier as TIER_1', () => {
    expect(CURRENT_PRIVACY_TIER).toBe(PrivacyTier.TIER_1)
    expect(getCurrentPrivacyTierFee()).toEqual(getPrivacyTierFee(PrivacyTier.TIER_1))
    expect(getCurrentPrivacyTierFee().bps).toBe(10)
  })

  it('returns the full schedule in canonical order, non-decreasing', () => {
    const schedule = getPrivacyTierSchedule()
    expect(schedule.map((f) => f.tier)).toEqual([PrivacyTier.TIER_1, PrivacyTier.TIER_2, PrivacyTier.TIER_3])
    expect(schedule.map((f) => f.bps)).toEqual([10, 30, 50])
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].bps).toBeGreaterThanOrEqual(schedule[i - 1].bps)
    }
  })

  it('throws on an unknown tier', () => {
    expect(() => getPrivacyTierFee('tier_99' as PrivacyTier)).toThrow(/unknown privacy tier/i)
    expect(() => getPrivacyTierFeeBps('nope' as PrivacyTier)).toThrow(/unknown privacy tier/i)
  })

  it('returns independent descriptor objects (callers cannot corrupt the schedule)', () => {
    const a = getPrivacyTierFee(PrivacyTier.TIER_1)
    a.bps = 999
    a.label = 'mutated'
    expect(getPrivacyTierFee(PrivacyTier.TIER_1).bps).toBe(10)
    expect(getPrivacyTierFee(PrivacyTier.TIER_1).label).toBe('Commingled pool')
    const schedule = getPrivacyTierSchedule()
    schedule[0].bps = 999
    expect(getPrivacyTierSchedule()[0].bps).toBe(10)
  })
})

describe('computePrivacyTierFee', () => {
  it('applies the tier rate via basis-point floor division', () => {
    // 1 USDC (1_000_000 base units) * 10 bps = 1_000
    expect(computePrivacyTierFee(1_000_000n, PrivacyTier.TIER_1)).toBe(1_000n)
    expect(computePrivacyTierFee(1_000_000n, PrivacyTier.TIER_2)).toBe(3_000n)
    expect(computePrivacyTierFee(1_000_000n, PrivacyTier.TIER_3)).toBe(5_000n)
  })

  it('returns 0 for a zero amount', () => {
    expect(computePrivacyTierFee(0n, PrivacyTier.TIER_1)).toBe(0n)
  })

  it('has no flat floor — sub-threshold amounts round down to 0', () => {
    // 99 * 10 / 10_000 = 0.099 -> 0n (unlike computeRelayerFee, which floors)
    expect(computePrivacyTierFee(99n, PrivacyTier.TIER_1)).toBe(0n)
  })

  it('handles large bigint amounts without precision loss', () => {
    // 1e18 * 50 / 10_000 = 5e15
    expect(computePrivacyTierFee(1_000_000_000_000_000_000n, PrivacyTier.TIER_3)).toBe(5_000_000_000_000_000n)
  })

  it('throws on a negative amount', () => {
    expect(() => computePrivacyTierFee(-1n, PrivacyTier.TIER_1)).toThrow(/non-negative bigint/i)
  })

  it('throws on a non-bigint amount (JS callers)', () => {
    expect(() => computePrivacyTierFee(1_000_000 as unknown as bigint, PrivacyTier.TIER_1)).toThrow(
      /non-negative bigint/i,
    )
  })

  it('throws on an unknown tier', () => {
    expect(() => computePrivacyTierFee(1_000_000n, 'tier_99' as PrivacyTier)).toThrow(/unknown privacy tier/i)
  })
})
