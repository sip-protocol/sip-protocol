import { describe, it, expect } from 'vitest'
import * as sdk from '../../src/index'
import * as fees from '../../src/fees'

describe('privacy-tier fee public exports', () => {
  it('exposes the privacy-tier fee surface from the package root', () => {
    expect(typeof sdk.getPrivacyTierFee).toBe('function')
    expect(typeof sdk.getPrivacyTierFeeBps).toBe('function')
    expect(typeof sdk.getCurrentPrivacyTierFee).toBe('function')
    expect(typeof sdk.getPrivacyTierSchedule).toBe('function')
    expect(typeof sdk.computePrivacyTierFee).toBe('function')
    expect(sdk.PrivacyTier.TIER_1).toBe('tier_1')
    expect(sdk.CURRENT_PRIVACY_TIER).toBe(sdk.PrivacyTier.TIER_1)
  })

  it('exposes the same surface from the fees barrel module', () => {
    expect(typeof fees.getPrivacyTierFee).toBe('function')
    expect(typeof fees.computePrivacyTierFee).toBe('function')
    expect(fees.PrivacyTier.TIER_2).toBe('tier_2')
  })
})
