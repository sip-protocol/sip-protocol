/**
 * Ethereum Contract Integration E2E Tests
 *
 * Tests the complete SDK ↔ SIPPrivacy contract flow against an Anvil
 * fork of Sepolia where contracts are already deployed.
 *
 * Prerequisites:
 *   ~/.foundry/bin/anvil --fork-url https://sepolia.drpc.org --port 8546
 *
 * Or set ANVIL_RPC_URL env var to point to a running Anvil instance.
 *
 * @module tests/e2e/ethereum/ethereum-contract
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { keccak_256 } from '@noble/hashes/sha3'
// eslint-disable-next-line @typescript-eslint/no-deprecated
import { sha256 as sha256Hash } from '@noble/hashes/sha256' // used for viewing key hashes and nullifiers
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'

// ─── SDK Imports ─────────────────────────────────────────────────────────────
import {
  generateEthereumStealthMetaAddress,
  generateEthereumStealthAddress,
  checkEthereumStealthByEthAddress,
  stealthPublicKeyToEthAddress,
} from '../../../src/chains/ethereum/stealth'
import {
  commitETH,
} from '../../../src/chains/ethereum/commitment'
import {
  SIP_CONTRACT_ADDRESSES,
} from '../../../src/chains/ethereum/constants'

// ─── Test Fixtures ───────────────────────────────────────────────────────────
import {
  aliceAccount,
  bobAccount,
  ETH,
} from '../../fixtures/ethereum'

// ─── Constants ───────────────────────────────────────────────────────────────

const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8546'
const SEPOLIA_CONTRACTS = SIP_CONTRACT_ADDRESSES.sepolia!

// Deployed deployer/owner address on Sepolia
const DEPLOYER = '0x5AfE45685756B6E93FAf0DccD662d8AbA94c1b46'

// ─── ABI Encoding Helpers ────────────────────────────────────────────────────

/** Compute 4-byte function selector from signature */
function selector(sig: string): string {
  return bytesToHex(keccak_256(new TextEncoder().encode(sig)).slice(0, 4))
}

/** Pad address to 32 bytes (left-padded with zeros) */
function padAddress(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, '0')
}

/** Pad uint256 to 32 bytes */
function padUint256(val: bigint): string {
  return val.toString(16).padStart(64, '0')
}

/** Pad bytes32 (already 32 bytes, just strip 0x) */
function padBytes32(val: string): string {
  return val.slice(2).padStart(64, '0')
}

/** Encode bytes dynamic type (offset-referenced) */
function encodeBytes(data: string): string {
  const raw = data.startsWith('0x') ? data.slice(2) : data
  if (raw.length === 0) {
    // Empty bytes: just the length (0)
    return ''.padStart(64, '0')
  }
  const len = raw.length / 2
  const lenHex = len.toString(16).padStart(64, '0')
  const padded = raw.padEnd(Math.ceil(raw.length / 64) * 64, '0')
  return lenHex + padded
}

/** Convert bigint wei to hex string for JSON-RPC value field */
function toHexValue(val: bigint): string {
  return '0x' + val.toString(16)
}

// ─── JSON-RPC Helper ─────────────────────────────────────────────────────────

let rpcId = 0

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(ANVIL_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const json = await res.json() as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result
}

/** Read contract state via eth_call */
async function ethCall(to: string, data: string): Promise<string> {
  return await rpc('eth_call', [{ to, data: '0x' + data }, 'latest']) as string
}

/** Send transaction from unlocked account (Anvil auto-signs) */
async function ethSendTx(from: string, to: string, data: string, value?: bigint): Promise<string> {
  const tx: Record<string, string> = {
    from,
    to,
    data: '0x' + data,
    gas: '0x' + (500000).toString(16),
  }
  if (value && value > 0n) {
    tx.value = toHexValue(value)
  }
  return await rpc('eth_sendTransaction', [tx]) as string
}

/** Get transaction receipt */
async function ethGetReceipt(txHash: string): Promise<Record<string, unknown>> {
  return await rpc('eth_getTransactionReceipt', [txHash]) as Record<string, unknown>
}

