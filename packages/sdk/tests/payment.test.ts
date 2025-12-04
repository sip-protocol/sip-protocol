/**
 * Tests for Private Payments module
 *
 * @module tests/payment
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PaymentBuilder,
  createShieldedPayment,
  decryptMemo,
  trackPayment,
  isPaymentExpired,
  getPaymentTimeRemaining,
  serializePayment,
  deserializePayment,
  getPaymentSummary,
  getStablecoin,
  getStablecoinsForChain,
  isStablecoin,
  getStablecoinInfo,
  getSupportedStablecoins,
  isStablecoinOnChain,
  getChainsForStablecoin,
  toStablecoinUnits,
  fromStablecoinUnits,
  formatStablecoinAmount,
  STABLECOIN_ADDRESSES,
  STABLECOIN_DECIMALS,
  generateStealthMetaAddress,
  PrivacyLevel,
  PaymentStatus,
  ValidationError,
} from '../src'

describe('Stablecoin Registry', () => {
  describe('getStablecoin', () => {
    it('should return USDC on Ethereum', () => {
      const usdc = getStablecoin('USDC', 'ethereum')
      expect(usdc).not.toBeNull()
      expect(usdc!.symbol).toBe('USDC')
      expect(usdc!.chain).toBe('ethereum')
      expect(usdc!.decimals).toBe(6)
      expect(usdc!.address).toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
    })

    it('should return USDT on Polygon', () => {
      const usdt = getStablecoin('USDT', 'polygon')
      expect(usdt).not.toBeNull()
      expect(usdt!.symbol).toBe('USDT')
      expect(usdt!.chain).toBe('polygon')
      expect(usdt!.decimals).toBe(6)
    })

    it('should return DAI with 18 decimals', () => {
      const dai = getStablecoin('DAI', 'ethereum')
      expect(dai).not.toBeNull()
      expect(dai!.decimals).toBe(18)
    })

    it('should return null for unsupported chain', () => {
      const pyusd = getStablecoin('PYUSD', 'solana')
      expect(pyusd).toBeNull()
    })

    it('should return USDC on Solana with SPL address', () => {
      const usdc = getStablecoin('USDC', 'solana')
      expect(usdc).not.toBeNull()
      expect(usdc!.address).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    })
  })

  describe('getStablecoinsForChain', () => {
    it('should return multiple stablecoins for Ethereum', () => {
      const stables = getStablecoinsForChain('ethereum')
      expect(stables.length).toBeGreaterThan(5)
      const symbols = stables.map(s => s.symbol)
      expect(symbols).toContain('USDC')
      expect(symbols).toContain('USDT')
      expect(symbols).toContain('DAI')
    })

    it('should return fewer stablecoins for newer chains', () => {
      const baseStables = getStablecoinsForChain('base')
      const ethStables = getStablecoinsForChain('ethereum')
      expect(baseStables.length).toBeLessThanOrEqual(ethStables.length)
    })
  })

  describe('isStablecoin', () => {
    it('should return true for USDC', () => {
      expect(isStablecoin('USDC')).toBe(true)
    })

    it('should return true for USDT', () => {
      expect(isStablecoin('USDT')).toBe(true)
    })

    it('should return false for ETH', () => {
      expect(isStablecoin('ETH')).toBe(false)
    })

    it('should return false for random token', () => {
      expect(isStablecoin('RANDOM')).toBe(false)
    })
  })

  describe('getStablecoinInfo', () => {
    it('should return USDC info', () => {
      const info = getStablecoinInfo('USDC')
      expect(info.name).toBe('USD Coin')
      expect(info.issuer).toBe('Circle')
      expect(info.type).toBe('fiat-backed')
    })

    it('should return DAI info as crypto-backed', () => {
      const info = getStablecoinInfo('DAI')
      expect(info.type).toBe('crypto-backed')
      expect(info.issuer).toBe('MakerDAO')
    })

    it('should return FRAX info as algorithmic', () => {
      const info = getStablecoinInfo('FRAX')
      expect(info.type).toBe('algorithmic')
    })
  })

  describe('getSupportedStablecoins', () => {
    it('should return all supported stablecoins', () => {
      const stables = getSupportedStablecoins()
      expect(stables).toContain('USDC')
      expect(stables).toContain('USDT')
      expect(stables).toContain('DAI')
      expect(stables).toContain('FRAX')
      expect(stables.length).toBe(Object.keys(STABLECOIN_ADDRESSES).length)
    })
  })

  describe('isStablecoinOnChain', () => {
    it('should return true for USDC on Ethereum', () => {
      expect(isStablecoinOnChain('USDC', 'ethereum')).toBe(true)
    })

    it('should return false for PYUSD on Solana', () => {
      expect(isStablecoinOnChain('PYUSD', 'solana')).toBe(false)
    })
  })

  describe('getChainsForStablecoin', () => {
    it('should return multiple chains for USDC', () => {
      const chains = getChainsForStablecoin('USDC')
      expect(chains).toContain('ethereum')
      expect(chains).toContain('polygon')
      expect(chains).toContain('arbitrum')
      expect(chains).toContain('solana')
    })

    it('should return fewer chains for PYUSD', () => {
      const chains = getChainsForStablecoin('PYUSD')
      expect(chains).toContain('ethereum')
      expect(chains.length).toBeLessThan(getChainsForStablecoin('USDC').length)
    })
  })

  describe('toStablecoinUnits', () => {
    it('should convert 100 USDC to 100000000', () => {
      const units = toStablecoinUnits(100, 'USDC')
      expect(units).toBe(100_000_000n)
    })

    it('should convert 100.50 USDC correctly', () => {
      const units = toStablecoinUnits(100.5, 'USDC')
      expect(units).toBe(100_500_000n)
    })

    it('should convert 100 DAI to 18 decimals', () => {
      const units = toStablecoinUnits(100, 'DAI')
      expect(units).toBe(100_000_000_000_000_000_000n)
    })
  })

  describe('fromStablecoinUnits', () => {
    it('should convert 100000000 to 100 USDC', () => {
      const amount = fromStablecoinUnits(100_000_000n, 'USDC')
      expect(amount).toBe(100)
    })

    it('should convert 100500000 to 100.5 USDC', () => {
      const amount = fromStablecoinUnits(100_500_000n, 'USDC')
      expect(amount).toBe(100.5)
    })
  })

  describe('formatStablecoinAmount', () => {
    it('should format USDC amount with symbol', () => {
      const formatted = formatStablecoinAmount(100_500_000n, 'USDC')
      expect(formatted).toBe('100.50 USDC')
    })

    it('should format without symbol when specified', () => {
      const formatted = formatStablecoinAmount(100_500_000n, 'USDC', { includeSymbol: false })
      expect(formatted).toBe('100.50')
    })

    it('should handle large amounts', () => {
      const formatted = formatStablecoinAmount(1_000_000_000_000n, 'USDC')
      expect(formatted).toContain('1,000,000')
    })
  })
})

describe('PaymentBuilder', () => {
  let recipientMetaAddress: string

  beforeEach(() => {
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
  })

  describe('basic building', () => {
    it('should create a shielded USDC payment', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(payment.paymentId).toBeDefined()
      expect(payment.privacyLevel).toBe('shielded')
      expect(payment.token.symbol).toBe('USDC')
      expect(payment.amount).toBe(100_000_000n)
      expect(payment.recipientStealth).toBeDefined()
      expect(payment.amountCommitment).toBeDefined()
    })

    it('should create a payment with human-readable amount', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amountHuman(100.5)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(payment.amount).toBe(100_500_000n)
    })

    it('should create a transparent payment', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipientDirect('0x1234567890123456789012345678901234567890')
        .privacy(PrivacyLevel.TRANSPARENT)
        .build()

      expect(payment.privacyLevel).toBe('transparent')
      expect(payment.recipientAddress).toBe('0x1234567890123456789012345678901234567890')
      expect(payment.recipientStealth).toBeUndefined()
      expect(payment.amountCommitment).toBeUndefined()
    })

    it('should create a compliant payment with viewing key', async () => {
      const viewingKey = '0x' + '1234'.repeat(16) as `0x${string}`

      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.COMPLIANT)
        .viewingKey(viewingKey)
        .build()

      expect(payment.privacyLevel).toBe('compliant')
      expect(payment.viewingKeyHash).toBeDefined()
    })

    it('should set payment purpose', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.SHIELDED)
        .purpose('salary')
        .build()

      expect(payment.purpose).toBe('salary')
    })

    it('should set memo', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.TRANSPARENT)
        .recipientDirect('0x1234567890123456789012345678901234567890')
        .memo('Payment for services')
        .build()

      expect(payment.memo).toBe('Payment for services')
    })

    it('should encrypt memo for compliant mode', async () => {
      const viewingKey = '0x' + '1234'.repeat(16) as `0x${string}`

      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.COMPLIANT)
        .viewingKey(viewingKey)
        .memo('Secret memo')
        .build()

      expect(payment.encryptedMemo).toBeDefined()
      expect(payment.memo).toBeUndefined()
    })

    it('should set custom TTL', async () => {
      const payment = await new PaymentBuilder()
        .token('USDC', 'ethereum')
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.SHIELDED)
        .ttl(7200)
        .build()

      const expectedExpiry = payment.createdAt + 7200
      expect(payment.expiry).toBe(expectedExpiry)
    })

    it('should work with Asset object', async () => {
      const customToken = {
        chain: 'ethereum' as const,
        symbol: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' as `0x${string}`,
        decimals: 6,
      }

      const payment = await new PaymentBuilder()
        .token(customToken)
        .amount(100_000_000n)
        .recipient(recipientMetaAddress)
        .privacy(PrivacyLevel.SHIELDED)
        .build()

      expect(payment.token.symbol).toBe('USDC')
    })
  })

  describe('validation', () => {
    it('should throw if token not set', async () => {
      await expect(
        new PaymentBuilder()
          .amount(100_000_000n)
          .recipient(recipientMetaAddress)
          .privacy(PrivacyLevel.SHIELDED)
          .build()
      ).rejects.toThrow('token is required')
    })

    it('should throw if amount not set', async () => {
      await expect(
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .recipient(recipientMetaAddress)
          .privacy(PrivacyLevel.SHIELDED)
          .build()
      ).rejects.toThrow('amount is required')
    })

    it('should throw if amount is zero', () => {
      expect(() =>
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .amount(0n)
      ).toThrow('amount must be positive')
    })

    it('should throw if amount is negative', () => {
      expect(() =>
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .amount(-100n)
      ).toThrow('amount must be positive')
    })

    it('should throw if stablecoin not on chain', () => {
      expect(() =>
        new PaymentBuilder()
          .token('PYUSD', 'solana')
      ).toThrow('PYUSD is not available on solana')
    })

    it('should throw if chain missing for symbol', () => {
      // Test error when chain parameter is missing - using undefined to force the error
      expect(() =>
        new PaymentBuilder()
          .token('USDC' as StablecoinSymbol, undefined as unknown as ChainId)
      ).toThrow('chain is required when using stablecoin symbol')
    })

    it('should throw if shielded mode without stealth address', async () => {
      await expect(
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .amount(100_000_000n)
          .privacy(PrivacyLevel.SHIELDED)
          .build()
      ).rejects.toThrow('recipientMetaAddress is required for shielded')
    })

    it('should throw if transparent mode without direct address', async () => {
      await expect(
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .amount(100_000_000n)
          .privacy(PrivacyLevel.TRANSPARENT)
          .build()
      ).rejects.toThrow('recipientAddress is required for transparent')
    })

    it('should throw if compliant mode without viewing key', async () => {
      await expect(
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .amount(100_000_000n)
          .recipient(recipientMetaAddress)
          .privacy(PrivacyLevel.COMPLIANT)
          .build()
      ).rejects.toThrow('viewingKey is required for compliant')
    })

    it('should throw if memo too long', () => {
      const longMemo = 'x'.repeat(257)
      expect(() =>
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .memo(longMemo)
      ).toThrow('memo must be 256 characters or less')
    })

    it('should throw if invalid TTL', () => {
      expect(() =>
        new PaymentBuilder()
          .token('USDC', 'ethereum')
          .ttl(0)
      ).toThrow('ttl must be a positive integer')
    })
  })
})

describe('createShieldedPayment', () => {
  let recipientMetaAddress: string

  beforeEach(() => {
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
  })

  it('should create a payment with all fields', async () => {
    const viewingKey = '0x' + '1234'.repeat(16) as `0x${string}`

    const payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.COMPLIANT,
      viewingKey,
      sourceChain: 'ethereum',
      purpose: 'salary',
      memo: 'Monthly salary',
      ttl: 3600,
    })

    expect(payment.paymentId).toBeDefined()
    expect(payment.version).toBeDefined()
    expect(payment.privacyLevel).toBe('compliant')
    expect(payment.token.symbol).toBe('USDC')
    expect(payment.amount).toBe(100_000_000n)
    expect(payment.sourceChain).toBe('ethereum')
    expect(payment.destinationChain).toBe('ethereum')
    expect(payment.purpose).toBe('salary')
    expect(payment.viewingKeyHash).toBeDefined()
  })

  it('should handle cross-chain payment', async () => {
    const payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.SHIELDED,
      sourceChain: 'ethereum',
      destinationChain: 'polygon',
    })

    expect(payment.sourceChain).toBe('ethereum')
    expect(payment.destinationChain).toBe('polygon')
  })
})

describe('Memo Encryption', () => {
  it('should encrypt and decrypt memo correctly', async () => {
    const viewingKey = '0x' + '1234'.repeat(16) as `0x${string}`
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

    const payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.COMPLIANT,
      viewingKey,
      sourceChain: 'ethereum',
      memo: 'Test memo for encryption',
    })

    expect(payment.encryptedMemo).toBeDefined()

    const decrypted = decryptMemo(payment.encryptedMemo!, viewingKey)
    expect(decrypted).toBe('Test memo for encryption')
  })

  it('should fail decryption with wrong key', async () => {
    const viewingKey = '0x' + '1234'.repeat(16) as `0x${string}`
    const wrongKey = '0x' + '5678'.repeat(16) as `0x${string}`
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

    const payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.COMPLIANT,
      viewingKey,
      sourceChain: 'ethereum',
      memo: 'Secret message',
    })

    expect(() => decryptMemo(payment.encryptedMemo!, wrongKey)).toThrow()
  })
})

describe('Payment Tracking', () => {
  let payment: Awaited<ReturnType<typeof createShieldedPayment>>

  beforeEach(async () => {
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

    payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.SHIELDED,
      sourceChain: 'ethereum',
    })
  })

  it('should track payment with initial status', () => {
    const tracked = trackPayment(payment)
    expect(tracked.status).toBe(PaymentStatus.DRAFT)
    expect(tracked.paymentId).toBe(payment.paymentId)
  })

  it('should check if payment is expired', () => {
    expect(isPaymentExpired(payment)).toBe(false)

    // Create an expired payment
    const expiredPayment = {
      ...payment,
      expiry: Math.floor(Date.now() / 1000) - 1000,
    }
    expect(isPaymentExpired(expiredPayment)).toBe(true)
  })

  it('should get time remaining', () => {
    const remaining = getPaymentTimeRemaining(payment)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(3600)
  })

  it('should return 0 for expired payment', () => {
    const expiredPayment = {
      ...payment,
      expiry: Math.floor(Date.now() / 1000) - 1000,
    }
    const remaining = getPaymentTimeRemaining(expiredPayment)
    expect(remaining).toBe(0)
  })
})

describe('Payment Serialization', () => {
  let payment: Awaited<ReturnType<typeof createShieldedPayment>>

  beforeEach(async () => {
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

    payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.SHIELDED,
      sourceChain: 'ethereum',
    })
  })

  it('should serialize and deserialize correctly', () => {
    const serialized = serializePayment(payment)
    expect(typeof serialized).toBe('string')

    const deserialized = deserializePayment(serialized)
    expect(deserialized.paymentId).toBe(payment.paymentId)
    expect(deserialized.amount).toBe(payment.amount)
    expect(deserialized.token.symbol).toBe(payment.token.symbol)
  })

  it('should handle bigint serialization', () => {
    const serialized = serializePayment(payment)
    expect(serialized).not.toContain('BigInt')

    const deserialized = deserializePayment(serialized)
    expect(typeof deserialized.amount).toBe('bigint')
  })
})

describe('Payment Summary', () => {
  it('should generate readable summary', async () => {
    const { metaAddress } = generateStealthMetaAddress('ethereum')
    const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

    const payment = await createShieldedPayment({
      token: 'USDC',
      amount: 100_000_000n,
      recipientMetaAddress,
      privacy: PrivacyLevel.SHIELDED,
      sourceChain: 'ethereum',
    })

    const summary = getPaymentSummary(payment)
    expect(summary).toContain('[SHIELDED]')
    expect(summary).toContain('100')
    expect(summary).toContain('USDC')
    expect(summary).toContain('expires:')
  })
})
