import { describe, it, expect } from 'vitest'
import {
  gaslessFlag,
  amountHidingStatus,
  deriveAnonymityLevel,
  deriveLinkabilityLevel,
  deriveAmountLevel,
} from '../../src/flow-privacy/factors'
import { PrivacyTier } from '../../src/fees/privacy-tier'
import type { FlowInput } from '../../src/flow-privacy/types'

const flow: FlowInput = {
  mint: '11111111111111111111111111111111',
  transferAmount: 5_000_000_000n,
  timestamp: 1_000_000,
  gasless: true,
}

describe('gaslessFlag', () => {
  it('returns the flow gasless flag', () => {
    expect(gaslessFlag(flow)).toBe(true)
    expect(gaslessFlag({ ...flow, gasless: false })).toBe(false)
  })
  it('validates input', () => {
    expect(() => gaslessFlag({ ...flow, mint: '' })).toThrow('flow.mint')
  })
})

describe('amountHidingStatus', () => {
  it('defaults to the current tier (TIER_1 = visible-but-commingled)', () => {
    expect(amountHidingStatus(flow)).toEqual({
      tier: PrivacyTier.TIER_1,
      label: 'visible-but-commingled',
      cryptographicallyHidden: false,
    })
  })
  it('maps TIER_2 to visible-but-unlinkable', () => {
    expect(amountHidingStatus(flow, PrivacyTier.TIER_2)).toEqual({
      tier: PrivacyTier.TIER_2,
      label: 'visible-but-unlinkable',
      cryptographicallyHidden: false,
    })
  })
  it('maps TIER_3 to cryptographically-hidden', () => {
    expect(amountHidingStatus(flow, PrivacyTier.TIER_3)).toEqual({
      tier: PrivacyTier.TIER_3,
      label: 'cryptographically-hidden',
      cryptographicallyHidden: true,
    })
  })
  it('rejects an invalid tier', () => {
    expect(() => amountHidingStatus(flow, 'tier_9' as PrivacyTier)).toThrow('tier')
  })
})

describe('factor-level derivations', () => {
  it('anonymity: 0–2 weak, 3–9 moderate, ≥10 strong', () => {
    expect(deriveAnonymityLevel(0)).toBe('weak')
    expect(deriveAnonymityLevel(2)).toBe('weak')
    expect(deriveAnonymityLevel(3)).toBe('moderate')
    expect(deriveAnonymityLevel(9)).toBe('moderate')
    expect(deriveAnonymityLevel(10)).toBe('strong')
  })
  it('linkability: gasless strong, self-paid moderate', () => {
    expect(deriveLinkabilityLevel(true)).toBe('strong')
    expect(deriveLinkabilityLevel(false)).toBe('moderate')
  })
  it('amount: cryptographically hidden strong, else weak', () => {
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_3))).toBe('strong')
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_1))).toBe('weak')
    expect(deriveAmountLevel(amountHidingStatus(flow, PrivacyTier.TIER_2))).toBe('weak')
  })
})
