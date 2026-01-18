/**
 * NEAR Test Accounts and Keypairs
 *
 * Pre-generated test accounts for deterministic testing.
 * These are testnet-only accounts - never use on mainnet.
 */

import { generateEd25519StealthMetaAddress, generateEd25519StealthAddress } from '../../../src/stealth'
import type { HexString, StealthMetaAddress } from '@sip-protocol/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NEARTestAccount {
  /** Account ID (named or implicit) */
  accountId: string
  /** ed25519 public key (hex with 0x prefix) */
  publicKey: HexString
  /** ed25519 private key (hex with 0x prefix) */
  privateKey: HexString
  /** NEAR public key format (ed25519:base58) */
  nearPublicKey: string
  /** Account balance in yoctoNEAR */
  balance: string
}

export interface NEARStealthTestAccount extends NEARTestAccount {
  /** Spending public key */
  spendingPublicKey: HexString
  /** Spending private key */
  spendingPrivateKey: HexString
  /** Viewing public key */
  viewingPublicKey: HexString
  /** Viewing private key */
  viewingPrivateKey: HexString
  /** Full stealth meta-address */
  metaAddress: StealthMetaAddress
}

// ─── Test Accounts ────────────────────────────────────────────────────────────

/**
 * Alice - Primary sender account (named account)
 */
export const aliceAccount: NEARTestAccount = {
  accountId: 'alice.testnet',
  publicKey: '0x3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29' as HexString,
  privateKey: '0x9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60' as HexString,
  nearPublicKey: 'ed25519:4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi',
  balance: '100000000000000000000000000', // 100 NEAR
}

/**
 * Bob - Primary recipient account (named account)
 */
export const bobAccount: NEARTestAccount = {
  accountId: 'bob.testnet',
  publicKey: '0xfc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025' as HexString,
  privateKey: '0x1c1e69523d2b16d00ffe1ad2c9e7a2e68e8b6a57b2d0e9b5c1d3a8f4e6b7c0d2' as HexString,
  nearPublicKey: 'ed25519:HpVdHS3VqNGrTeFHnjJtFzkAZ8wGPu5NbgT4qABzYyc',
  balance: '50000000000000000000000000', // 50 NEAR
}

/**
 * Charlie - Secondary recipient (implicit account)
 */
export const charlieAccount: NEARTestAccount = {
  accountId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  publicKey: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' as HexString,
  privateKey: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c' as HexString,
  nearPublicKey: 'ed25519:BWDv1tYhvMYsMy1KGgKqH6UfCtLvJgPJQUwY4rpXXGy',
  balance: '10000000000000000000000000', // 10 NEAR
}

/**
 * Auditor - Compliance/audit account
 */
export const auditorAccount: NEARTestAccount = {
  accountId: 'auditor.testnet',
  publicKey: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5' as HexString,
  privateKey: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d' as HexString,
  nearPublicKey: 'ed25519:FjxPrY6QvGCN7nRhWZuDzJ3DqLKjvN8pXK9qEpPfBJk',
  balance: '5000000000000000000000000', // 5 NEAR
}

/**
 * Solver - Intent solver/relayer account
 */
export const solverAccount: NEARTestAccount = {
  accountId: 'solver.near-intents.testnet',
  publicKey: '0xe5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6' as HexString,
  privateKey: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e' as HexString,
  nearPublicKey: 'ed25519:GkxQsY7hX8dN8rYiZwEuKzL4DsLMoP9qYL0sRqRgCLm',
  balance: '1000000000000000000000000000', // 1000 NEAR
}

// ─── Stealth Accounts ─────────────────────────────────────────────────────────

/**
 * Generate a stealth-enabled test account
 */
export function generateStealthTestAccount(
  _baseName: string,
  balance = '50000000000000000000000000'
): NEARStealthTestAccount {
  const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
    generateEd25519StealthMetaAddress('near')

  // Extract public keys from meta-address
  const spendingPublicKey = metaAddress.spendingKey
  const viewingPublicKey = metaAddress.viewingKey

  // Derive implicit account ID from spending public key
  const accountId = spendingPublicKey.slice(2).toLowerCase()

  return {
    accountId,
    publicKey: spendingPublicKey,
    privateKey: spendingPrivateKey,
    nearPublicKey: `ed25519:${Buffer.from(spendingPublicKey.slice(2), 'hex').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`,
    balance,
    spendingPublicKey,
    spendingPrivateKey,
    viewingPublicKey,
    viewingPrivateKey,
    metaAddress,
  }
}

/**
 * Pre-generated stealth account for Alice
 */
export const aliceStealthAccount: NEARStealthTestAccount = (() => {
  const account = generateStealthTestAccount('alice-stealth')
  return {
    ...account,
    balance: '100000000000000000000000000', // 100 NEAR
  }
})()

/**
 * Pre-generated stealth account for Bob
 */
export const bobStealthAccount: NEARStealthTestAccount = (() => {
  const account = generateStealthTestAccount('bob-stealth')
  return {
    ...account,
    balance: '50000000000000000000000000', // 50 NEAR
  }
})()

// ─── Account Collections ──────────────────────────────────────────────────────

export const testAccounts = {
  alice: aliceAccount,
  bob: bobAccount,
  charlie: charlieAccount,
  auditor: auditorAccount,
  solver: solverAccount,
}

export const stealthAccounts = {
  alice: aliceStealthAccount,
  bob: bobStealthAccount,
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Generate a batch of test accounts
 */
export function generateTestAccounts(count: number, balancePerAccount = '10000000000000000000000000'): NEARTestAccount[] {
  const accounts: NEARTestAccount[] = []

  for (let i = 0; i < count; i++) {
    const { metaAddress, spendingPrivateKey } = generateEd25519StealthMetaAddress('near')
    const spendingPublicKey = metaAddress.spendingKey
    const accountId = spendingPublicKey.slice(2).toLowerCase()

    accounts.push({
      accountId,
      publicKey: spendingPublicKey,
      privateKey: spendingPrivateKey,
      nearPublicKey: `ed25519:test${i}`,
      balance: balancePerAccount,
    })
  }

  return accounts
}

/**
 * Generate stealth address for recipient
 */
export function generateStealthAddressForRecipient(
  recipientMetaAddress: StealthMetaAddress
) {
  return generateEd25519StealthAddress(recipientMetaAddress)
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** One yoctoNEAR */
export const YOCTO_NEAR = '1'

/** One NEAR in yoctoNEAR */
export const ONE_NEAR = '1000000000000000000000000'

/** Storage cost per byte in yoctoNEAR */
export const STORAGE_COST_PER_BYTE = '10000000000000000000' // 0.00001 NEAR

/** Minimum account balance */
export const MIN_ACCOUNT_BALANCE = '100000000000000000000000' // 0.0001 NEAR

/** Gas for basic transaction */
export const BASIC_GAS = '30000000000000' // 30 TGas

/** Gas for contract call */
export const CONTRACT_CALL_GAS = '100000000000000' // 100 TGas
