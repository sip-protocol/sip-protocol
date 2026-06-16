/**
 * Solana Constants Tests
 *
 * Focused coverage for the shared helpers consolidated into constants.ts.
 */

import { describe, it, expect } from 'vitest'
import { detectCluster, getExplorerUrl } from '../../../src/chains/solana/constants'

describe('detectCluster', () => {
  it('maps a devnet URL to devnet', () => {
    expect(detectCluster('https://api.devnet.solana.com')).toBe('devnet')
  })

  it('maps a testnet URL to testnet', () => {
    expect(detectCluster('https://api.testnet.solana.com')).toBe('testnet')
  })

  it('maps a localhost URL to localnet', () => {
    expect(detectCluster('http://localhost:8899')).toBe('localnet')
  })

  it('maps a 127.0.0.1 URL to localnet', () => {
    expect(detectCluster('http://127.0.0.1:8899')).toBe('localnet')
  })

  it('defaults a mainnet (or unrecognized) URL to mainnet-beta', () => {
    expect(detectCluster('https://api.mainnet-beta.solana.com')).toBe('mainnet-beta')
  })

  it('defaults an unknown host to mainnet-beta', () => {
    expect(detectCluster('https://my-rpc.example.com')).toBe('mainnet-beta')
  })

  it('feeds the detected cluster into getExplorerUrl (devnet adds the cluster query)', () => {
    const cluster = detectCluster('https://api.devnet.solana.com')
    expect(getExplorerUrl('abc123', cluster)).toContain('cluster=devnet')
  })
})
