/**
 * Mock Solana RPC Response Fixtures
 *
 * Provides deterministic mock responses for Solana RPC calls.
 * Used for testing without requiring network access.
 */

import type { HexString } from '@sip-protocol/types'

// ── Account Info Responses ─────────────────────────────────────────────────

export interface MockAccountInfo {
  lamports: number
  owner: string
  data: string | Buffer
  executable: boolean
  rentEpoch: number
}

export const mockAccountInfoResponses = {
  /** Empty account (not found) */
  notFound: null,

  /** System account with 1 SOL */
  systemAccount: {
    lamports: 1_000_000_000,
    owner: '11111111111111111111111111111111',
    data: Buffer.alloc(0),
    executable: false,
    rentEpoch: 0,
  } satisfies MockAccountInfo,

  /** Token account with balance */
  tokenAccount: {
    lamports: 2_039_280, // Rent-exempt minimum
    owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    data: Buffer.from(
      // SPL Token account data (165 bytes)
      '0'.repeat(330),
      'hex'
    ),
    executable: false,
    rentEpoch: 0,
  } satisfies MockAccountInfo,

  /** Stealth meta-address account */
  stealthMetaAddress: {
    lamports: 1_461_600, // Rent for ~128 bytes
    owner: 'SipPr1vacyProgram11111111111111111111111111',
    data: Buffer.from(
      JSON.stringify({
        spendingPubKey: '0x02' + 'a'.repeat(64),
        viewingPubKey: '0x02' + 'b'.repeat(64),
      })
    ),
    executable: false,
    rentEpoch: 0,
  } satisfies MockAccountInfo,
}

// ── Transaction Responses ──────────────────────────────────────────────────

export interface MockTransactionMeta {
  err: null | { InstructionError: [number, string] }
  fee: number
  preBalances: number[]
  postBalances: number[]
  preTokenBalances: Array<{
    accountIndex: number
    mint: string
    uiTokenAmount: { amount: string; decimals: number }
  }>
  postTokenBalances: Array<{
    accountIndex: number
    mint: string
    uiTokenAmount: { amount: string; decimals: number }
  }>
  logMessages: string[]
}

export interface MockParsedTransaction {
  slot: number
  blockTime: number
  meta: MockTransactionMeta
  transaction: {
    message: {
      accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean }>
      instructions: Array<{
        programId: string
        accounts: string[]
        data: string
      }>
    }
    signatures: string[]
  }
}

