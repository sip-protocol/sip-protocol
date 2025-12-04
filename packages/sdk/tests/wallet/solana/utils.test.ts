/**
 * Tests for Solana wallet utilities
 */

import { describe, it, expect } from 'vitest'
import {
  base58ToHex,
  createMockSolanaProvider,
  createMockSolanaConnection,
} from '../../../src/wallet'

describe('base58ToHex', () => {
  it('should convert base58 to hex', () => {
    // Simple test - "1" in base58 is 0x00
    const hex = base58ToHex('11')
    expect(hex).toMatch(/^0x[0-9a-f]+$/)
  })

  it('should handle typical Solana address', () => {
    // A short test address
    const hex = base58ToHex('So11111111111111111111111111111111111111112')
    expect(hex).toMatch(/^0x[0-9a-f]+$/)
  })

  it('should throw for invalid characters', () => {
    expect(() => base58ToHex('0OIl')).toThrow(/Invalid base58 character/)
  })
})

describe('createMockSolanaProvider', () => {
  it('should create provider with default config', () => {
    const provider = createMockSolanaProvider()
    expect(provider.isPhantom).toBe(true)
    expect(provider.isConnected).toBe(false)
    expect(provider.publicKey).toBeNull()
  })

  it('should connect successfully', async () => {
    const provider = createMockSolanaProvider()
    const { publicKey } = await provider.connect()

    expect(publicKey).toBeDefined()
    expect(publicKey.toBase58()).toBe('MockSo1anaWa11etAddress123456789')
    expect(provider.isConnected).toBe(true)
  })

  it('should disconnect', async () => {
    const provider = createMockSolanaProvider()
    await provider.connect()
    await provider.disconnect()

    expect(provider.isConnected).toBe(false)
    expect(provider.publicKey).toBeNull()
  })

  it('should sign message', async () => {
    const provider = createMockSolanaProvider()
    await provider.connect()

    const message = new Uint8Array([1, 2, 3, 4, 5])
    const { signature } = await provider.signMessage(message)

    expect(signature).toBeInstanceOf(Uint8Array)
    expect(signature.length).toBe(64)
  })

  it('should sign transaction', async () => {
    const provider = createMockSolanaProvider()
    await provider.connect()

    const tx = { serialize: () => new Uint8Array([1, 2, 3]) } as any as unknown as object
    const signed = await provider.signTransaction(tx)

    expect(signed).toBe(tx)
  })

  it('should sign all transactions', async () => {
    const provider = createMockSolanaProvider()
    await provider.connect()

    const txs = [
      { serialize: () => new Uint8Array([1]) },
      { serialize: () => new Uint8Array([2]) },
    ] as any

    const signed = await provider.signAllTransactions(txs)
    expect(signed).toHaveLength(2)
  })

  it('should sign and send transaction', async () => {
    const provider = createMockSolanaProvider()
    await provider.connect()

    const tx = { serialize: () => new Uint8Array([1, 2, 3]) } as any as unknown as object
    const { signature } = await provider.signAndSendTransaction(tx)

    expect(signature).toContain('mock_signature_')
  })

  it('should fail connect when configured', async () => {
    const provider = createMockSolanaProvider({ shouldFailConnect: true })

    await expect(provider.connect()).rejects.toThrow(/rejected/)
  })

  it('should fail sign when configured', async () => {
    const provider = createMockSolanaProvider({ shouldFailSign: true })
    await provider.connect()

    await expect(provider.signMessage(new Uint8Array([1]))).rejects.toThrow(
      /rejected/
    )
  })

  it('should fail transaction when configured', async () => {
    const provider = createMockSolanaProvider({ shouldFailTransaction: true })
    await provider.connect()

    const tx = { serialize: () => new Uint8Array([1]) } as any as unknown as object
    await expect(provider.signAndSendTransaction(tx)).rejects.toThrow(/failed/)
  })

  it('should handle events', async () => {
    const provider = createMockSolanaProvider()
    let connectCalled = false

    provider.on('connect', () => {
      connectCalled = true
    })

    await provider.connect()
    expect(connectCalled).toBe(true)
  })
})

describe('createMockSolanaConnection', () => {
  it('should create connection with default config', () => {
    const connection = createMockSolanaConnection()
    expect(connection).toBeDefined()
  })

  it('should return balance', async () => {
    const connection = createMockSolanaConnection({
      balance: 3_000_000_000n,
    })

    const balance = await connection.getBalance({
      toBase58: () => 'test',
      toBytes: () => new Uint8Array(32),
      toString: () => 'test',
    })

    expect(balance).toBe(3_000_000_000)
  })

  it('should return token balance', async () => {
    const mintAddress = 'TestMint123'
    const connection = createMockSolanaConnection({
      tokenBalances: {
        [mintAddress]: 500_000_000n,
      },
    })

    const result = await connection.getTokenAccountBalance({
      toBase58: () => mintAddress,
      toBytes: () => new Uint8Array(32),
      toString: () => mintAddress,
    })

    expect(result.value.amount).toBe('500000000')
  })

  it('should return blockhash', async () => {
    const connection = createMockSolanaConnection()
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

    expect(blockhash).toContain('mock_blockhash_')
    expect(lastValidBlockHeight).toBe(12345678)
  })

  it('should send raw transaction', async () => {
    const connection = createMockSolanaConnection()
    const signature = await connection.sendRawTransaction(new Uint8Array([1, 2, 3]))

    expect(signature).toContain('mock_signature_')
  })

  it('should fail send when configured', async () => {
    const connection = createMockSolanaConnection({
      shouldFailTransaction: true,
    })

    await expect(
      connection.sendRawTransaction(new Uint8Array([1]))
    ).rejects.toThrow(/failed/)
  })

  it('should confirm transaction', async () => {
    const connection = createMockSolanaConnection()
    const result = await connection.confirmTransaction('test_sig')

    expect(result.value.err).toBeNull()
  })
})
