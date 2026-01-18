/**
 * Fixture Validation Tests
 *
 * Ensures all fixtures are correctly structured and usable.
 */

import { describe, it, expect } from 'vitest'
import {
  // Keypairs
  aliceKeypair,
  bobKeypair,
  charlieKeypair,
  auditorKeypair,
  solverKeypair,
  ephemeralKeypairs,
  generateTestKeypairs,
  generateStealthKeypairs,
  getPrivateKeyBytes,
  getPublicKeyBytes,
  signWithKeypair,
  verifyWithKeypair,
  deriveStealthAddress,
  // RPC
  createMockConnection,
  createMockRpcHandler,
  mockAccountInfoResponses,
  mockTransactionResponses,
  mockBlockResponses,
  // Transactions
  solTransferAliceToBob,
  stealthSolTransfer,
  sendFlowSequence,
  receiveFlowSequence,
  createSolTransfer,
  createStealthTransfer,
  // Tokens
  USDC,
  USDT,
  TEST_USDC,
  createMockTokenAccount,
  aliceTokenAccounts,
  toRawAmount,
  fromRawAmount,
  formatTokenAmount,
  parseTokenAmount,
  getTokenBySymbol,
  // Environment
  createTestEnvironment,
  createMinimalTestEnvironment,
} from './index'