export const mockTransactionResponses = {
  /** Successful SOL transfer */
  solTransferSuccess: {
    slot: 123456789,
    blockTime: Math.floor(Date.now() / 1000),
    meta: {
      err: null,
      fee: 5000,
      preBalances: [1_000_000_000, 0],
      postBalances: [999_995_000, 100_000_000],
      preTokenBalances: [],
      postTokenBalances: [],
      logMessages: [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program 11111111111111111111111111111111 success',
      ],
    },
    transaction: {
      message: {
        accountKeys: [
          { pubkey: 'SenderPubkey111111111111111111111111111111', signer: true, writable: true },
          { pubkey: 'ReceiverPubkey11111111111111111111111111111', signer: false, writable: true },
        ],
        instructions: [
          {
            programId: '11111111111111111111111111111111',
            accounts: ['SenderPubkey111111111111111111111111111111', 'ReceiverPubkey11111111111111111111111111111'],
            data: 'base58EncodedTransferData',
          },
        ],
      },
      signatures: ['5wHu1qwD7q2oogLvRWFsHHYW9MVH9qcCRHaKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK'],
    },
  } satisfies MockParsedTransaction,

  /** Successful SPL token transfer */
  splTransferSuccess: {
    slot: 123456790,
    blockTime: Math.floor(Date.now() / 1000),
    meta: {
      err: null,
      fee: 5000,
      preBalances: [1_000_000_000, 2_039_280, 2_039_280],
      postBalances: [999_995_000, 2_039_280, 2_039_280],
      preTokenBalances: [
        { accountIndex: 1, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '1000000000', decimals: 6 } },
        { accountIndex: 2, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '0', decimals: 6 } },
      ],
      postTokenBalances: [
        { accountIndex: 1, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '900000000', decimals: 6 } },
        { accountIndex: 2, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { amount: '100000000', decimals: 6 } },
      ],
      logMessages: [
        'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]',
        'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success',
      ],
    },
    transaction: {
      message: {
        accountKeys: [
          { pubkey: 'SenderPubkey111111111111111111111111111111', signer: true, writable: true },
          { pubkey: 'SenderTokenAccount1111111111111111111111111', signer: false, writable: true },
          { pubkey: 'ReceiverTokenAccount111111111111111111111111', signer: false, writable: true },
        ],
        instructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            accounts: ['SenderTokenAccount1111111111111111111111111', 'ReceiverTokenAccount111111111111111111111111', 'SenderPubkey111111111111111111111111111111'],
            data: 'base58EncodedTransferData',
          },
        ],
      },
      signatures: ['6xIu2rqD8r3ppgMwRXGsIIZYX0NWI0ICsIBLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL'],
    },
  } satisfies MockParsedTransaction,

  /** Failed transaction (insufficient funds) */
  insufficientFunds: {
    slot: 123456791,
    blockTime: Math.floor(Date.now() / 1000),
    meta: {
      err: { InstructionError: [0, 'InsufficientFunds'] },
      fee: 5000,
      preBalances: [10000, 0],
      postBalances: [5000, 0],
      preTokenBalances: [],
      postTokenBalances: [],
      logMessages: [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program 11111111111111111111111111111111 failed: insufficient lamports',
      ],
    },
    transaction: {
      message: {
        accountKeys: [
          { pubkey: 'SenderPubkey111111111111111111111111111111', signer: true, writable: true },
          { pubkey: 'ReceiverPubkey11111111111111111111111111111', signer: false, writable: true },
        ],
        instructions: [
          {
            programId: '11111111111111111111111111111111',
            accounts: ['SenderPubkey111111111111111111111111111111', 'ReceiverPubkey11111111111111111111111111111'],
            data: 'base58EncodedTransferData',
          },
        ],
      },
      signatures: ['7yJv3srE9s4qqhNxSYHtJJZZZ1OXJ1JDtJCMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'],
    },
  } satisfies MockParsedTransaction,
}

// ── Signature Responses ────────────────────────────────────────────────────

export interface MockSignatureInfo {
  signature: string
  slot: number
  blockTime: number | null
  err: null | { InstructionError: [number, string] }
  memo: string | null
}

export const mockSignatureResponses = {
  /** Recent signatures for an account */
  recentSignatures: [
    {
      signature: '5wHu1qwD7q2oogLvRWFsHHYW9MVH9qcCRHaKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      slot: 123456789,
      blockTime: Math.floor(Date.now() / 1000) - 60,
      err: null,
      memo: null,
    },
    {
      signature: '6xIu2rqD8r3ppgMwRXGsIIZYX0NWI0ICsIBLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
      slot: 123456780,
      blockTime: Math.floor(Date.now() / 1000) - 120,
      err: null,
      memo: null,
    },
    {
      signature: '7yJv3srE9s4qqhNxSYHtJJZZZ1OXJ1JDtJCMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      slot: 123456770,
      blockTime: Math.floor(Date.now() / 1000) - 180,
      err: { InstructionError: [0, 'InsufficientFunds'] },
      memo: null,
    },
  ] satisfies MockSignatureInfo[],

  /** Empty signatures (new account) */
  emptySignatures: [] as MockSignatureInfo[],
}

// ── Block Responses ────────────────────────────────────────────────────────

export const mockBlockResponses = {
  latestBlockhash: {
    blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
    lastValidBlockHeight: 150_000_000,
  },

  recentBlockhash: {
    blockhash: 'FvGhWchKPPVnLpGVkrZKGsXVUqJfvhYACSoNQc3MYTwA',
    feeCalculator: { lamportsPerSignature: 5000 },
  },
}

// ── Stealth-Specific Responses ─────────────────────────────────────────────

export interface MockStealthPaymentInfo {
  ephemeralPubKey: HexString
  stealthAddress: string
  encryptedMemo: HexString
  commitment: HexString
  viewingKeyHash: HexString
}