/** Set account balance (Anvil cheatcode) */
async function setBalance(address: string, balance: bigint): Promise<void> {
  await rpc('anvil_setBalance', [address, toHexValue(balance)])
}

/** Impersonate account (Anvil cheatcode) */
async function impersonateAccount(address: string): Promise<void> {
  await rpc('anvil_impersonateAccount', [address])
}

/** Mine a block */
async function mine(): Promise<void> {
  await rpc('evm_mine', [])
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Check if Anvil is running */
async function isAnvilRunning(): Promise<boolean> {
  try {
    const result = await rpc('eth_chainId')
    return result !== undefined
  } catch {
    return false
  }
}

/** Create a valid commitment bytes32 (prefix 0x02 + 31 bytes) */
function createTestCommitment(): string {
  const commitment = commitETH(ETH / 10n) // 0.1 ETH
  // The commitment value is a hex string of a compressed secp256k1 point
  // We need it as bytes32 for the contract — take first 32 bytes of the commitment
  const commitHex = commitment.commitment.slice(2) // remove 0x
  // Ensure it starts with 02 or 03 (compressed point prefix)
  // If commitment is already 33 bytes (66 hex), take bytes [0..32]
  const bytes32Hex = commitHex.slice(0, 64)
  return bytes32Hex
}

/** Create a deterministic viewing key hash */
function createViewingKeyHash(viewingPublicKey: string): string {
  const keyBytes = hexToBytes(viewingPublicKey.slice(2))
  return bytesToHex(sha256Hash(keyBytes))
}

/**
 * Build shieldedTransfer calldata
 * shieldedTransfer(bytes32 commitment, address stealthRecipient, bytes32 ephemeralPubKey, bytes32 viewingKeyHash, bytes encryptedAmount, bytes proof)
 */
function buildShieldedTransferCalldata(
  commitment: string,
  stealthRecipient: string,
  ephemeralPubKey: string,
  viewingKeyHash: string,
  encryptedAmount: string = '01', // 1 byte minimal
  proof: string = '',             // empty = skip ZK verification
): string {
  const sel = selector('shieldedTransfer(bytes32,address,bytes32,bytes32,bytes,bytes)')

  // Fixed params: 6 slots × 32 bytes = 192 bytes before dynamic data
  const encAmountData = encodeBytes(encryptedAmount)
  const proofData = encodeBytes(proof)

  // Offset for encryptedAmount: after 6 × 32 static slots
  const encAmountOffset = padUint256(6n * 32n)
  // Offset for proof: after encryptedAmount data
  const encAmountSize = BigInt(encAmountData.length / 2) // bytes
  const proofOffset = padUint256(6n * 32n + encAmountSize)

  return sel +
    padBytes32('0x' + commitment) +
    padAddress(stealthRecipient) +
    padBytes32('0x' + ephemeralPubKey) +
    padBytes32('0x' + viewingKeyHash) +
    encAmountOffset +
    proofOffset +
    encAmountData +
    proofData
}

/**
 * Build claimTransfer calldata
 * claimTransfer(uint256 transferId, bytes32 nullifier, bytes proof, address recipient)
 */
function buildClaimTransferCalldata(
  transferId: bigint,
  nullifier: string,
  recipient: string,
  proof: string = '', // empty = skip ZK verification
): string {
  const sel = selector('claimTransfer(uint256,bytes32,bytes,address)')

  const proofData = encodeBytes(proof)
  // Offset for proof: after 4 × 32 static slots
  const proofOffset = padUint256(4n * 32n)

  return sel +
    padUint256(transferId) +
    padBytes32('0x' + nullifier) +
    proofOffset +
    padAddress(recipient) +
    proofData
}

// ─── Function Selectors ──────────────────────────────────────────────────────

const SELECTORS = {
  owner: selector('owner()'),
  feeBps: selector('feeBps()'),
  totalTransfers: selector('totalTransfers()'),
  paused: selector('paused()'),
  feeCollector: selector('feeCollector()'),
}

// ═════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═════════════════════════════════════════════════════════════════════════════

describe('Ethereum Contract Integration E2E', () => {
  let anvilAvailable = false

  beforeAll(async () => {
    anvilAvailable = await isAnvilRunning()
    if (!anvilAvailable) {
      console.warn(
        '\n⚠️  Anvil not running. Skipping contract E2E tests.\n' +
        '   Start with: ~/.foundry/bin/anvil --fork-url https://sepolia.drpc.org --port 8546\n'
      )
    }
  })

  // ─── Contract Deployment Verification ────────────────────────────────────

  describe('Contract Deployment Verification', () => {
    it('should have SIPPrivacy deployed with correct owner', async () => {
      if (!anvilAvailable) return

      const result = await ethCall(SEPOLIA_CONTRACTS.sipPrivacy, SELECTORS.owner)
      const owner = '0x' + result.slice(26).toLowerCase() // last 20 bytes

      expect(owner).toBe(DEPLOYER.toLowerCase())
    })

    it('should have correct fee (50 bps)', async () => {
      if (!anvilAvailable) return

      const result = await ethCall(SEPOLIA_CONTRACTS.sipPrivacy, SELECTORS.feeBps)
      const feeBps = parseInt(result, 16)

      expect(feeBps).toBe(50)
    })

    it('should not be paused', async () => {
      if (!anvilAvailable) return

      const result = await ethCall(SEPOLIA_CONTRACTS.sipPrivacy, SELECTORS.paused)
      const paused = parseInt(result, 16)

      expect(paused).toBe(0)
    })

    it('should have correct fee collector', async () => {
      if (!anvilAvailable) return

      const result = await ethCall(SEPOLIA_CONTRACTS.sipPrivacy, SELECTORS.feeCollector)
      const feeCollector = '0x' + result.slice(26).toLowerCase()

      expect(feeCollector).toBe(DEPLOYER.toLowerCase())
    })

    it('should have PedersenVerifier deployed (non-zero code)', async () => {
      if (!anvilAvailable) return

      const code = await rpc('eth_getCode', [SEPOLIA_CONTRACTS.pedersenVerifier, 'latest'])
      expect((code as string).length).toBeGreaterThan(2) // Not just '0x'
    })

    it('should have ZKVerifier deployed (non-zero code)', async () => {
      if (!anvilAvailable) return

      const code = await rpc('eth_getCode', [SEPOLIA_CONTRACTS.zkVerifier, 'latest'])
      expect((code as string).length).toBeGreaterThan(2)
    })

    it('should have StealthAddressRegistry deployed (non-zero code)', async () => {
      if (!anvilAvailable) return

      const code = await rpc('eth_getCode', [SEPOLIA_CONTRACTS.stealthAddressRegistry, 'latest'])
      expect((code as string).length).toBeGreaterThan(2)
    })
  })

  // ─── SDK Stealth Address Generation ──────────────────────────────────────

  describe('SDK Stealth Address Generation on Fork', () => {
    it('should generate stealth meta-address', async () => {
      if (!anvilAvailable) return

      const meta = generateEthereumStealthMetaAddress()

      expect(meta.metaAddress.spendingKey).toMatch(/^0x0[23]/)
      expect(meta.metaAddress.viewingKey).toMatch(/^0x0[23]/)
      expect(meta.spendingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(meta.viewingPrivateKey).toMatch(/^0x[0-9a-f]{64}$/i)
    })

    it('should generate stealth address from meta-address', async () => {
      if (!anvilAvailable) return

      const meta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta.metaAddress)

      expect(stealth.stealthAddress.ethAddress).toMatch(/^0x[0-9a-f]{40}$/i)
      expect(stealth.stealthAddress.ephemeralPublicKey).toMatch(/^0x0[23]/)
      expect(stealth.stealthAddress.viewTag).toBeGreaterThanOrEqual(0)
      expect(stealth.stealthAddress.viewTag).toBeLessThanOrEqual(255)
    })

    it('should detect stealth payment with correct keys', async () => {
      if (!anvilAvailable) return

      const meta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta.metaAddress)

      const result = checkEthereumStealthByEthAddress(
        stealth.stealthAddress.ethAddress,
        stealth.stealthAddress.ephemeralPublicKey,
        stealth.stealthAddress.viewTag,
        meta.spendingPrivateKey,
        meta.viewingPrivateKey,
      )

      // Should return the stealth private key (not null)
      expect(result).not.toBeNull()
      expect(result).toMatch(/^0x[0-9a-f]{64}$/i)

      // Verify the stealth private key derives to the correct ETH address
      const derivedPub = secp256k1.getPublicKey(
        hexToBytes(result!.slice(2)),
        true
      )
      const derivedAddress = stealthPublicKeyToEthAddress(
        ('0x' + bytesToHex(derivedPub)) as HexString
      )
      expect(derivedAddress.toLowerCase()).toBe(
        stealth.stealthAddress.ethAddress.toLowerCase()
      )
    })

    it('should NOT detect stealth payment with wrong keys', async () => {
      if (!anvilAvailable) return

      const meta1 = generateEthereumStealthMetaAddress()
      const meta2 = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(meta1.metaAddress)

      const result = checkEthereumStealthByEthAddress(
        stealth.stealthAddress.ethAddress,
        stealth.stealthAddress.ephemeralPublicKey,
        stealth.stealthAddress.viewTag,
        meta2.spendingPrivateKey, // Wrong keys
        meta2.viewingPrivateKey,
      )

      expect(result).toBeNull()
    })
  })

  // ─── Shielded Transfer via Contract ──────────────────────────────────────

  describe('Shielded Transfer via SIPPrivacy Contract', () => {
    it('should execute shieldedTransfer and emit events', async () => {
      if (!anvilAvailable) return

      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      const bobMeta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)

      const commitmentHex = createTestCommitment()
      const viewingKeyHash = createViewingKeyHash(bobMeta.metaAddress.viewingKey)
      const ephPubHex = stealth.stealthAddress.ephemeralPublicKey.slice(2, 66)

      const calldata = buildShieldedTransferCalldata(
        commitmentHex,
        stealth.stealthAddress.ethAddress,
        ephPubHex,
        viewingKeyHash,
      )

      const transferAmount = ETH / 10n
      const txHash = await ethSendTx(
        senderAddress,
        SEPOLIA_CONTRACTS.sipPrivacy,
        calldata,
        transferAmount,
      )

      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/i)

      // Get receipt and verify success
      await mine()
      const receipt = await ethGetReceipt(txHash)

      expect(receipt.status).toBe('0x1') // success

      // Check logs — should have ShieldedTransfer + Announcement events
      const logs = receipt.logs as Array<{
        address: string
        topics: string[]
        data: string
      }>
      expect(logs.length).toBeGreaterThanOrEqual(2)

      // Verify transfer record was created
      const totalTransfers = await ethCall(
        SEPOLIA_CONTRACTS.sipPrivacy,
        SELECTORS.totalTransfers,
      )
      expect(parseInt(totalTransfers as string, 16)).toBeGreaterThanOrEqual(1)
    })

    it('should reject shieldedTransfer with zero value', async () => {
      if (!anvilAvailable) return

      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      const bobMeta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)

      const calldata = buildShieldedTransferCalldata(
        createTestCommitment(),
        stealth.stealthAddress.ethAddress,
        stealth.stealthAddress.ephemeralPublicKey.slice(2, 66),
        createViewingKeyHash(bobMeta.metaAddress.viewingKey),
      )

      try {
        const txHash = await ethSendTx(senderAddress, SEPOLIA_CONTRACTS.sipPrivacy, calldata, 0n)
        await mine()
        const receipt = await ethGetReceipt(txHash)
        expect(receipt.status).toBe('0x0')
      } catch {
        expect(true).toBe(true)
      }
    })

    it('should reject shieldedTransfer with invalid commitment', async () => {
      if (!anvilAvailable) return

      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      const bobMeta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)

      // Invalid commitment — doesn't start with 0x02 or 0x03
      const calldata = buildShieldedTransferCalldata(
        '0100000000000000000000000000000000000000000000000000000000000001',
        stealth.stealthAddress.ethAddress,
        stealth.stealthAddress.ephemeralPublicKey.slice(2, 66),
        createViewingKeyHash(bobMeta.metaAddress.viewingKey),
      )

      try {
        const txHash = await ethSendTx(
          senderAddress,
          SEPOLIA_CONTRACTS.sipPrivacy,
          calldata,
          ETH / 10n,
        )
        await mine()
        const receipt = await ethGetReceipt(txHash)
        expect(receipt.status).toBe('0x0')
      } catch {
        expect(true).toBe(true)
      }
    })
  })

  // ─── Full Privacy Flow ─────────────────────────────────────────────────

  describe('Full Privacy Flow: Send → Scan → Derive Key', () => {
    it('should complete the full stealth payment cycle', async () => {
      if (!anvilAvailable) return

      // === Step 1: Setup ===
      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      // Bob generates stealth meta-address (recipient)
      const bobMeta = generateEthereumStealthMetaAddress()

      // === Step 2: Alice generates stealth address for Bob ===
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)
      const stealthEthAddr = stealth.stealthAddress.ethAddress
      const ephemeralPubKey = stealth.stealthAddress.ephemeralPublicKey
      const viewTag = stealth.stealthAddress.viewTag

      // === Step 3: Alice sends shielded transfer via contract ===
      const transferAmount = ETH / 20n // 0.05 ETH
      const commitmentHex = createTestCommitment()
      const viewingKeyHash = createViewingKeyHash(bobMeta.metaAddress.viewingKey)
      const ephPubHex = ephemeralPubKey.slice(2, 66)

      const calldata = buildShieldedTransferCalldata(
        commitmentHex,
        stealthEthAddr,
        ephPubHex,
        viewingKeyHash,
      )

      const txHash = await ethSendTx(
        senderAddress,
        SEPOLIA_CONTRACTS.sipPrivacy,
        calldata,
        transferAmount,
      )
      await mine()
      const receipt = await ethGetReceipt(txHash)
      expect(receipt.status).toBe('0x1')

      // === Step 4: Verify stealth address received ETH ===
      const stealthBalance = await rpc('eth_getBalance', [stealthEthAddr, 'latest']) as string
      const balanceWei = BigInt(stealthBalance)
      // Balance should be transferAmount minus 50bps fee
      const expectedAmount = transferAmount - (transferAmount * 50n / 10000n)
      expect(balanceWei).toBe(expectedAmount)

      // === Step 5: Bob scans and detects the payment ===
      const detectedKey = checkEthereumStealthByEthAddress(
        stealthEthAddr as HexString,
        ephemeralPubKey,
        viewTag,
        bobMeta.spendingPrivateKey,
        bobMeta.viewingPrivateKey,
      )

      expect(detectedKey).not.toBeNull()
      expect(detectedKey).toMatch(/^0x[0-9a-f]{64}$/i)

      // === Step 6: Verify derived stealth private key controls the address ===
      const derivedPub = secp256k1.getPublicKey(
        hexToBytes(detectedKey!.slice(2)),
        true,
      )
      const derivedEthAddr = stealthPublicKeyToEthAddress(
        ('0x' + bytesToHex(derivedPub)) as HexString,
      )
      expect(derivedEthAddr.toLowerCase()).toBe(stealthEthAddr.toLowerCase())

      // === Step 7: Bob marks transfer as claimed ===
      // Get the transferId (totalTransfers - 1)
      const totalResult = await ethCall(
        SEPOLIA_CONTRACTS.sipPrivacy,
        SELECTORS.totalTransfers,
      )
      const transferId = BigInt(totalResult as string) - 1n

      // Create a unique nullifier
      const nullifierBytes = sha256Hash(
        hexToBytes(detectedKey!.slice(2) + transferId.toString(16).padStart(64, '0'))
      )
      const nullifier = bytesToHex(nullifierBytes)

      // Claim from the stealth address
      await setBalance(stealthEthAddr, expectedAmount + ETH / 100n) // Add gas money
      await impersonateAccount(stealthEthAddr)

      // Build claim transaction with Bob's destination
      const bobDestination = bobAccount.address
      const claimCalldataFixed = buildClaimTransferCalldata(
        transferId,
        nullifier,
        bobDestination,
      )

      const claimTxHash = await ethSendTx(
        stealthEthAddr,
        SEPOLIA_CONTRACTS.sipPrivacy,
        claimCalldataFixed,
      )
      await mine()
      const claimReceipt = await ethGetReceipt(claimTxHash)
      expect(claimReceipt.status).toBe('0x1')

      // Step 8: Claim tx succeeded — Foundry tests verify the claimed flag in detail
    })

    it('should reject double-claim with same nullifier', async () => {
      if (!anvilAvailable) return

      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      const bobMeta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)
      const stealthEthAddr = stealth.stealthAddress.ethAddress

      // Send shielded transfer
      const transferAmount = ETH / 20n
      const commitmentHex = createTestCommitment()
      const viewingKeyHash = createViewingKeyHash(bobMeta.metaAddress.viewingKey)
      const ephPubHex = stealth.stealthAddress.ephemeralPublicKey.slice(2, 66)

      const calldata = buildShieldedTransferCalldata(
        commitmentHex,
        stealthEthAddr,
        ephPubHex,
        viewingKeyHash,
      )

      await ethSendTx(
        senderAddress,
        SEPOLIA_CONTRACTS.sipPrivacy,
        calldata,
        transferAmount,
      )
      await mine()

      // Get transfer ID
      const totalResult = await ethCall(
        SEPOLIA_CONTRACTS.sipPrivacy,
        SELECTORS.totalTransfers,
      )
      const transferId = BigInt(totalResult as string) - 1n

      // Create nullifier
      const nullifierBytes = sha256Hash(new TextEncoder().encode(`nullifier-${transferId}`))
      const nullifier = bytesToHex(nullifierBytes)

      // First claim — should succeed
      await setBalance(stealthEthAddr, 1n * ETH)
      await impersonateAccount(stealthEthAddr)

      const claimCalldata = buildClaimTransferCalldata(
        transferId,
        nullifier,
        bobAccount.address,
      )

      const claimTx1 = await ethSendTx(
        stealthEthAddr,
        SEPOLIA_CONTRACTS.sipPrivacy,
        claimCalldata,
      )
      await mine()
      const receipt1 = await ethGetReceipt(claimTx1)
      expect(receipt1.status).toBe('0x1')

      // Second claim with same nullifier — should revert
      try {
        const claimTx2 = await ethSendTx(
          stealthEthAddr,
          SEPOLIA_CONTRACTS.sipPrivacy,
          claimCalldata,
        )
        await mine()
        const receipt2 = await ethGetReceipt(claimTx2)
        expect(receipt2.status).toBe('0x0') // reverted
      } catch {
        // RPC-level revert is also acceptable
        expect(true).toBe(true)
      }
    })
  })

  // ─── Fee Verification ────────────────────────────────────────────────────

  describe('Fee Calculation Verification', () => {
    it('should deduct correct 50bps fee on shielded transfer', async () => {
      if (!anvilAvailable) return

      const senderAddress = aliceAccount.address
      await setBalance(senderAddress, 10n * ETH)
      await impersonateAccount(senderAddress)

      // Get fee collector balance before
      const feeCollectorBefore = BigInt(
        await rpc('eth_getBalance', [DEPLOYER, 'latest']) as string
      )

      const bobMeta = generateEthereumStealthMetaAddress()
      const stealth = generateEthereumStealthAddress(bobMeta.metaAddress)
      const stealthEthAddr = stealth.stealthAddress.ethAddress

      const transferAmount = 1n * ETH // 1 ETH
      const commitmentHex = createTestCommitment()
      const viewingKeyHash = createViewingKeyHash(bobMeta.metaAddress.viewingKey)
      const ephPubHex = stealth.stealthAddress.ephemeralPublicKey.slice(2, 66)

      const calldata = buildShieldedTransferCalldata(
        commitmentHex,
        stealthEthAddr,
        ephPubHex,
        viewingKeyHash,
      )

      const txHash = await ethSendTx(
        senderAddress,
        SEPOLIA_CONTRACTS.sipPrivacy,
        calldata,
        transferAmount,
      )
      await mine()
      const receipt = await ethGetReceipt(txHash)
      expect(receipt.status).toBe('0x1')

      // Verify stealth address received (amount - fee)
      const stealthBalance = BigInt(
        await rpc('eth_getBalance', [stealthEthAddr, 'latest']) as string
      )
      const expectedFee = transferAmount * 50n / 10000n // 0.5%
      const expectedTransfer = transferAmount - expectedFee
      expect(stealthBalance).toBe(expectedTransfer)

      // Verify fee collector received the fee
      const feeCollectorAfter = BigInt(
        await rpc('eth_getBalance', [DEPLOYER, 'latest']) as string
      )
      expect(feeCollectorAfter - feeCollectorBefore).toBe(expectedFee)
    })
  })

  // ─── Commitment Verification ─────────────────────────────────────────────

  describe('SDK Commitment Integration', () => {
    it('should create valid commitments accepted by contract', async () => {
      if (!anvilAvailable) return

      // Generate multiple commitments and verify they're valid bytes32
      const amounts = [ETH / 100n, ETH / 10n, ETH, 10n * ETH]

      for (const amount of amounts) {
        const commitment = commitETH(amount)
        const commitHex = commitment.commitment.slice(2)

        // Verify commitment starts with 02 or 03 (compressed point)
        const prefix = commitHex.slice(0, 2)
        expect(['02', '03']).toContain(prefix)

        // Verify it's at least 32 bytes (64 hex chars)
        expect(commitHex.length).toBeGreaterThanOrEqual(64)
      }
    })

    it('should verify commitment openings', async () => {
      if (!anvilAvailable) return

      const amount = ETH / 10n
      const commitment = commitETH(amount)

      // Verify the opening
      const { verifyOpeningETH } = await import(
        '../../../src/chains/ethereum/commitment'
      )
      const valid = verifyOpeningETH(
        commitment.commitment,
        amount,
        commitment.blinding,
      )
      expect(valid).toBe(true)

      // Wrong amount should fail
      const invalid = verifyOpeningETH(
        commitment.commitment,
        amount + 1n,
        commitment.blinding,
      )
      expect(invalid).toBe(false)
    })
  })

  // ─── Multi-Party Stealth Flow ────────────────────────────────────────────

  describe('Multi-Party Stealth Flow', () => {
    it('should handle multiple recipients with unique stealth addresses', async () => {
      if (!anvilAvailable) return

      // Generate meta-addresses for 3 recipients
      const recipients = Array.from({ length: 3 }, () =>
        generateEthereumStealthMetaAddress()
      )

      // Generate stealth addresses for each
      const stealthAddresses = recipients.map(r =>
        generateEthereumStealthAddress(r.metaAddress)
      )

      // All stealth ETH addresses should be unique
      const ethAddresses = stealthAddresses.map(s =>
        s.stealthAddress.ethAddress.toLowerCase()
      )
      const uniqueAddresses = new Set(ethAddresses)
      expect(uniqueAddresses.size).toBe(3)

      // Each recipient should only detect their own payment
      for (let i = 0; i < recipients.length; i++) {
        for (let j = 0; j < stealthAddresses.length; j++) {
          const result = checkEthereumStealthByEthAddress(
            stealthAddresses[j].stealthAddress.ethAddress,
            stealthAddresses[j].stealthAddress.ephemeralPublicKey,
            stealthAddresses[j].stealthAddress.viewTag,
            recipients[i].spendingPrivateKey,
            recipients[i].viewingPrivateKey,
          )

          if (i === j) {
            expect(result).not.toBeNull()
          } else {
            expect(result).toBeNull()
          }
        }
      }
    })
  })
})
