import { describe, it, expect, vi, afterEach } from 'vitest'
import { Keypair, Transaction, SystemProgram } from '@solana/web3.js'
import {
  JitoRelayer,
  createJitoRelayer,
  JITO_TIP_ACCOUNTS,
} from '../../src/solana/jito-relayer'

// Base58 of a 64-byte signature filled with 0x07 — captured from the historical
// bs58.encode output so the in-repo encoder is proven byte-identical to it.
const SIG_ALL_SEVENS_BASE58 =
  '99eUso3aSbE9tqGSTXzo3TLfKb9RkMTURrHKQ1K7Zh3BbeqPevr5E1iCbpTjqHuTFLtfxTTD5ekfVuZFzQyEQf8'

// Helper: build a signed legacy transfer tx for bundle tests.
function buildSignedTransferTx(
  payer: Keypair,
  opts?: { recentBlockhash?: string; lastValidBlockHeight?: number }
): Transaction {
  const tx = new Transaction()
  tx.add(SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: payer.publicKey,
    lamports: 1,
  }))
  tx.recentBlockhash = opts?.recentBlockhash ?? '11111111111111111111111111111111'
  if (opts?.lastValidBlockHeight !== undefined) {
    // Mirror how the SDK tags legacy cash-out txs with their valid-block window.
    ;(tx as Transaction & { lastValidBlockHeight?: number }).lastValidBlockHeight =
      opts.lastValidBlockHeight
  }
  tx.feePayer = payer.publicKey
  tx.sign(payer)
  return tx
}

