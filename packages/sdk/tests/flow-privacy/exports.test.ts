import { describe, it, expect } from 'vitest'
import * as sdk from '../../src/index'
import * as flowPrivacy from '../../src/flow-privacy'

describe('flow-privacy public surface', () => {
  it('exposes the primitives from the module barrel', () => {
    expect(typeof flowPrivacy.anonSetInWindow).toBe('function')
    expect(typeof flowPrivacy.gaslessFlag).toBe('function')
    expect(typeof flowPrivacy.amountHidingStatus).toBe('function')
    expect(typeof flowPrivacy.assessFlowPrivacy).toBe('function')
  })

  it('re-exports the primitives from the main SDK entry', () => {
    expect(typeof sdk.anonSetInWindow).toBe('function')
    expect(typeof sdk.gaslessFlag).toBe('function')
    expect(typeof sdk.amountHidingStatus).toBe('function')
    expect(typeof sdk.assessFlowPrivacy).toBe('function')
  })

  it('the main-entry composer produces a complete, well-formed assessment', () => {
    const a = sdk.assessFlowPrivacy(
      { mint: '11111111111111111111111111111111', transferAmount: 5_000_000_000n, timestamp: 1_000_000, gasless: true },
      [],
    )
    // assert real values, not just property existence — a NaN/garbage result must fail here
    expect(typeof a.score).toBe('number')
    expect(a.score).toBeGreaterThanOrEqual(0)
    expect(a.score).toBeLessThanOrEqual(100)
    expect(['limited', 'moderate', 'strong']).toContain(a.band)
    expect(a.gasless).toBe(true)
    expect(['weak', 'moderate', 'strong']).toContain(a.factors.anonymity)
    expect(['weak', 'moderate', 'strong']).toContain(a.factors.linkability)
    expect(['weak', 'moderate', 'strong']).toContain(a.factors.amount)
    expect(Array.isArray(a.caveats)).toBe(true)
  })
})
