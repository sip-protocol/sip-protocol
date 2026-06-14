import { describe, it, expect, vi, afterEach } from 'vitest'
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import bs58 from 'bs58'
import {
  JitoRelayer,
  createJitoRelayer,
  JITO_TIP_ACCOUNTS,
} from '../../src/solana/jito-relayer'

// Helper: build a signed legacy transfer tx for bundle tests.
function buildSignedTransferTx(payer: Keypair): Transaction {
  const tx = new Transaction()
  tx.add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: payer.publicKey,
    lamports: 1,
  }))
  tx.recentBlockhash = '11111111111111111111111111111111'
  tx.feePayer = payer.publicKey
  tx.sign(payer)
  return tx
}

describe('JitoRelayer', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('constructor + helpers', () => {
    it('applies defaults', () => {
      const r = createJitoRelayer()
      expect(r).toBeInstanceOf(JitoRelayer)
    })

    it('getRandomTipAccount returns a known tip account', () => {
      const r = createJitoRelayer()
      const acct = r.getRandomTipAccount().toBase58()
      expect(JITO_TIP_ACCOUNTS as readonly string[]).toContain(acct)
    })
  })

  describe('isAvailable', () => {
    it('returns true on healthy block engine', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as Response))
      const r = createJitoRelayer()
      expect(await r.isAvailable()).toBe(true)
    })

    it('returns false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
      const r = createJitoRelayer()
      expect(await r.isAvailable()).toBe(false)
    })
  })

  describe('encodeSignature', () => {
    it('encodes a 64-byte signature as base58 (not hex)', () => {
      const sig = new Uint8Array(64).fill(7)
      const out = JitoRelayer.encodeSignature(sig)
      expect(out).toBe(bs58.encode(sig))
      // a hex encoding of 64 bytes would be 128 chars all in [0-9a-f]; base58 includes uppercase
      expect(out).not.toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('submitBundle', () => {
    it('submits a tip + user tx and reports a base58 bundle result', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'bundle-123' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const tipPayer = Keypair.generate()
      const r = new JitoRelayer({
        blockEngineUrl: 'https://x.test/api/v1',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
      })
      // @ts-expect-error override private connection for the test
      r.connection = {
        getLatestBlockhash: async () => ({
          blockhash: '11111111111111111111111111111111',
          lastValidBlockHeight: 100,
        }),
      }

      const userTx = buildSignedTransferTx(tipPayer)
      const res = await r.submitBundle({ transactions: [userTx], tipPayer })

      expect(res.bundleId).toBe('bundle-123')
      expect(res.status).toBe('submitted')
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  describe('relayTransaction', () => {
    it('routes through submitBundle when tipPayer is provided', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'bundle-xyz' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const tipPayer = Keypair.generate()
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = {
        getLatestBlockhash: async () => ({
          blockhash: '11111111111111111111111111111111',
          lastValidBlockHeight: 100,
        }),
      }

      const userTx = buildSignedTransferTx(tipPayer)
      const result = await r.relayTransaction({ transaction: userTx, tipPayer })

      expect(result.relayed).toBe(true)
      expect(result.bundleId).toBe('bundle-xyz')
      expect(result.status).toBe('submitted')
      // user tx is the LAST entry in the bundle; signature must be base58
      expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
      expect(fetchMock).toHaveBeenCalled()
    })
  })
})
