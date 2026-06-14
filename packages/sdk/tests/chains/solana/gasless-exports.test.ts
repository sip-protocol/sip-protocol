import { describe, it, expect } from 'vitest'
import * as sdk from '../../../src/index'

describe('gasless cash-out public exports', () => {
  it('exposes the gasless cash-out surface from the package root', () => {
    expect(typeof sdk.buildGaslessCashout).toBe('function')
    expect(typeof sdk.submitGaslessCashout).toBe('function')
    expect(typeof sdk.computeRelayerFee).toBe('function')
    expect(typeof sdk.deriveStealthSigner).toBe('function')
    expect(typeof sdk.signEd25519WithScalar).toBe('function')
  })
})
