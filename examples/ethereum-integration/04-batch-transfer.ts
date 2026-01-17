/**
 * 04-batch-transfer.ts
 *
 * Demonstrates batch transfers to multiple stealth addresses.
 *
 * This example shows:
 * 1. Generating multiple stealth addresses
 * 2. Batch ETH transfers using multicall
 * 3. Batch ERC-20 transfers
 * 4. Gas optimization strategies
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/04-batch-transfer.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
  type StealthMetaAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipient {
  metaAddress: StealthMetaAddress
  label: string
  amount: bigint
}

interface PreparedTransfer {
  label: string
  stealthAddress: string
  ephemeralPublicKey: HexString
  viewTag: number
  amount: bigint
}

// ─── Configuration ────────────────────────────────────────────────────────────

// Example multicall contract (Mainnet Multicall3)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

// USDC on mainnet
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: BATCH PRIVATE TRANSFERS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: PREPARE RECIPIENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Prepare multiple recipients')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate multiple recipients with their meta-addresses
  const recipients: Recipient[] = [
    {
      metaAddress: generateStealthMetaAddress('ethereum', 'Alice').metaAddress,
      label: 'Alice',
      amount: 50_000_000_000_000_000n, // 0.05 ETH
    },
    {
      metaAddress: generateStealthMetaAddress('ethereum', 'Bob').metaAddress,
      label: 'Bob',
      amount: 100_000_000_000_000_000n, // 0.1 ETH
    },
    {
      metaAddress: generateStealthMetaAddress('ethereum', 'Carol').metaAddress,
      label: 'Carol',
      amount: 75_000_000_000_000_000n, // 0.075 ETH
    },
    {
      metaAddress: generateStealthMetaAddress('ethereum', 'Dave').metaAddress,
      label: 'Dave',
      amount: 25_000_000_000_000_000n, // 0.025 ETH
    },
  ]

  console.log('Recipients to pay:')
  for (const r of recipients) {
    console.log(`  ${r.label}: ${formatEth(r.amount)} ETH`)
  }
  console.log('')

  const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0n)
  console.log(`Total: ${formatEth(totalAmount)} ETH`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: GENERATE STEALTH ADDRESSES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Generate stealth addresses for each recipient')
  console.log('─────────────────────────────────────────────────────────────────')

  const preparedTransfers: PreparedTransfer[] = []

  for (const recipient of recipients) {
    const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
    const ethAddress = publicKeyToEthAddress(stealthAddress.address)

    preparedTransfers.push({
      label: recipient.label,
      stealthAddress: ethAddress,
      ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
      viewTag: stealthAddress.viewTag,
      amount: recipient.amount,
    })

    console.log(`  ${recipient.label}:`)
    console.log(`    Stealth Address: ${ethAddress.slice(0, 20)}...`)
    console.log(`    View Tag:        0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: BATCH ETH TRANSFER (MULTICALL)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Batch ETH transfer with Multicall3')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Using Multicall3 for batch ETH transfers:

  import { ethers } from 'ethers'

  const multicall = new ethers.Contract(
    '${MULTICALL3_ADDRESS}',
    [
      'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    ],
    signer
  )

  // Prepare calls (empty calldata for ETH transfer)
  const calls = [
${preparedTransfers.map(t => `    { target: '${t.stealthAddress}', allowFailure: false, value: ${t.amount}n, callData: '0x' },`).join('\n')}
  ]

  // Execute batch transfer
  const tx = await multicall.aggregate3Value(calls, {
    value: ${totalAmount}n, // Total ETH
  })

  console.log('Batch transfer sent:', tx.hash)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: BATCH ERC-20 TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Batch ERC-20 transfer')
  console.log('─────────────────────────────────────────────────────────────────')

  // Example USDC amounts
  const tokenTransfers = preparedTransfers.map((t) => ({
    ...t,
    tokenAmount: BigInt(Math.floor(Math.random() * 1000)) * 1_000_000n, // Random USDC amount
  }))

  console.log('Token transfers:')
  for (const t of tokenTransfers) {
    console.log(`  ${t.label}: ${formatAmount(t.tokenAmount, 6)} USDC`)
  }
  console.log('')

  console.log(`
Using Multicall3 for batch ERC-20 transfers:

  // Function selector: transfer(address,uint256)
  const transferSelector = '0xa9059cbb'

  function encodeTransfer(to: string, amount: bigint): string {
    return transferSelector +
      to.slice(2).padStart(64, '0') +
      amount.toString(16).padStart(64, '0')
  }

  // Prepare ERC-20 transfer calls
  const calls = [
${tokenTransfers.map(t => `    {
      target: '${USDC_ADDRESS}', // USDC
      allowFailure: false,
      value: 0n,
      callData: encodeTransfer('${t.stealthAddress}', ${t.tokenAmount}n),
    },`).join('\n')}
  ]

  // First approve Multicall3 to spend tokens (one-time)
  const usdc = new ethers.Contract('${USDC_ADDRESS}', ERC20_ABI, signer)
  await usdc.approve('${MULTICALL3_ADDRESS}', totalTokenAmount)

  // Execute batch transfer
  const tx = await multicall.aggregate3(calls)
  console.log('Batch transfer sent:', tx.hash)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: USING DISPERSE.APP PATTERN
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Alternative - Disperse.app pattern')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Using a Disperse-style contract (more gas efficient):

  // Deploy or use existing Disperse contract
  const DISPERSE_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150'

  const disperse = new ethers.Contract(
    DISPERSE_ADDRESS,
    [
      'function disperseEther(address[] recipients, uint256[] amounts) payable',
      'function disperseToken(address token, address[] recipients, uint256[] amounts)',
    ],
    signer
  )

  // Batch ETH transfer
  await disperse.disperseEther(
    [${preparedTransfers.map(t => `'${t.stealthAddress}'`).join(', ')}],
    [${preparedTransfers.map(t => `${t.amount}n`).join(', ')}],
    { value: ${totalAmount}n }
  )

  // Batch token transfer (after approval)
  await usdc.approve(DISPERSE_ADDRESS, totalTokenAmount)
  await disperse.disperseToken(
    '${USDC_ADDRESS}',
    [${tokenTransfers.map(t => `'${t.stealthAddress}'`).join(', ')}],
    [${tokenTransfers.map(t => `${t.tokenAmount}n`).join(', ')}]
  )
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: EMIT BATCH ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Emit announcements for all transfers')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Batch announcements (one tx with multiple events):')
  console.log('')

  console.log(`
  // SIP Registry with batch announcement support
  interface ISIPRegistryBatch {
    announceBatch(
      uint256 schemeId,
      address[] stealthAddresses,
      bytes[] ephemeralPubKeys,
      bytes[] metadata
    ) external;
  }

  // Emit all announcements in one transaction
  await sipRegistry.announceBatch(
    1, // schemeId (secp256k1)
    [${preparedTransfers.map(t => `'${t.stealthAddress}'`).join(', ')}],
    [${preparedTransfers.map(t => `'${t.ephemeralPublicKey}'`).join(', ')}],
    [${preparedTransfers.map(t => `'0x'`).join(', ')}] // metadata (optional)
  )
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: GAS COMPARISON
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 7: Gas comparison')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Gas costs for ${preparedTransfers.length} recipients:

┌────────────────────────────┬───────────────┬───────────────┐
│ Method                     │ Gas (Est.)    │ Savings       │
├────────────────────────────┼───────────────┼───────────────┤
│ Individual transactions    │ ~${(21000 * preparedTransfers.length).toLocaleString()} gas  │ -             │
│ Multicall3 batch           │ ~${(30000 + 5000 * preparedTransfers.length).toLocaleString()} gas  │ ~${Math.round((1 - (30000 + 5000 * preparedTransfers.length) / (21000 * preparedTransfers.length)) * 100)}%         │
│ Disperse contract          │ ~${(25000 + 4000 * preparedTransfers.length).toLocaleString()} gas  │ ~${Math.round((1 - (25000 + 4000 * preparedTransfers.length) / (21000 * preparedTransfers.length)) * 100)}%         │
└────────────────────────────┴───────────────┴───────────────┘

For ERC-20 tokens (additional ~30k gas per transfer):

┌────────────────────────────┬───────────────┬───────────────┐
│ Method                     │ Gas (Est.)    │ Savings       │
├────────────────────────────┼───────────────┼───────────────┤
│ Individual transfers       │ ~${(50000 * preparedTransfers.length).toLocaleString()} gas  │ -             │
│ Multicall3 batch           │ ~${(35000 + 25000 * preparedTransfers.length).toLocaleString()} gas │ ~${Math.round((1 - (35000 + 25000 * preparedTransfers.length) / (50000 * preparedTransfers.length)) * 100)}%         │
│ Disperse contract          │ ~${(30000 + 23000 * preparedTransfers.length).toLocaleString()} gas │ ~${Math.round((1 - (30000 + 23000 * preparedTransfers.length) / (50000 * preparedTransfers.length)) * 100)}%         │
└────────────────────────────┴───────────────┴───────────────┘
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Batch transfer benefits:')
  console.log('  ✓ Single transaction for multiple payments')
  console.log('  ✓ Gas savings (40-50% reduction)')
  console.log('  ✓ Atomic execution (all or nothing)')
  console.log('  ✓ Batch announcement emission')
  console.log('')
  console.log('Use cases:')
  console.log('  - Payroll disbursement')
  console.log('  - Airdrop distribution')
  console.log('  - DAO treasury payments')
  console.log('  - Multi-recipient invoices')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 05-metamask-integration.ts for wallet UI')
  console.log('  2. See 06-viewing-key-disclosure.ts for compliance')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

function formatAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  if (fraction === 0n) return whole.toString()
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
