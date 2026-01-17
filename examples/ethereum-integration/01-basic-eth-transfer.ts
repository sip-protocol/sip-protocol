/**
 * 01-basic-eth-transfer.ts
 *
 * Demonstrates sending ETH to a stealth address on Ethereum.
 *
 * This example shows:
 * 1. Generating an Ethereum-compatible stealth meta-address
 * 2. Creating a one-time stealth address
 * 3. Converting to Ethereum address format
 * 4. Preparing the ETH transfer
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/01-basic-eth-transfer.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
  encodeStealthMetaAddress,
  type StealthMetaAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

// Amount to transfer (in wei)
const TRANSFER_AMOUNT = 100_000_000_000_000_000n // 0.1 ETH

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: BASIC ETH TRANSFER')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: RECIPIENT GENERATES META-ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Recipient generates stealth meta-address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate Ethereum-compatible meta-address (secp256k1)
  const recipient = generateStealthMetaAddress('ethereum', 'ETH Privacy Wallet')

  console.log('Meta-address generated:')
  console.log(`  Chain:          ${recipient.metaAddress.chain}`)
  console.log(`  Label:          ${recipient.metaAddress.label}`)
  console.log(`  Spending Key:   ${truncate(recipient.metaAddress.spendingKey)} (33 bytes - secp256k1)`)
  console.log(`  Viewing Key:    ${truncate(recipient.metaAddress.viewingKey)} (33 bytes - secp256k1)`)
  console.log('')

  // Encode for sharing (e.g., in QR code, ENS, or profile)
  const encoded = encodeStealthMetaAddress(recipient.metaAddress)
  console.log('Shareable meta-address:')
  console.log(`  ${encoded.slice(0, 60)}...`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SENDER GENERATES STEALTH ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Sender generates one-time stealth address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Sender generates stealth address from recipient's meta-address
  const { stealthAddress, sharedSecret } = generateStealthAddress(recipient.metaAddress)

  console.log('Stealth address generated:')
  console.log(`  Stealth Public:   ${truncate(stealthAddress.address)}`)
  console.log(`  Ephemeral Key:    ${truncate(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:         0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  // Convert stealth public key to Ethereum address
  const ethStealthAddress = publicKeyToEthAddress(stealthAddress.address)

  console.log('Ethereum Stealth Address:')
  console.log(`  Address: ${ethStealthAddress}`)
  console.log(`  Format:  EIP-55 checksummed address`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: PREPARE ETH TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Prepare ETH transfer transaction')
  console.log('─────────────────────────────────────────────────────────────────')

  // In production, you would use ethers.js, viem, or wallet provider
  const transaction = {
    to: ethStealthAddress,
    value: TRANSFER_AMOUNT,
    // No data field for native ETH transfer
  }

  console.log('Transaction prepared:')
  console.log(`  To:      ${transaction.to}`)
  console.log(`  Value:   ${formatEth(transaction.value)} ETH`)
  console.log('')

  console.log('Using ethers.js:')
  console.log(`
  import { ethers } from 'ethers'

  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  const tx = await signer.sendTransaction({
    to: '${ethStealthAddress}',
    value: ${TRANSFER_AMOUNT}n, // ${formatEth(TRANSFER_AMOUNT)} ETH
  })

  console.log('Transaction sent:', tx.hash)
  await tx.wait()
`)

  console.log('Using viem:')
  console.log(`
  import { createWalletClient, http, parseEther } from 'viem'
  import { mainnet } from 'viem/chains'

  const client = createWalletClient({
    chain: mainnet,
    transport: http(),
  })

  const hash = await client.sendTransaction({
    to: '${ethStealthAddress}',
    value: ${TRANSFER_AMOUNT}n,
  })
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: EMIT ANNOUNCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Emit announcement for recipient')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create announcement data
  const announcement = {
    schemeId: 1, // EIP-5564 scheme ID for secp256k1
    stealthAddress: ethStealthAddress,
    ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    viewTag: stealthAddress.viewTag,
    metadata: '0x' as HexString, // Optional metadata
  }

  console.log('Announcement data:')
  console.log(`  Scheme ID:        ${announcement.schemeId}`)
  console.log(`  Stealth Address:  ${announcement.stealthAddress}`)
  console.log(`  Ephemeral Key:    ${truncate(announcement.ephemeralPublicKey)}`)
  console.log(`  View Tag:         0x${announcement.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  console.log('Emit via SIP Registry contract:')
  console.log(`
  // SIP Registry contract interface
  interface ISIPRegistry {
    announce(
      schemeId: uint256,
      stealthAddress: address,
      ephemeralPubKey: bytes,
      metadata: bytes
    ) external;
  }

  // Emit announcement
  await sipRegistry.announce(
    ${announcement.schemeId},
    '${announcement.stealthAddress}',
    '${announcement.ephemeralPublicKey}',
    '${announcement.metadata}'
  )
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: FLOW OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Complete transfer flow')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Complete ETH transfer with privacy:

┌─────────────────────────────────────────────────────────────────────────────┐
│  1. RECIPIENT SETUP                                                         │
│     - Generate stealth meta-address once                                    │
│     - Share via ENS, profile, QR code, etc.                                 │
│     - Keep spending/viewing private keys secure                             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. SENDER CREATES PAYMENT                                                  │
│     - Parse recipient's stealth meta-address                                │
│     - Generate one-time stealth address                                     │
│     - Convert to Ethereum address format                                    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. SEND & ANNOUNCE                                                         │
│     - Send ETH to stealth address                                           │
│     - Emit announcement (ephemeral key + view tag)                          │
│     - Optionally include in tx data or registry                             │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. RECIPIENT CLAIMS                                                        │
│     - Scan announcements (filter by view tag first)                         │
│     - Derive stealth private key for matches                                │
│     - Claim to main wallet (may need gas funding)                           │
└─────────────────────────────────────────────────────────────────────────────┘
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('ETH stealth transfer:')
  console.log('  ✓ secp256k1 curve (Ethereum native)')
  console.log('  ✓ EIP-55 checksummed addresses')
  console.log('  ✓ Compatible with all EVM wallets')
  console.log('  ✓ Works on any EVM chain')
  console.log('')
  console.log('Privacy achieved:')
  console.log('  ✓ One-time addresses (unlinkable)')
  console.log('  ✓ Only recipient can identify payments')
  console.log('  ✓ No link between payments and meta-address')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 02-erc20-transfer.ts for token transfers')
  console.log('  2. See 03-scan-and-claim.ts for claiming funds')
  console.log('  3. See 05-metamask-integration.ts for wallet integration')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
