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

  it('the main-entry composer produces a complete assessment', () => {
    const a = sdk.assessFlowPrivacy(
      { mint: '11111111111111111111111111111111', transferAmount: 5_000_000_000n, timestamp: 1_000_000, gasless: true },
      [],
    )
    expect(a).toHaveProperty('score')
    expect(a).toHaveProperty('band')
    expect(a).toHaveProperty('factors')
    expect(a).toHaveProperty('caveats')
  })
})