export const mockStealthResponses = {
  /** Stealth payment detection data */
  stealthPayment: {
    ephemeralPubKey: '0x02' + 'c'.repeat(64) as HexString,
    stealthAddress: 'StealthAddr1111111111111111111111111111111111',
    encryptedMemo: '0x' + 'd'.repeat(128) as HexString,
    commitment: '0x' + 'e'.repeat(64) as HexString,
    viewingKeyHash: '0x' + 'f'.repeat(64) as HexString,
  } satisfies MockStealthPaymentInfo,

  /** Multiple stealth payments for scanning */
  stealthPayments: [
    {
      ephemeralPubKey: '0x02' + 'c1'.repeat(32) as HexString,
      stealthAddress: 'StealthAddr1111111111111111111111111111111111',
      encryptedMemo: '0x' + 'd1'.repeat(64) as HexString,
      commitment: '0x' + 'e1'.repeat(32) as HexString,
      viewingKeyHash: '0x' + 'f1'.repeat(32) as HexString,
    },
    {
      ephemeralPubKey: '0x02' + 'c2'.repeat(32) as HexString,
      stealthAddress: 'StealthAddr2222222222222222222222222222222222',
      encryptedMemo: '0x' + 'd2'.repeat(64) as HexString,
      commitment: '0x' + 'e2'.repeat(32) as HexString,
      viewingKeyHash: '0x' + 'f2'.repeat(32) as HexString,
    },
  ] satisfies MockStealthPaymentInfo[],
}

// ── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create a mock RPC response handler
 */
export function createMockRpcHandler() {
  const responses = new Map<string, unknown>()

  return {
    /** Set response for a method */
    setResponse(method: string, response: unknown) {
      responses.set(method, response)
    },

    /** Get response for a method */
    getResponse<T>(method: string): T | undefined {
      return responses.get(method) as T | undefined
    },

    /** Handle RPC call */
    async handle(method: string, _params?: unknown[]): Promise<unknown> {
      if (responses.has(method)) {
        return responses.get(method)
      }

      // Default responses
      switch (method) {
        case 'getLatestBlockhash':
          return mockBlockResponses.latestBlockhash
        case 'getRecentBlockhash':
          return mockBlockResponses.recentBlockhash
        case 'getAccountInfo':
          return mockAccountInfoResponses.systemAccount
        case 'getBalance':
          return { value: 1_000_000_000 }
        case 'sendTransaction':
          return '5wHu1qwD7q2oogLvRWFsHHYW9MVH9qcCRHaKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK'
        case 'confirmTransaction':
          return { value: { err: null } }
        default:
          throw new Error(`Unhandled RPC method: ${method}`)
      }
    },

    /** Reset all custom responses */
    reset() {
      responses.clear()
    },
  }
}

/**
 * Create mock Connection-like object
 */
export function createMockConnection(rpcHandler = createMockRpcHandler()) {
  return {
    rpcEndpoint: 'https://mock.solana.com',

    async getLatestBlockhash() {
      return rpcHandler.handle('getLatestBlockhash') as Promise<typeof mockBlockResponses.latestBlockhash>
    },

    async getBalance(publicKey: { toBase58(): string }) {
      const result = await rpcHandler.handle('getBalance', [publicKey.toBase58()]) as { value: number }
      return result.value
    },

    async getAccountInfo(publicKey: { toBase58(): string }) {
      return rpcHandler.handle('getAccountInfo', [publicKey.toBase58()])
    },

    async getSignaturesForAddress(address: { toBase58(): string }, options?: { limit?: number }) {
      const sigs = mockSignatureResponses.recentSignatures
      return options?.limit ? sigs.slice(0, options.limit) : sigs
    },

    async getParsedTransaction(signature: string) {
      return rpcHandler.handle('getParsedTransaction', [signature]) ?? mockTransactionResponses.solTransferSuccess
    },

    async sendRawTransaction(rawTransaction: Uint8Array | Buffer) {
      return rpcHandler.handle('sendTransaction', [rawTransaction])
    },

    async confirmTransaction(signature: string) {
      return rpcHandler.handle('confirmTransaction', [signature])
    },

    _rpcHandler: rpcHandler,
  }
}
