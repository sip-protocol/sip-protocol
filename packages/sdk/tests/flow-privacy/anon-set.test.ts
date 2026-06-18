import { describe, it, expect } from 'vitest'
import { anonSetInWindow } from '../../src/flow-privacy/anon-set'
import type { FlowInput, WindowWithdrawal } from '../../src/flow-privacy/types'

const SOL = '11111111111111111111111111111111'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

const flow: FlowInput = {
  mint: SOL,
  transferAmount: 5_000_000_000n, // 5 SOL
  timestamp: 1_000_000,
  gasless: true,
  signature: 'SELF',
}

function w(over: Partial<WindowWithdrawal>): WindowWithdrawal {
  return { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000, signature: 'x', ...over }
}

describe('anonSetInWindow', () => {
  it('returns size 0 with no candidates', () => {
    const set = anonSetInWindow(flow, [])
    expect(set.size).toBe(0)
    expect(set.sameMintCount).toBe(0)
    expect(set.windowSeconds).toBe(600)
    expect(set.amountToleranceRatio).toBe(0.5)
    expect(set.matched).toEqual([])
  })

  it('counts only same-mint withdrawals (USDC does not hide SOL)', () => {
    const set = anonSetInWindow(flow, [
      w({ signature: 'a' }),
      w({ mint: USDC, signature: 'b' }),
    ])
    expect(set.sameMintCount).toBe(1)
    expect(set.size).toBe(1)
    expect(set.matched).toEqual(['a'])
  })

  it('excludes candidates outside the time window', () => {
    const inWin = w({ timestamp: 1_000_000 + 600, signature: 'in' })
    const outWin = w({ timestamp: 1_000_000 + 601, signature: 'out' })
    const set = anonSetInWindow(flow, [inWin, outWin])
    expect(set.size).toBe(1)
    expect(set.matched).toEqual(['in'])
  })

  it('applies the amount bucket: [2.5, 10] SOL at tolerance 0.5 for a 5 SOL flow', () => {
    const set = anonSetInWindow(flow, [
      w({ transferAmount: 2_500_000_000n, signature: 'half' }),   // in (== 1 - tol)
      w({ transferAmount: 2_499_999_999n, signature: 'dust' }),   // out
      w({ transferAmount: 10_000_000_000n, signature: 'double' }), // in (flow is half of it)
      w({ transferAmount: 11_000_000_000n, signature: 'whale' }), // out
    ])
    expect(set.sameMintCount).toBe(4)
    expect(set.size).toBe(2)
    expect(set.matched.sort()).toEqual(['double', 'half'])
  })

  it('excludes self by signature, then by exact (mint, amount, timestamp) triple', () => {
    const bySig = anonSetInWindow(flow, [w({ signature: 'SELF' })])
    expect(bySig.size).toBe(0)
    const flowNoSig: FlowInput = { ...flow, signature: undefined }
    const byTriple = anonSetInWindow(flowNoSig, [
      { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000 }, // self triple, no sig
      w({ signature: 'other' }),
    ])
    expect(byTriple.size).toBe(1)
    expect(byTriple.matched).toEqual(['other'])
  })

  it('excludes the flow own un-signed copy even when the flow has a signature', () => {
    // flow.signature is 'SELF'; its own withdrawal appears in candidates WITHOUT a
    // signature (e.g. indexed before the field was populated). It must be excluded,
    // not counted as a peer — counting it would overstate the anonymity set.
    const set = anonSetInWindow(flow, [
      { mint: SOL, transferAmount: 5_000_000_000n, timestamp: 1_000_000 }, // self, no sig
      w({ signature: 'peer' }),
    ])
    expect(set.size).toBe(1)
    expect(set.matched).toEqual(['peer'])
  })

  it('honors custom window and tolerance', () => {
    const set = anonSetInWindow(flow, [w({ timestamp: 1_000_300, signature: 'c' })], {
      windowSeconds: 120,
      amountToleranceRatio: 1,
    })
    expect(set.size).toBe(0) // 300s > 120s window
    expect(set.windowSeconds).toBe(120)
    expect(set.amountToleranceRatio).toBe(1)
  })

  it('throws ValidationError on bad input', () => {
    expect(() => anonSetInWindow({ ...flow, mint: '' }, [])).toThrow('flow.mint')
    expect(() => anonSetInWindow({ ...flow, transferAmount: -1n }, [])).toThrow('flow.transferAmount')
    expect(() => anonSetInWindow(flow, [], { windowSeconds: 0 })).toThrow('windowSeconds')
    expect(() => anonSetInWindow(flow, [], { amountToleranceRatio: 1.5 })).toThrow('amountToleranceRatio')
    expect(() => anonSetInWindow({ ...flow, timestamp: 1.5 }, [])).toThrow('flow.timestamp')
  })
})
