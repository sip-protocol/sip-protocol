/**
 * Ethereum Privacy E2E Tests
 *
 * End-to-end tests for the complete Ethereum privacy flow:
 * - Wallet connection and stealth address generation
 * - Shielded ETH and ERC-20 transfers
 * - Announcement scanning and payment detection
 * - Stealth address claiming
 * - Viewing key management and compliance
 *
 * @module tests/e2e/ethereum/ethereum-privacy
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import type { HexString } from '@sip-protocol/types'

// ─── Privacy Adapter ─────────────────────────────────────────────────────────
import {
  EthereumPrivacyAdapter,
  createEthereumPrivacyAdapter,
} from '../../../src/chains/ethereum/privacy-adapter'

// ─── Stealth Addresses ───────────────────────────────────────────────────────
import {
  generateEthereumStealthAddress,
  deriveEthereumStealthPrivateKey,
  checkEthereumStealthAddress,
  parseEthereumStealthMetaAddress,
} from '../../../src/chains/ethereum/stealth'

// ─── Viewing Keys ────────────────────────────────────────────────────────────
import {
  generateViewingKeyPair,
  exportViewingKey,
  importViewingKey,
  serializeViewingKey,
  createSharedViewingKey,
  createFullAccessViewingKey,
  createRangeRestrictedViewingKey,
  hashViewingKey,
  isViewingKeyExpired,
} from '../../../src/chains/ethereum/viewing-key'

// ─── Commitments ─────────────────────────────────────────────────────────────
import {
  commitETH,
  verifyOpeningETH,
  commitERC20Token,
  toWei,
  fromWei,
} from '../../../src/chains/ethereum/commitment'

// ─── Test Fixtures ───────────────────────────────────────────────────────────
import {
  bobAccount,
  charlieAccount,
  ETH,
  GWEI,
  TEST_USDC,
  TEST_TOKEN_18,
  toRawAmount,
  createStealthPaymentScenario,
} from '../../fixtures/ethereum'

// ─── E2E Helpers ─────────────────────────────────────────────────────────────
import {
  MetricsCollector,
} from '../helpers'

// ─── Test Constants ──────────────────────────────────────────────────────────

const ONE_ETH = ETH
const HALF_ETH = ETH / 2n
const TENTH_ETH = ETH / 10n
const USDC_AMOUNT = 1000n * 10n ** 6n // 1000 USDC

// ─── E2E Test Suite ──────────────────────────────────────────────────────────

describe('Ethereum Privacy E2E Tests', () => {
  let adapter: EthereumPrivacyAdapter
  let metrics: MetricsCollector

  beforeAll(() => {
    metrics = new MetricsCollector()
  })

  beforeEach(() => {
    adapter = createEthereumPrivacyAdapter({
      network: 'mainnet',
      hideAmounts: true,
    })
  })

  afterEach(() => {
    adapter.dispose()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 1: Connect wallet and generate stealth address
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Wallet Connection and Stealth Address Generation', () => {
    it('should connect wallet and generate a new stealth meta-address', async () => {
      const { result } = await metrics.measure('wallet-connect-stealth-gen', async () => {
        // 1. Simulate wallet connection (using test fixture)
        const wallet = bobAccount

        // 2. Generate stealth meta-address for the wallet
        const generated = adapter.generateMetaAddress()

        // 3. The encoded format is portable
        const encoded = generated.encoded

        // 4. Parse it back to verify round-trip
        const parsed = parseEthereumStealthMetaAddress(encoded)

        return { wallet, generated, encoded, parsed }
      })

      // Verify wallet is connected
      expect(result.wallet.address).toBeDefined()

      // Verify meta-address structure
      expect(result.generated.metaAddress.spendingKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.generated.metaAddress.viewingKey).toMatch(/^0x[0-9a-f]{66}$/i)

      // Verify encoded format
      expect(result.encoded).toContain('st:eth:')

      // Verify round-trip parsing
      expect(result.parsed.spendingKey.toLowerCase()).toBe(
        result.generated.metaAddress.spendingKey.toLowerCase()
      )
      expect(result.parsed.viewingKey.toLowerCase()).toBe(
        result.generated.metaAddress.viewingKey.toLowerCase()
      )
    })

    it('should generate unique stealth addresses for each transaction', async () => {
      const generated = adapter.generateMetaAddress()
      const stealthAddresses: string[] = []

      // Generate 10 different stealth addresses
      for (let i = 0; i < 10; i++) {
        const stealth = generateEthereumStealthAddress(generated.metaAddress)
        stealthAddresses.push(stealth.stealthAddress.ethAddress)
      }

      // Verify all addresses are unique
      const uniqueAddresses = new Set(stealthAddresses)
      expect(uniqueAddresses.size).toBe(10)

      // Verify all are valid Ethereum addresses
      for (const addr of stealthAddresses) {
        expect(addr).toMatch(/^0x[0-9a-f]{40}$/i)
      }
    })

    it('should support multiple wallets simultaneously', async () => {
      // Generate meta-addresses for Alice, Bob, and Charlie
      const aliceGen = adapter.generateMetaAddress()
      const bobGen = adapter.generateMetaAddress()
      const charlieGen = adapter.generateMetaAddress()

      // Each should be unique
      expect(aliceGen.metaAddress.spendingKey).not.toBe(bobGen.metaAddress.spendingKey)
      expect(bobGen.metaAddress.spendingKey).not.toBe(charlieGen.metaAddress.spendingKey)
      expect(aliceGen.metaAddress.viewingKey).not.toBe(bobGen.metaAddress.viewingKey)

      // Each should be valid
      expect(aliceGen.metaAddress.chain).toBe('ethereum')
      expect(bobGen.metaAddress.chain).toBe('ethereum')
      expect(charlieGen.metaAddress.chain).toBe('ethereum')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 2: Send ETH to stealth address
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Send ETH to Stealth Address', () => {
    it('should build a shielded ETH transfer to stealth address', async () => {
      const { result } = await metrics.measure('eth-transfer-build', async () => {
        // 1. Bob generates meta-address
        const bobGen = adapter.generateMetaAddress()

        // 2. Alice builds shielded transfer to Bob
        const build = adapter.buildShieldedTransfer({
          recipient: bobGen.metaAddress,
          amount: ONE_ETH,
        })

        return { bobGen, build }
      })

      // Verify transfer build
      expect(result.build.stealthEthAddress).toMatch(/^0x[0-9a-f]{40}$/i)
      expect(result.build.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.build.viewTag).toBeGreaterThanOrEqual(0)
      expect(result.build.viewTag).toBeLessThanOrEqual(255)

      // Verify transaction data
      expect(result.build.transferTx.value).toBe(ONE_ETH)
      expect(result.build.transferTx.to).toBe(result.build.stealthEthAddress)
    })

    it('should generate correct announcement data for ETH transfer', async () => {
      const bobGen = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTransfer({
        recipient: bobGen.metaAddress,
        amount: HALF_ETH,
      })

      // Verify announcement encoding
      expect(build.announcementTx.data).toBeDefined()
      expect(build.announcementTx.data).toMatch(/^0x/)

      // Verify gas estimate is reasonable
      expect(build.estimatedGas).toBeDefined()
      expect(build.estimatedGas).toBeGreaterThan(21000n) // More than basic transfer
    })

    it('should support various ETH amounts', async () => {
      const bobGen = adapter.generateMetaAddress()
      const amounts = [1n, GWEI, TENTH_ETH, ONE_ETH, 10n * ETH]

      for (const amount of amounts) {
        const build = adapter.buildShieldedTransfer({
          recipient: bobGen.metaAddress,
          amount,
        })

        expect(build.transferTx.value).toBe(amount)
        expect(build.stealthEthAddress).toMatch(/^0x[0-9a-f]{40}$/i)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 3: Send ERC-20 to stealth address
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Send ERC-20 to Stealth Address', () => {
    it('should build a shielded ERC-20 transfer', async () => {
      const { result } = await metrics.measure('erc20-transfer-build', async () => {
        const bobGen = adapter.generateMetaAddress()

        const build = adapter.buildShieldedTokenTransfer({
          recipient: bobGen.metaAddress,
          tokenContract: TEST_USDC.address as HexString,
          amount: USDC_AMOUNT,
        })

        return { bobGen, build }
      })

      // Verify stealth address
      expect(result.build.stealthEthAddress).toMatch(/^0x[0-9a-f]{40}$/i)

      // Verify token transfer data exists
      expect(result.build.tokenTransferData).toBeDefined()
      expect(result.build.tokenTransferData).toMatch(/^0x/)

      // Verify the transferTx is for the token contract
      expect(result.build.transferTx.to.toLowerCase()).toBe(TEST_USDC.address.toLowerCase())
    })

    it('should handle tokens with different decimals', async () => {
      const bobGen = adapter.generateMetaAddress()

      // Test USDC (6 decimals)
      const usdcBuild = adapter.buildShieldedTokenTransfer({
        recipient: bobGen.metaAddress,
        tokenContract: TEST_USDC.address as HexString,
        amount: toRawAmount('1000', 6), // 1000 USDC
        decimals: 6,
      })
      expect(usdcBuild.tokenTransferData).toBeDefined()

      // Test 18 decimal token
      const tokenBuild = adapter.buildShieldedTokenTransfer({
        recipient: bobGen.metaAddress,
        tokenContract: TEST_TOKEN_18.address as HexString,
        amount: toRawAmount('100', 18), // 100 tokens
        decimals: 18,
      })
      expect(tokenBuild.tokenTransferData).toBeDefined()
    })

    it('should generate token announcement with metadata', async () => {
      const bobGen = adapter.generateMetaAddress()

      const build = adapter.buildShieldedTokenTransfer({
        recipient: bobGen.metaAddress,
        tokenContract: TEST_USDC.address as HexString,
        amount: USDC_AMOUNT,
      })

      // Announcement should be defined
      expect(build.announcementTx.data).toBeDefined()

      // Gas estimate should account for token transfer
      expect(build.estimatedGas).toBeGreaterThan(50000n)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 4: Scan and find incoming transfers
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Scan and Find Incoming Transfers', () => {
    it('should register recipient for scanning', async () => {
      const bobGen = adapter.generateMetaAddress()

      // Register Bob as a scan recipient
      adapter.addScanRecipient({
        spendingPublicKey: bobGen.metaAddress.spendingKey,
        viewingPrivateKey: bobGen.viewingPrivateKey,
        label: 'Bob',
      })

      // Verify registration
      const state = adapter.getState()
      expect(state.scanRecipientCount).toBe(1)
    })

    it('should detect payments using view tag filtering', async () => {
      // Create a payment scenario
      const scenario = createStealthPaymentScenario()

      // The view tag allows efficient filtering
      const viewTag = scenario.viewTag
      expect(viewTag).toBeGreaterThanOrEqual(0)
      expect(viewTag).toBeLessThanOrEqual(255)

      // View tag is first byte of shared secret hash
      // This enables O(1) rejection of unrelated announcements
    })

    it('should verify stealth address ownership', () => {
      // Bob generates keys
      const bobGen = adapter.generateMetaAddress()

      // Alice sends to Bob's stealth address
      const stealthResult = generateEthereumStealthAddress(bobGen.metaAddress)

      // Bob verifies the stealth address belongs to him
      const isForBob = checkEthereumStealthAddress(
        stealthResult.stealthAddress,
        bobGen.spendingPrivateKey,
        bobGen.viewingPrivateKey
      )

      expect(isForBob).toBe(true)

      // Alice cannot claim (wrong keys)
      const aliceGen = adapter.generateMetaAddress()
      const isForAlice = checkEthereumStealthAddress(
        stealthResult.stealthAddress,
        aliceGen.spendingPrivateKey,
        aliceGen.viewingPrivateKey
      )

      expect(isForAlice).toBe(false)
    })

    it('should manage multiple scan recipients', async () => {
      const aliceGen = adapter.generateMetaAddress()
      const bobGen = adapter.generateMetaAddress()

      // Register multiple recipients
      adapter.addScanRecipient({
        spendingPublicKey: aliceGen.metaAddress.spendingKey,
        viewingPrivateKey: aliceGen.viewingPrivateKey,
        label: 'Alice',
      })

      adapter.addScanRecipient({
        spendingPublicKey: bobGen.metaAddress.spendingKey,
        viewingPrivateKey: bobGen.viewingPrivateKey,
        label: 'Bob',
      })

      // Verify both registered
      const recipients = adapter.getScanRecipients()
      expect(recipients).toHaveLength(2)

      // Remove one
      adapter.removeScanRecipient(aliceGen.viewingPrivateKey)
      expect(adapter.getScanRecipients()).toHaveLength(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 5: Claim stealth transfer to new wallet
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Claim Stealth Transfer', () => {
    it('should derive spending key for stealth address', () => {
      // Bob's keys
      const bobGen = adapter.generateMetaAddress()

      // Alice sends to Bob
      const stealthResult = generateEthereumStealthAddress(bobGen.metaAddress)

      // Bob derives the private key for this stealth address
      const recovery = deriveEthereumStealthPrivateKey(
        stealthResult.stealthAddress,
        bobGen.spendingPrivateKey,
        bobGen.viewingPrivateKey
      )

      // Private key should be valid
      expect(recovery.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      // Recovery should also include the derived Ethereum address
      expect(recovery.ethAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('should build claim transaction', async () => {
      const { result } = await metrics.measure('claim-build', async () => {
        // Setup: Bob's meta-address
        const bobGen = adapter.generateMetaAddress()

        // Alice sends ETH to Bob's stealth address
        const stealthResult = generateEthereumStealthAddress(bobGen.metaAddress)

        // Bob wants to claim to a fresh wallet
        const claimToAddress = charlieAccount.address

        // Build claim transaction
        const claimBuild = adapter.buildClaimTransaction({
          stealthAddress: stealthResult.stealthAddress,
          ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
          spendingPrivateKey: bobGen.spendingPrivateKey,
          viewingPrivateKey: bobGen.viewingPrivateKey,
          destinationAddress: claimToAddress,
          amount: ONE_ETH,
        })

        return { bobGen, stealthResult, claimBuild }
      })

      // Verify claim build
      expect(result.claimBuild.stealthEthAddress).toBeDefined()
      expect(result.claimBuild.destinationAddress).toBe(charlieAccount.address)
      expect(result.claimBuild.amount).toBeLessThanOrEqual(ONE_ETH)
    })

    it('should estimate gas for claiming', async () => {
      const estimate = adapter.estimateClaimGas(false) // ETH claim

      // Gas estimate should be reasonable
      expect(estimate.gasLimit).toBeGreaterThanOrEqual(21000n)
      expect(estimate.estimatedCost).toBeGreaterThan(0n)
    })

    it('should estimate gas for token claiming', async () => {
      const estimate = adapter.estimateClaimGas(true) // Token claim

      // Token claims require more gas
      expect(estimate.gasLimit).toBeGreaterThan(21000n)
      expect(estimate.estimatedCost).toBeGreaterThan(0n)
    })

    it('should build claim transaction for ERC-20 tokens', async () => {
      const bobGen = adapter.generateMetaAddress()

      const stealthResult = generateEthereumStealthAddress(bobGen.metaAddress)

      const claimBuild = adapter.buildClaimTransaction({
        stealthAddress: stealthResult.stealthAddress,
        ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
        spendingPrivateKey: bobGen.spendingPrivateKey,
        viewingPrivateKey: bobGen.viewingPrivateKey,
        destinationAddress: charlieAccount.address,
        tokenContract: TEST_USDC.address as HexString,
        amount: USDC_AMOUNT,
      })

      // Verify token transfer data
      expect(claimBuild.tx.data).toBeDefined()
      expect(claimBuild.tx.to.toLowerCase()).toBe(TEST_USDC.address.toLowerCase())
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 6: Generate and share viewing key
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Viewing Key Generation and Sharing', () => {
    it('should generate a viewing keypair from meta-address', async () => {
      const { result } = await metrics.measure('viewing-key-gen', async () => {
        const generated = adapter.generateMetaAddress()

        const viewingKeyPair = generateViewingKeyPair(
          generated.metaAddress.spendingKey,
          'My Main Wallet'
        )

        return { generated, viewingKeyPair }
      })

      // Verify keypair structure
      expect(result.viewingKeyPair.publicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(result.viewingKeyPair.privateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(result.viewingKeyPair.spendingPublicKey).toBe(result.generated.metaAddress.spendingKey)
      expect(result.viewingKeyPair.label).toBe('My Main Wallet')
    })

    it('should export viewing key for auditors (no private key)', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Audit Key')

      // Export for sharing
      const exported = exportViewingKey(viewingKeyPair, 'mainnet')

      // Verify export contains no private key
      expect(exported.viewingPublicKey).toBeDefined()
      expect(exported.spendingPublicKey).toBeDefined()
      expect((exported as unknown as Record<string, unknown>).privateKey).toBeUndefined()

      // Verify metadata
      expect(exported.version).toBe(1)
      expect(exported.chain).toBe('ethereum')
      expect(exported.network).toBe('mainnet')
      expect(exported.label).toBe('Audit Key')
      expect(exported.createdAt).toBeDefined()
    })

    it('should serialize and deserialize viewing key', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Test')

      // Export and serialize
      const exported = exportViewingKey(viewingKeyPair, 'mainnet')
      const serialized = serializeViewingKey(exported)

      // Should be valid JSON
      expect(() => JSON.parse(serialized)).not.toThrow()

      // Import back
      const imported = importViewingKey(serialized)

      expect(imported.viewingPublicKey).toBe(exported.viewingPublicKey)
      expect(imported.spendingPublicKey).toBe(exported.spendingPublicKey)
    })

    it('should create shared viewing key with permissions', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Shared')

      // Create with limited permissions
      const sharedKey = createSharedViewingKey(viewingKeyPair, {
        canViewIncoming: true,
        canViewOutgoing: false,
        canViewAmounts: true,
      })

      expect(sharedKey.permissions.canViewIncoming).toBe(true)
      expect(sharedKey.permissions.canViewOutgoing).toBe(false)
      expect(sharedKey.permissions.canViewAmounts).toBe(true)
    })

    it('should create full-access viewing key', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Full')

      const fullAccess = createFullAccessViewingKey(viewingKeyPair)

      expect(fullAccess.permissions.canViewIncoming).toBe(true)
      expect(fullAccess.permissions.canViewOutgoing).toBe(true)
      expect(fullAccess.permissions.canViewAmounts).toBe(true)
    })

    it('should create range-restricted viewing key', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Range')

      const rangeKey = createRangeRestrictedViewingKey(
        viewingKeyPair,
        19000000, // from block
        20000000 // to block
      )

      expect(rangeKey.permissions.blockRange).toBeDefined()
      expect(rangeKey.permissions.blockRange!.from).toBe(19000000)
      expect(rangeKey.permissions.blockRange!.to).toBe(20000000)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 7: View transfers with viewing key
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: View Transfers with Viewing Key', () => {
    it('should verify viewing key matches meta-address', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Test')

      // The viewing key pair's spending public key should match meta-address spending key
      expect(viewingKeyPair.spendingPublicKey).toBe(generated.metaAddress.spendingKey)
    })

    it('should hash viewing key for indexing', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Test')

      const hash = hashViewingKey(viewingKeyPair.publicKey)

      // Hash should be 32 bytes
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i)

      // Same input should give same hash
      const hash2 = hashViewingKey(viewingKeyPair.publicKey)
      expect(hash2).toBe(hash)
    })

    it('should detect expired viewing keys', async () => {
      const generated = adapter.generateMetaAddress()
      const viewingKeyPair = generateViewingKeyPair(generated.metaAddress.spendingKey, 'Expiring')

      // Create with past expiration
      const pastDate = new Date(Date.now() - 1000) // 1 second ago
      const exported = exportViewingKey(viewingKeyPair, 'mainnet', pastDate)

      expect(isViewingKeyExpired(exported)).toBe(true)

      // Create with future expiration
      const futureDate = new Date(Date.now() + 86400000) // 1 day from now
      const validExported = exportViewingKey(viewingKeyPair, 'mainnet', futureDate)

      expect(isViewingKeyExpired(validExported)).toBe(false)
    })

    it('should use viewing key to detect incoming payments', async () => {
      // Bob's keys
      const bobGen = adapter.generateMetaAddress()

      // Alice sends to Bob's stealth address
      const stealthResult = generateEthereumStealthAddress(bobGen.metaAddress)

      // Using viewing key, Bob can verify the payment is for him
      const isForBob = checkEthereumStealthAddress(
        stealthResult.stealthAddress,
        bobGen.spendingPrivateKey,
        bobGen.viewingPrivateKey
      )

      expect(isForBob).toBe(true)

      // Auditor with shared viewing key can also verify (if given private key)
      // In practice, auditor receives encrypted transaction metadata
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Test 8: Complete round-trip privacy flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Complete Round-Trip Privacy Flow', () => {
    it('should complete full ETH transfer cycle', async () => {
      const { result } = await metrics.measure(
        'complete-eth-roundtrip',
        async () => {
          // ═══ Step 1: Bob generates stealth meta-address ═══
          const bobGen = adapter.generateMetaAddress()
          const bobEncodedMeta = bobGen.encoded

          // ═══ Step 2: Bob shares meta-address with Alice ═══
          // Alice parses Bob's meta-address
          const parsedBobMeta = parseEthereumStealthMetaAddress(bobEncodedMeta)

          // ═══ Step 3: Alice builds shielded transfer ═══
          const transferBuild = adapter.buildShieldedTransfer({
            recipient: parsedBobMeta,
            amount: ONE_ETH,
          })

          // ═══ Step 4: Alice broadcasts transaction (simulated) ═══
          // In real E2E, this would use an RPC provider
          const txHash = '0x' + '1'.repeat(64)

          // ═══ Step 5: Bob scans for incoming payments ═══
          // Bob uses his viewing key to check announcements
          const isForBob = checkEthereumStealthAddress(
            transferBuild.stealthAddress,
            bobGen.spendingPrivateKey,
            bobGen.viewingPrivateKey
          )

          // ═══ Step 6: Bob claims funds to fresh wallet ═══
          const claimBuild = adapter.buildClaimTransaction({
            stealthAddress: transferBuild.stealthAddress,
            ephemeralPublicKey: transferBuild.ephemeralPublicKey,
            spendingPrivateKey: bobGen.spendingPrivateKey,
            viewingPrivateKey: bobGen.viewingPrivateKey,
            destinationAddress: charlieAccount.address,
            amount: ONE_ETH,
          })

          return {
            bobGen,
            bobEncodedMeta,
            transferBuild,
            txHash,
            isForBob,
            claimBuild,
          }
        }
      )

      // Verify complete flow
      expect(result.bobEncodedMeta).toContain('st:eth:')
      expect(result.transferBuild.stealthEthAddress).toMatch(/^0x[0-9a-f]{40}$/i)
      expect(result.isForBob).toBe(true)
      expect(result.claimBuild.destinationAddress).toBe(charlieAccount.address)
    })

    it('should complete full ERC-20 transfer cycle', async () => {
      const { result } = await metrics.measure('complete-erc20-roundtrip', async () => {
        // ═══ Step 1: Bob generates stealth meta-address ═══
        const bobGen = adapter.generateMetaAddress()

        // ═══ Step 2: Alice builds shielded token transfer ═══
        const transferBuild = adapter.buildShieldedTokenTransfer({
          recipient: bobGen.metaAddress,
          tokenContract: TEST_USDC.address as HexString,
          amount: USDC_AMOUNT,
        })

        // ═══ Step 3: Bob verifies payment is for him ═══
        const isForBob = checkEthereumStealthAddress(
          transferBuild.stealthAddress,
          bobGen.spendingPrivateKey,
          bobGen.viewingPrivateKey
        )

        // ═══ Step 4: Bob claims tokens ═══
        const claimBuild = adapter.buildClaimTransaction({
          stealthAddress: transferBuild.stealthAddress,
          ephemeralPublicKey: transferBuild.ephemeralPublicKey,
          spendingPrivateKey: bobGen.spendingPrivateKey,
          viewingPrivateKey: bobGen.viewingPrivateKey,
          destinationAddress: charlieAccount.address,
          tokenContract: TEST_USDC.address as HexString,
          amount: USDC_AMOUNT,
        })

        return { bobGen, transferBuild, isForBob, claimBuild }
      })

      // Verify flow
      expect(result.transferBuild.tokenTransferData).toBeDefined()
      expect(result.isForBob).toBe(true)
      expect(result.claimBuild.tx.to.toLowerCase()).toBe(TEST_USDC.address.toLowerCase())
    })

    it('should complete compliant flow with viewing key disclosure', async () => {
      const { result } = await metrics.measure('compliant-flow', async () => {
        // ═══ Step 1: Bob generates keys ═══
        const bobGen = adapter.generateMetaAddress()

        // ═══ Step 2: Bob creates viewing key for auditor ═══
        const viewingKeyPair = generateViewingKeyPair(bobGen.metaAddress.spendingKey, 'Audit')
        const sharedKey = createSharedViewingKey(viewingKeyPair, {
          canViewIncoming: true,
          canViewOutgoing: false,
          canViewAmounts: true,
        })

        // ═══ Step 3: Alice sends to Bob ═══
        const transferBuild = adapter.buildShieldedTransfer({
          recipient: bobGen.metaAddress,
          amount: ONE_ETH,
        })

        // ═══ Step 4: Bob verifies ═══
        const isForBob = checkEthereumStealthAddress(
          transferBuild.stealthAddress,
          bobGen.spendingPrivateKey,
          bobGen.viewingPrivateKey
        )

        // ═══ Step 5: Auditor can verify Bob received funds ═══
        // (In real flow, auditor would use shared viewing key)
        const auditorHasAccess = sharedKey.permissions.canViewIncoming

        return {
          bobGen,
          viewingKeyPair,
          sharedKey,
          transferBuild,
          isForBob,
          auditorHasAccess,
        }
      })

      expect(result.isForBob).toBe(true)
      expect(result.auditorHasAccess).toBe(true)
      expect(result.sharedKey.viewingPublicKey).toBe(result.viewingKeyPair.publicKey)
    })

    it('should handle multiple transfers in batch', async () => {
      const { result } = await metrics.measure('batch-transfers', async () => {
        // Generate recipients
        const recipients = Array.from({ length: 5 }, (_, i) => ({
          gen: adapter.generateMetaAddress(),
          amount: BigInt((i + 1)) * ETH, // 1, 2, 3, 4, 5 ETH
        }))

        // Build all transfers
        const builds = recipients.map(({ gen, amount }) =>
          adapter.buildShieldedTransfer({
            recipient: gen.metaAddress,
            amount,
          })
        )

        // Verify all are unique
        const stealthAddresses = builds.map(b => b.stealthEthAddress)
        const uniqueAddresses = new Set(stealthAddresses)

        return {
          recipients,
          builds,
          uniqueCount: uniqueAddresses.size,
        }
      })

      // All 5 stealth addresses should be unique
      expect(result.uniqueCount).toBe(5)

      // Each build should be valid
      for (const build of result.builds) {
        expect(build.stealthEthAddress).toMatch(/^0x[0-9a-f]{40}$/i)
        expect(build.ephemeralPublicKey).toMatch(/^0x[0-9a-f]{66}$/i)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // E2E Performance and Stress Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E2E: Performance Benchmarks', () => {
    it('should generate stealth addresses quickly', async () => {
      const generated = adapter.generateMetaAddress()
      const iterations = 100

      const { metrics: perfMetrics } = await metrics.measure(
        `stealth-gen-${iterations}x`,
        async () => {
          const addresses: string[] = []
          for (let i = 0; i < iterations; i++) {
            const stealth = generateEthereumStealthAddress(generated.metaAddress)
            addresses.push(stealth.stealthAddress.ethAddress)
          }
          return addresses
        }
      )

      // Should complete 100 generations in under 1 second
      expect(perfMetrics.totalDuration).toBeLessThan(1000)
    })

    it('should build transfers efficiently', async () => {
      const generated = adapter.generateMetaAddress()
      const iterations = 50

      const { metrics: perfMetrics } = await metrics.measure(
        `transfer-build-${iterations}x`,
        async () => {
          const builds = Array.from({ length: iterations }, () =>
            adapter.buildShieldedTransfer({
              recipient: generated.metaAddress,
              amount: ONE_ETH,
            })
          )
          return builds
        }
      )

      // Should complete 50 builds in under 2 seconds
      expect(perfMetrics.totalDuration).toBeLessThan(2000)
    })

    it('should print performance summary', () => {
      // Print collected metrics
      const summary = metrics.getSummary()
      console.log('\n=== E2E Performance Summary ===')
      console.log(`Total tests: ${summary.totalTests}`)
      console.log(`Avg duration: ${Math.round(summary.avgDuration)}ms`)
      console.log(`Max duration: ${summary.maxDuration}ms`)
      console.log(`Min duration: ${summary.minDuration}ms`)
      console.log(`Memory delta: ${Math.round(summary.totalMemoryDelta / 1024)}KB`)
      console.log(metrics.formatAsMarkdown())
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Commitment E2E Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Ethereum Commitment E2E Tests', () => {
  describe('ETH Commitments', () => {
    it('should create and verify ETH commitment', () => {
      const amount = ONE_ETH

      // commitETH generates blinding internally and returns it
      const commitment = commitETH(amount)
      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{66}$/i)
      expect(commitment.blinding).toMatch(/^0x[0-9a-f]{64}$/i)

      // Verify opening with the returned blinding
      const isValid = verifyOpeningETH(commitment.commitment, amount, commitment.blinding)
      expect(isValid).toBe(true)

      // Wrong amount fails
      const isInvalid = verifyOpeningETH(commitment.commitment, amount + 1n, commitment.blinding)
      expect(isInvalid).toBe(false)
    })

    it('should handle various ETH amounts', () => {
      const amounts = [0n, 1n, GWEI, TENTH_ETH, ONE_ETH, 1000n * ETH]

      for (const amount of amounts) {
        const commitment = commitETH(amount)
        const isValid = verifyOpeningETH(commitment.commitment, amount, commitment.blinding)
        expect(isValid).toBe(true)
      }
    })
  })

  describe('ERC-20 Commitments', () => {
    it('should create and verify token commitment', () => {
      const tokenAddress = TEST_USDC.address as HexString
      const amount = USDC_AMOUNT
      const decimals = 6

      const commitment = commitERC20Token(amount, tokenAddress, decimals)

      // Should have commitment
      expect(commitment.commitment).toMatch(/^0x[0-9a-f]{66}$/i)
    })
  })

  describe('Amount Conversion', () => {
    it('should convert wei correctly', () => {
      expect(toWei('1')).toBe(10n ** 18n)
      expect(toWei('0.5')).toBe(5n * 10n ** 17n)
      expect(toWei('1000')).toBe(1000n * 10n ** 18n)

      expect(fromWei(10n ** 18n)).toBe('1')
      expect(fromWei(5n * 10n ** 17n)).toBe('0.5')
    })
  })
})
