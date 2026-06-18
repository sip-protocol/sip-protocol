import { describe, it, expect } from 'vitest'
import { assessFlowPrivacy } from '../../src/flow-privacy/assess'
import { PrivacyTier } from '../../src/fees/privacy-tier'
import type { FlowInput, WindowWithdrawal } from '../../src/flow-privacy/types'

const SOL = '11111111111111111111111111111111'
const flow: FlowInput = { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000, gasless: true, signature: 'SELF' }

// 10 same-mint, same-amount, in-window candidates → anonymity 'strong'
const bigCrowd: WindowWithdrawal[] = Array.from({ length: 10 }, (_, i) => ({
  mint: SOL,
  transferAmount: 5_000_000_000n,
  timestamp: 1_000_000 + i,
  signature: `c${i}`,
}))

describe('assessFlowPrivacy', () => {
  it('caps a TIER_1 flow at moderate even with a strong crowd (honesty guarantee)', () => {
    const a = assessFlowPrivacy(flow, bigCrowd)
    expect(a.factors).toEqual({ anonymity: 'strong', linkability: 'strong', amount: 'weak' })
    expect(a.score).toBe(59) // min(round(70), 59)
    expect(a.band).toBe('moderate')
    expect(a.amountHiding.tier).toBe(PrivacyTier.TIER_1)
    // strong anon + gasless → the amount caveat is the ONLY one (toEqual, not toContain)
    expect(a.caveats).toEqual([
      'Withdrawal amount (5000000000) is visible-but-commingled on-chain — not cryptographically hidden.',
    ])
  })

  it('reaches strong only when amounts are cryptographically hidden (TIER_3)', () => {
    const a = assessFlowPrivacy(flow, bigCrowd, { tier: PrivacyTier.TIER_3 })
    expect(a.factors.amount).toBe('strong')
    expect(a.score).toBe(100)
    expect(a.band).toBe('strong')
    expect(a.caveats).toEqual([]) // strong anon + gasless + hidden amount → no caveats
  })

  it('TIER_2 (unlinkable) can reach strong band with visible amounts', () => {
    const a = assessFlowPrivacy(flow, bigCrowd, { tier: PrivacyTier.TIER_2 })
    expect(a.score).toBe(70) // min(round(70), 84)
    expect(a.band).toBe('strong')
    // tier-accurate wording, and the ONLY caveat for a strong+gasless TIER_2 flow
    expect(a.caveats).toEqual([
      'Withdrawal amount (5000000000) is visible-but-unlinkable on-chain — not cryptographically hidden.',
    ])
  })

  it('empty crowd → limited band, thin-set caveat', () => {
    const a = assessFlowPrivacy(flow, [])
    expect(a.factors.anonymity).toBe('weak')
    expect(a.score).toBe(30) // round(100*(0.4*0 + 0.3*1 + 0.3*0)) capped at 59
    expect(a.band).toBe('limited')
    expect(a.caveats.some((c) => c.includes('Anonymity set is 0'))).toBe(true)
  })

  it('self-paid gas lowers linkability and adds a caveat', () => {
    const a = assessFlowPrivacy({ ...flow, gasless: false }, bigCrowd)
    expect(a.factors.linkability).toBe('moderate')
    expect(a.gasless).toBe(false)
    expect(a.caveats.some((c) => c.includes('paid its own gas'))).toBe(true)
  })

  it('propagates validation errors from the primitives', () => {
    expect(() => assessFlowPrivacy({ ...flow, transferAmount: -1n }, [])).toThrow('flow.transferAmount')
    expect(() => assessFlowPrivacy(flow, [], { tier: 'tier_9' as PrivacyTier })).toThrow('tier')
  })
})