// Valid 32-byte base58 blockhashes (a tx must serialize/sign with these, so the
// strings have to decode to 32 bytes). Distinct values so we can prove which one
// the relayer actually adopts.
const USER_TX_BLOCKHASH = '8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR'
const FRESH_BLOCKHASH = 'cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN'
const OWN_TX_BLOCKHASH = 'LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY'

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
      expect(out).toBe(SIG_ALL_SEVENS_BASE58)
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

    // J6: a tip-less bundle is never included by the block engine. The no-tipPayer
    // path must NOT fabricate a 'submitted' bundle — it must fail loud inside the
    // try and fall back to honest direct submission (relayed:false), with no
    // /bundles call made.
    it('does NOT submit a tip-less bundle; falls back to direct submission (J6)', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'should-not-be-used' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const payer = Keypair.generate()
      const sendRaw = vi.fn(async () => 'directSig111')
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = {
        sendRawTransaction: sendRaw,
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      }

      const userTx = buildSignedTransferTx(payer)
      const result = await r.relayTransaction({ transaction: userTx /* no tipPayer */ })

      // Honest direct submission, not a doomed bundle.
      expect(result.relayed).toBe(false)
      expect(result.signature).toBe('directSig111')
      expect(sendRaw).toHaveBeenCalledTimes(1)
      // No Jito bundle endpoint should ever be hit on the tip-less path.
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // J3 + J4: the prepended tip tx and the confirmation window must ADOPT the
  // cash-out (user) tx's blockhash window — the relayer cannot re-sign the
  // cash-out tx, so a fresh blockhash would orphan it.
  describe('blockhash window reconciliation (J3/J4)', () => {
    it('tip tx adopts the user tx blockhash; no fresh getLatestBlockhash (J3)', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'bundle-j3' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const tipPayer = Keypair.generate()
      const getLatestBlockhash = vi.fn(async () => ({
        blockhash: FRESH_BLOCKHASH,
        lastValidBlockHeight: 999999,
      }))
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = { getLatestBlockhash }

      const userTx = buildSignedTransferTx(tipPayer, {
        recentBlockhash: USER_TX_BLOCKHASH,
        lastValidBlockHeight: 1000,
      })

      // Spy on the private prep step to capture the prepared tip tx.
      const prepSpy = vi.spyOn(
        r as unknown as {
          prepareBundleTransactions: JitoRelayer['prepareBundleTransactions']
        },
        'prepareBundleTransactions'
      )

      await r.submitBundle({ transactions: [userTx], tipPayer })

      // No fresh blockhash fetched — the user tx already carries a window.
      expect(getLatestBlockhash).not.toHaveBeenCalled()
      // The blockhash threaded into prepareBundleTransactions is the user tx's.
      const blockhashArg = prepSpy.mock.calls[0][3]
      expect(blockhashArg).toBe(USER_TX_BLOCKHASH)
      // And the actually-prepared tip tx carries that same blockhash (not fresh).
      const prepared = await prepSpy.mock.results[0].value
      const tipTx = prepared[0] as Transaction
      expect(tipTx.recentBlockhash).toBe(USER_TX_BLOCKHASH)
    })

    it('confirmation expiry is judged against the user tx lastValidBlockHeight (J4)', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'bundle-j4' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const tipPayer = Keypair.generate()
      const getBlockHeight = vi.fn(async () => 1001) // strictly > user tx's 1000 → expired
      const getLatestBlockhash = vi.fn(async () => ({
        blockhash: FRESH_BLOCKHASH,
        lastValidBlockHeight: 999999, // a fresh window would NOT be expired
      }))
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = { getLatestBlockhash, getBlockHeight }

      const userTx = buildSignedTransferTx(tipPayer, {
        recentBlockhash: USER_TX_BLOCKHASH,
        lastValidBlockHeight: 1000,
      })

      const res = await r.submitBundle({
        transactions: [userTx],
        tipPayer,
        waitForConfirmation: true,
      })

      // The user tx's window (1000) drives expiry — a fresh window (999999) would not.
      expect(res.status).toBe('failed')
      expect(res.error).toMatch(/expired/i)
      expect(getLatestBlockhash).not.toHaveBeenCalled()
    })

    it('falls back to a fresh blockhash when the user tx carries no window', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ result: 'bundle-fallback' }),
      }) as unknown as Response)
      vi.stubGlobal('fetch', fetchMock)

      const tipPayer = Keypair.generate()
      const getLatestBlockhash = vi.fn(async () => ({
        blockhash: FRESH_BLOCKHASH,
        lastValidBlockHeight: 100,
      }))
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = { getLatestBlockhash }

      // No lastValidBlockHeight on this tx → extractBlockhashContext returns null.
      const userTx = buildSignedTransferTx(tipPayer)
      const prepSpy = vi.spyOn(
        r as unknown as {
          prepareBundleTransactions: JitoRelayer['prepareBundleTransactions']
        },
        'prepareBundleTransactions'
      )

      await r.submitBundle({ transactions: [userTx], tipPayer })

      expect(getLatestBlockhash).toHaveBeenCalledTimes(1)
      const prepared = await prepSpy.mock.results[0].value
      const tipTx = prepared[0] as Transaction
      expect(tipTx.recentBlockhash).toBe(FRESH_BLOCKHASH)
    })
  })

  // J7: directSubmit must confirm against the SENT tx's own blockhash window,
  // not a freshly-fetched one (which could misreport confirmation).
  describe('directSubmit confirmation window (J7)', () => {
    it('confirms against the tx own blockhash, not a fresh fetch (J7)', async () => {
      // Force the bundle path to throw so relayTransaction falls into directSubmit,
      // while keeping waitForConfirmation:true to exercise the confirm call.
      const tipPayer = Keypair.generate()
      const confirmTransaction = vi.fn(async () => ({ value: { err: null } }))
      const sendRawTransaction = vi.fn(async () => 'ownSig111')
      const getLatestBlockhash = vi.fn(async () => ({
        blockhash: FRESH_BLOCKHASH,
        lastValidBlockHeight: 777777,
      }))
      const r = new JitoRelayer({ blockEngineUrl: 'https://x.test/api/v1' })
      // @ts-expect-error override private connection for the test
      r.connection = {
        sendRawTransaction,
        confirmTransaction,
        getLatestBlockhash,
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      }
      // Force the relayer bundle path to fail → fallback to directSubmit.
      vi.spyOn(
        r as unknown as { submitBundle: JitoRelayer['submitBundle'] },
        'submitBundle'
      ).mockRejectedValue(new Error('relayer down'))

      const userTx = buildSignedTransferTx(tipPayer, {
        recentBlockhash: OWN_TX_BLOCKHASH,
        lastValidBlockHeight: 500,
      })

      const result = await r.relayTransaction({
        transaction: userTx,
        tipPayer,
        waitForConfirmation: true,
      })

      expect(result.relayed).toBe(false)
      expect(result.status).toBe('confirmed')
      expect(result.signature).toBe('ownSig111')
      // Confirmed against the tx's OWN window, not a fresh one.
      expect(confirmTransaction).toHaveBeenCalledWith(
        { signature: 'ownSig111', blockhash: OWN_TX_BLOCKHASH, lastValidBlockHeight: 500 },
        'confirmed'
      )
      expect(getLatestBlockhash).not.toHaveBeenCalled()
    })
  })

  // D2: encodeSignature must be byte-identical to the old bs58.encode after the
  // swap to the in-repo bytesToBase58 encoder.
  describe('encodeSignature byte-vector (D2)', () => {
    it('matches a fixed known base58 vector', () => {
      // Deterministic 64-byte input: bytes 0..63.
      const sig = new Uint8Array(64)
      for (let i = 0; i < 64; i++) sig[i] = i
      const out = JitoRelayer.encodeSignature(sig)
      // Hard-coded expectation (base58 of bytes 0x00..0x3f) captured from the
      // historical bs58.encode output — proving the in-repo encoder is byte-identical.
      const expected =
        '1GMkH3brNXiNNs1tiFZHu4yZSRrzJwxi5wB9bHFtMinfCXNnR1adh8Vo8NTheK4evneedH4qmvjeqcBBNAefgS'
      expect(out).toBe(expected)
      // Leading zero byte must map to a single '1' prefix (base58 leading-zero rule).
      expect(out.startsWith('1')).toBe(true)
    })
  })
})
