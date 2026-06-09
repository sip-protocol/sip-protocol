import { describe, it, expect } from 'vitest'
import * as sdk from '../src'

// Guards the public package entry (src/index.ts). The canonical SIP memo-prefix
// constants are defined in chains/solana/constants.ts and re-exported from the
// chains/solana sub-barrel, but SIP_MEMO_PREFIX_V2 / SIP_MEMO_PREFIX_ANY were
// never re-exported from the package root — so ESM/TS consumers couldn't import
// them (sip-protocol#1123). A namespace import keeps a missing export a clean
// `undefined` assertion failure rather than a module-resolution error.
describe('public SIP memo-prefix exports', () => {
  it('re-exports SIP_MEMO_PREFIX (legacy, SIP:1)', () => {
    expect(sdk.SIP_MEMO_PREFIX).toBe('SIP:1:')
  })

  it('re-exports SIP_MEMO_PREFIX_V2 (canonical, SIP:2)', () => {
    expect(sdk.SIP_MEMO_PREFIX_V2).toBe('SIP:2:')
  })

  it('re-exports SIP_MEMO_PREFIX_ANY (version-agnostic prefix)', () => {
    expect(sdk.SIP_MEMO_PREFIX_ANY).toBe('SIP:')
  })
})
