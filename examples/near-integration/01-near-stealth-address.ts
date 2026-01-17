/**
 * 01-near-stealth-address.ts
 *
 * Demonstrates NEAR same-chain privacy using ed25519 stealth addresses.
 *
 * This example shows:
 * 1. Generating NEAR-compatible stealth meta-address
 * 2. Creating one-time stealth addresses
 * 3. Converting to NEAR implicit account format
 * 4. Scanning and key derivation
 *
 * Usage:
 *   npx ts-node examples/near-integration/01-near-stealth-address.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateEd25519StealthAddress,
  checkEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  ed25519PublicKeyToNearAddress,
  encodeStealthMetaAddress,
  type StealthAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: NEAR STEALTH ADDRESSES')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: GENERATE META-ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Generate NEAR-compatible stealth meta-address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate meta-address with ed25519 keys (NEAR native)
  const recipient = generateStealthMetaAddress('near', 'NEAR Privacy Wallet')

  console.log('Meta-address generated:')
  console.log(`  Chain:          ${recipient.metaAddress.chain}`)
  console.log(`  Label:          ${recipient.metaAddress.label}`)
  console.log(`  Spending Key:   ${truncate(recipient.metaAddress.spendingKey)} (32 bytes - ed25519)`)
  console.log(`  Viewing Key:    ${truncate(recipient.metaAddress.viewingKey)} (32 bytes - ed25519)`)
  console.log('')

  // Encode for sharing
  const encoded = encodeStealthMetaAddress(recipient.metaAddress)
  console.log('Shareable meta-address:')
  console.log(`  ${encoded.slice(0, 60)}...`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE STEALTH ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate one-time stealth address for payment')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate stealth address (sender does this)
  const { stealthAddress, sharedSecret } = generateEd25519StealthAddress(recipient.metaAddress)

  console.log('Stealth address generated:')
  console.log(`  Stealth Public:   ${truncate(stealthAddress.address)}`)
  console.log(`  Ephemeral Key:    ${truncate(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:         0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  // Convert to NEAR implicit account
  const nearImplicitAccount = ed25519PublicKeyToNearAddress(stealthAddress.address)

  console.log('NEAR Implicit Account:')
  console.log(`  Address: ${nearImplicitAccount}`)
  console.log(`  Format:  64-char hex (ed25519 public key)`)
  console.log('')

  console.log('What to do:')
  console.log(`  1. Send NEP-141 tokens to: ${nearImplicitAccount}`)
  console.log(`  2. Include ephemeral key in announcement/memo`)
  console.log(`  3. Recipient scans for announcement`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: NEAR ADDRESS FORMATS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Understanding NEAR address formats')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
NEAR supports two account types:

┌─────────────────────────────────────────────────────────────────────────────┐
│  NAMED ACCOUNTS                                                             │
│  - Format: alice.near, mydao.sputnik-dao.near                               │
│  - Must be created on-chain                                                 │
│  - Human-readable                                                           │
│  - NOT suitable for stealth addresses                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  IMPLICIT ACCOUNTS                                                          │
│  - Format: 64-char hex (ed25519 public key)                                 │
│  - Example: ${nearImplicitAccount.slice(0, 20)}...
│  - No on-chain creation needed                                              │
│  - PERFECT for stealth addresses                                            │
└─────────────────────────────────────────────────────────────────────────────┘

SIP uses implicit accounts for stealth addresses because:
  ✓ No on-chain registration required
  ✓ Can receive tokens immediately
  ✓ Private key derivable from stealth mechanism
  ✓ One-time use (unlinkable)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: SCANNING AND CLAIMING
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Recipient scans and claims')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate scanning (recipient checks if this payment is theirs)
  const isOurs = checkEd25519StealthAddress(
    stealthAddress,
    recipient.spendingPrivateKey,
    recipient.viewingPrivateKey
  )

  console.log(`Scanning result: ${isOurs ? '✓ MATCH - Payment is ours!' : '✗ Not ours'}`)
  console.log('')

  if (isOurs) {
    // Derive private key
    const recovery = deriveEd25519StealthPrivateKey(
      stealthAddress,
      recipient.spendingPrivateKey,
      recipient.viewingPrivateKey
    )

    console.log('Private key derived:')
    console.log(`  Stealth Address:  ${truncate(recovery.stealthAddress)}`)
    console.log(`  Private Key:      ${truncate(recovery.privateKey)}`)
    console.log('')

    console.log('To claim tokens:')
    console.log('  1. Import private key into NEAR wallet (or use programmatically)')
    console.log('  2. Fund implicit account with NEAR for gas')
    console.log('  3. Call token.ft_transfer() to move tokens')
    console.log('  4. Or use a meta-transaction relayer')
    console.log('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: NEP-141 TOKEN TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: NEP-141 token transfer pattern')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
To send NEP-141 tokens to a stealth address:

  // Using near-api-js
  import { connect, keyStores, Contract } from 'near-api-js'

  const near = await connect({
    networkId: 'mainnet',
    nodeUrl: 'https://rpc.mainnet.near.org',
    keyStore: new keyStores.InMemoryKeyStore(),
  })

  const account = await near.account('sender.near')

  // Token contract (e.g., USDC)
  const tokenContract = new Contract(account, 'usdc.near', {
    viewMethods: ['ft_balance_of'],
    changeMethods: ['ft_transfer'],
  })

  // Transfer to stealth address (implicit account)
  await tokenContract.ft_transfer({
    receiver_id: '${nearImplicitAccount}',
    amount: '1000000',  // 1 USDC (6 decimals)
    memo: 'SIP:1:${truncate(stealthAddress.ephemeralPublicKey, 16)}:${stealthAddress.viewTag.toString(16).padStart(2, '0')}',
  }, 300000000000000, 1)  // gas, deposit
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('NEAR stealth addresses:')
  console.log('  ✓ Use ed25519 curve (NEAR native)')
  console.log('  ✓ Compatible with implicit accounts')
  console.log('  ✓ No on-chain registration needed')
  console.log('  ✓ Support any NEP-141 token')
  console.log('')
  console.log('Privacy achieved:')
  console.log('  ✓ One-time addresses (unlinkable)')
  console.log('  ✓ Only recipient can identify payments')
  console.log('  ✓ No link between payments and meta-address')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 02-cross-chain-swap.ts for NEAR Intents')
  console.log('  2. See 03-near-wallet-integration.ts for wallet patterns')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