describe('Fixture Validation', () => {
  describe('Keypairs', () => {
    it('should have valid pre-generated keypairs', () => {
      expect(aliceKeypair.name).toBe('alice')
      expect(aliceKeypair.privateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.publicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.address).toBeDefined()

      expect(bobKeypair.name).toBe('bob')
      expect(charlieKeypair.name).toBe('charlie')
      expect(auditorKeypair.name).toBe('auditor')
      expect(solverKeypair.name).toBe('solver')
    })

    it('should have valid stealth keypairs with spending/viewing keys', () => {
      expect(aliceKeypair.spendingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.spendingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.viewingPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.viewingPublicKey).toMatch(/^0x[a-f0-9]{64}$/)
      expect(aliceKeypair.metaAddress).toMatch(/^sip:solana:0x[a-f0-9]+:0x[a-f0-9]+$/)
    })

    it('should generate unique keypairs on each seed', () => {
      const keypairs = generateTestKeypairs(5, 'unique')
      const addresses = keypairs.map((k) => k.address)
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(5)
    })

    it('should generate deterministic keypairs for same seed', () => {
      const keypairs1 = generateTestKeypairs(3, 'deterministic')
      const keypairs2 = generateTestKeypairs(3, 'deterministic')
      expect(keypairs1[0].privateKey).toBe(keypairs2[0].privateKey)
      expect(keypairs1[1].address).toBe(keypairs2[1].address)
    })

    it('should generate valid stealth keypairs', () => {
      const stealthKeypairs = generateStealthKeypairs(3, 'stealth-test')
      expect(stealthKeypairs).toHaveLength(3)
      stealthKeypairs.forEach((kp) => {
        expect(kp.metaAddress).toMatch(/^sip:solana:/)
        expect(kp.spendingPublicKey).toBeDefined()
        expect(kp.viewingPublicKey).toBeDefined()
      })
    })

    it('should convert keys to bytes correctly', () => {
      const privBytes = getPrivateKeyBytes(aliceKeypair)
      const pubBytes = getPublicKeyBytes(aliceKeypair)
      expect(privBytes).toHaveLength(32)
      expect(pubBytes).toHaveLength(32)
    })

    it('should sign and verify messages', () => {
      const message = new TextEncoder().encode('test message')
      const signature = signWithKeypair(aliceKeypair, message)
      expect(signature).toHaveLength(64)

      const valid = verifyWithKeypair(aliceKeypair, message, signature)
      expect(valid).toBe(true)

      // Wrong keypair should fail verification
      const invalid = verifyWithKeypair(bobKeypair, message, signature)
      expect(invalid).toBe(false)
    })

    it('should have pre-generated ephemeral keypairs', () => {
      expect(ephemeralKeypairs.tx1.name).toBe('ephemeral-test-tx-1-0')
      expect(ephemeralKeypairs.tx2.privateKey).toMatch(/^0x/)
      expect(ephemeralKeypairs.multi1.address).toBeDefined()
    })

    it('should derive stealth addresses', () => {
      const result = deriveStealthAddress(
        ephemeralKeypairs.tx1.privateKey,
        bobKeypair.spendingPublicKey,
        bobKeypair.viewingPublicKey
      )
      expect(result.stealthAddress).toBeDefined()
      expect(result.stealthPrivateKey).toMatch(/^0x[a-f0-9]{64}$/)
    })
  })

  describe('RPC Responses', () => {
    it('should have valid account info responses', () => {
      expect(mockAccountInfoResponses.notFound).toBeNull()
      expect(mockAccountInfoResponses.systemAccount.lamports).toBe(1_000_000_000)
      expect(mockAccountInfoResponses.tokenAccount.owner).toBe(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      )
    })

    it('should have valid transaction responses', () => {
      expect(mockTransactionResponses.solTransferSuccess.meta.err).toBeNull()
      expect(mockTransactionResponses.solTransferSuccess.meta.fee).toBe(5000)
      expect(mockTransactionResponses.insufficientFunds.meta.err).toBeDefined()
    })

    it('should have valid block responses', () => {
      expect(mockBlockResponses.latestBlockhash.blockhash).toBeDefined()
      expect(mockBlockResponses.latestBlockhash.lastValidBlockHeight).toBeGreaterThan(0)
    })

    it('should create mock RPC handler', () => {
      const handler = createMockRpcHandler()
      expect(handler.setResponse).toBeDefined()
      expect(handler.getResponse).toBeDefined()
      expect(handler.handle).toBeDefined()
      expect(handler.reset).toBeDefined()
    })

    it('should handle default RPC methods', async () => {
      const handler = createMockRpcHandler()

      const blockhash = await handler.handle('getLatestBlockhash')
      expect(blockhash).toEqual(mockBlockResponses.latestBlockhash)

      const balance = await handler.handle('getBalance')
      expect(balance).toEqual({ value: 1_000_000_000 })
    })

    it('should allow custom RPC responses', async () => {
      const handler = createMockRpcHandler()
      handler.setResponse('getBalance', { value: 5_000_000_000 })

      const balance = await handler.handle('getBalance')
      expect(balance).toEqual({ value: 5_000_000_000 })
    })

    it('should create mock connection', async () => {
      const conn = createMockConnection()
      expect(conn.rpcEndpoint).toBe('https://mock.solana.com')

      const blockhash = await conn.getLatestBlockhash()
      expect(blockhash.blockhash).toBeDefined()

      const balance = await conn.getBalance({ toBase58: () => 'test' })
      expect(balance).toBe(1_000_000_000)
    })
  })

  describe('Transactions', () => {
    it('should have valid pre-built transactions', () => {
      expect(solTransferAliceToBob.type).toBe('sol-transfer')
      expect(solTransferAliceToBob.from).toBe(aliceKeypair.address)
      expect(solTransferAliceToBob.to).toBe(bobKeypair.address)
      expect(solTransferAliceToBob.amount).toBe(1_000_000_000n)
    })

    it('should have valid stealth transactions', () => {
      expect(stealthSolTransfer.type).toBe('stealth-transfer')
      expect(stealthSolTransfer.ephemeralPubKey).toBeDefined()
      expect(stealthSolTransfer.stealthAddress).toBeDefined()
      expect(stealthSolTransfer.commitment).toMatch(/^0x/)
      expect(stealthSolTransfer.viewingKeyHash).toMatch(/^0x/)
    })

    it('should have complete send flow sequence', () => {
      expect(sendFlowSequence.step1_generateStealth.recipientMetaAddress).toBe(
        bobKeypair.metaAddress
      )
      expect(sendFlowSequence.step2_sendTransaction).toBeDefined()
      expect(sendFlowSequence.step3_detectPayment.found).toBe(true)
    })

    it('should have complete receive flow sequence', () => {
      expect(receiveFlowSequence.step1_publishMeta.type).toBe('stealth-announcement')
      expect(receiveFlowSequence.step2_receivePayment.type).toBe('stealth-transfer')
      expect(receiveFlowSequence.step3_scanAndDetect.foundPayments).toHaveLength(1)
      expect(receiveFlowSequence.step4_spend.from).toBeDefined()
    })

    it('should create custom SOL transfers', () => {
      const tx = createSolTransfer(aliceKeypair.address, bobKeypair.address, 500_000_000n)
      expect(tx.type).toBe('sol-transfer')
      expect(tx.amount).toBe(500_000_000n)
      expect(tx.signature.length).toBeGreaterThan(20) // Variable length mock signature
    })

    it('should create custom stealth transfers', () => {
      const tx = createStealthTransfer(
        aliceKeypair.address,
        'StealthRecipient111111111111111111111111111',
        100_000_000n,
        ephemeralKeypairs.tx1.publicKey
      )
      expect(tx.type).toBe('stealth-transfer')
      expect(tx.ephemeralPubKey).toBe(ephemeralKeypairs.tx1.publicKey)
    })
  })

  describe('Tokens', () => {
    it('should have valid token definitions', () => {
      expect(USDC.symbol).toBe('USDC')
      expect(USDC.decimals).toBe(6)
      expect(USDC.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

      expect(USDT.symbol).toBe('USDT')
      expect(TEST_USDC.symbol).toBe('tUSDC')
    })

    it('should create mock token accounts', () => {
      const account = createMockTokenAccount(aliceKeypair.address, USDC, 1_000_000n)
      expect(account.owner).toBe(aliceKeypair.address)
      expect(account.mint).toBe(USDC.address)
      expect(account.balance).toBe(1_000_000n)
      expect(account.isFrozen).toBe(false)
    })

    it('should have pre-built token accounts', () => {
      expect(aliceTokenAccounts).toHaveLength(3)
      expect(aliceTokenAccounts[0].mint).toBe(USDC.address)
    })

    it('should convert amounts correctly', () => {
      expect(toRawAmount(100, 6)).toBe(100_000_000n)
      expect(fromRawAmount(100_000_000n, 6)).toBe(100)
    })

    it('should format token amounts', () => {
      expect(formatTokenAmount(1_000_000n, USDC)).toBe('1 USDC')
      expect(formatTokenAmount(1_500_000_000n, USDC)).toContain('USDC')
    })

    it('should parse token amounts', () => {
      const result = parseTokenAmount('100 USDC')
      expect(result).not.toBeNull()
      expect(result!.amount).toBe(100_000_000n)
      expect(result!.mint.symbol).toBe('USDC')
    })

    it('should lookup tokens by symbol', () => {
      expect(getTokenBySymbol('USDC')).toBe(USDC)
      expect(getTokenBySymbol('usdc')).toBe(USDC) // case insensitive
      expect(getTokenBySymbol('UNKNOWN')).toBeUndefined()
    })
  })

  describe('Test Environment', () => {
    it('should create full test environment', () => {
      const env = createTestEnvironment()

      expect(env.connection).toBeDefined()
      expect(env.rpcHandler).toBeDefined()

      expect(env.alice.keypair).toBe(aliceKeypair)
      expect(env.alice.solBalance).toBe(10_000_000_000n)
      expect(env.alice.tokenAccounts).toHaveLength(3)

      expect(env.bob.keypair).toBe(bobKeypair)
      expect(env.charlie.keypair).toBe(charlieKeypair)

      expect(env.tokens.usdc).toBe(USDC)
    })

    it('should create minimal test environment', () => {
      const env = createMinimalTestEnvironment()

      expect(env.connection).toBeDefined()
      expect(env.sender).toBe(aliceKeypair)
      expect(env.receiver).toBe(bobKeypair)
    })
  })
})
