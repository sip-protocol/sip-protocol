/**
 * 02-erc20-transfer.ts
 *
 * Demonstrates sending ERC-20 tokens to a stealth address.
 *
 * This example shows:
 * 1. Generating stealth addresses for ERC-20 transfers
 * 2. Preparing ERC-20 transfer calldata
 * 3. Handling token approvals
 * 4. Batch transfers for multiple tokens
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/02-erc20-transfer.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

// Example ERC-20 tokens (mainnet addresses)
const TOKENS = {
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    symbol: 'USDC',
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    symbol: 'USDT',
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EescdeCB5ef3EfB',
    decimals: 18,
    symbol: 'DAI',
  },
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    symbol: 'WETH',
  },
}

// ─── ERC-20 ABI Encoding ──────────────────────────────────────────────────────

/**
 * Encode ERC-20 transfer function call
 * transfer(address to, uint256 amount)
 * Function selector: 0xa9059cbb
 */
function encodeTransfer(to: string, amount: bigint): HexString {
  // Function selector for transfer(address,uint256)
  const selector = 'a9059cbb'

  // Encode address (pad to 32 bytes)
  const toParam = to.slice(2).toLowerCase().padStart(64, '0')

  // Encode amount (pad to 32 bytes)
  const amountParam = amount.toString(16).padStart(64, '0')

  return `0x${selector}${toParam}${amountParam}` as HexString
}

/**
 * Encode ERC-20 approve function call
 * approve(address spender, uint256 amount)
 * Function selector: 0x095ea7b3
 */
function encodeApprove(spender: string, amount: bigint): HexString {
  const selector = '095ea7b3'
  const spenderParam = spender.slice(2).toLowerCase().padStart(64, '0')
  const amountParam = amount.toString(16).padStart(64, '0')
  return `0x${selector}${spenderParam}${amountParam}` as HexString
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: ERC-20 PRIVATE TRANSFER')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: GENERATE STEALTH ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Generate stealth address for recipient')
  console.log('─────────────────────────────────────────────────────────────────')

  // Recipient's meta-address (normally retrieved from ENS, profile, etc.)
  const recipient = generateStealthMetaAddress('ethereum', 'Token Recipient')

  // Sender generates stealth address
  const { stealthAddress, sharedSecret } = generateStealthAddress(recipient.metaAddress)

  // Convert to Ethereum address
  const ethStealthAddress = publicKeyToEthAddress(stealthAddress.address)

  console.log('Stealth address generated:')
  console.log(`  Ethereum Address: ${ethStealthAddress}`)
  console.log(`  Ephemeral Key:    ${truncate(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:         0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: PREPARE ERC-20 TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Prepare ERC-20 transfer')
  console.log('─────────────────────────────────────────────────────────────────')

  // Example: Transfer 100 USDC
  const token = TOKENS.USDC
  const amount = 100_000_000n // 100 USDC (6 decimals)

  // Encode transfer calldata
  const transferCalldata = encodeTransfer(ethStealthAddress, amount)

  console.log('Transfer details:')
  console.log(`  Token:           ${token.symbol} (${token.address})`)
  console.log(`  To:              ${ethStealthAddress}`)
  console.log(`  Amount:          ${formatAmount(amount, token.decimals)} ${token.symbol}`)
  console.log(`  Calldata:        ${truncate(transferCalldata, 20)}`)
  console.log('')

  // Prepare transaction
  const transaction = {
    to: token.address,
    data: transferCalldata,
    value: 0n, // ERC-20 transfers don't send ETH
  }

  console.log('Transaction prepared:')
  console.log(`  To (Token):  ${transaction.to}`)
  console.log(`  Value:       0 ETH (ERC-20 transfer)`)
  console.log(`  Data:        transfer(${ethStealthAddress}, ${amount})`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: EXAMPLE WITH ETHERS.JS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Execute with ethers.js')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
  import { ethers } from 'ethers'

  // Connect to provider
  const provider = new ethers.BrowserProvider(window.ethereum)
  const signer = await provider.getSigner()

  // ERC-20 contract
  const usdc = new ethers.Contract(
    '${token.address}',
    ['function transfer(address to, uint256 amount) returns (bool)'],
    signer
  )

  // Transfer to stealth address
  const tx = await usdc.transfer(
    '${ethStealthAddress}',
    ${amount}n // ${formatAmount(amount, token.decimals)} USDC
  )

  console.log('Transaction sent:', tx.hash)
  await tx.wait()
  console.log('Transfer complete!')
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: EXAMPLE WITH VIEM
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Execute with viem')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
  import { createWalletClient, http, parseUnits } from 'viem'
  import { mainnet } from 'viem/chains'
  import { erc20Abi } from 'viem'

  const client = createWalletClient({
    chain: mainnet,
    transport: http(),
  })

  // Transfer USDC to stealth address
  const hash = await client.writeContract({
    address: '${token.address}',
    abi: erc20Abi,
    functionName: 'transfer',
    args: ['${ethStealthAddress}', ${amount}n],
  })
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: MULTI-TOKEN TRANSFER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Multi-token transfer to same stealth address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Same stealth address can receive multiple tokens
  const transfers = [
    { token: TOKENS.USDC, amount: 100_000_000n }, // 100 USDC
    { token: TOKENS.USDT, amount: 50_000_000n }, // 50 USDT
    { token: TOKENS.DAI, amount: 200_000_000_000_000_000_000n }, // 200 DAI
  ]

  console.log('Multiple tokens to same stealth address:')
  for (const t of transfers) {
    const calldata = encodeTransfer(ethStealthAddress, t.amount)
    console.log(`  ${t.token.symbol}: ${formatAmount(t.amount, t.token.decimals)} to ${truncate(ethStealthAddress, 6)}`)
  }
  console.log('')

  console.log(`
  // Batch transfer using multicall or sequential
  const transfers = [
    { token: usdc, amount: parseUnits('100', 6) },
    { token: usdt, amount: parseUnits('50', 6) },
    { token: dai, amount: parseUnits('200', 18) },
  ]

  for (const t of transfers) {
    await t.token.transfer('${ethStealthAddress}', t.amount)
  }
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: ANNOUNCEMENT DATA
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Include token info in announcement')
  console.log('─────────────────────────────────────────────────────────────────')

  // Metadata can include token info for recipient
  const metadata = {
    tokens: [
      { address: token.address, amount: amount.toString() },
    ],
    message: 'Payment for services', // Optional encrypted message
  }

  console.log('Announcement with token metadata:')
  console.log(`  Stealth Address:  ${ethStealthAddress}`)
  console.log(`  Ephemeral Key:    ${truncate(stealthAddress.ephemeralPublicKey)}`)
  console.log(`  View Tag:         0x${stealthAddress.viewTag.toString(16).padStart(2, '0')}`)
  console.log(`  Metadata:         ${JSON.stringify(metadata)}`)
  console.log('')

  console.log(`
  // Emit announcement with token metadata
  await sipRegistry.announce(
    1, // schemeId (secp256k1)
    '${ethStealthAddress}',
    '${stealthAddress.ephemeralPublicKey}',
    ethers.toUtf8Bytes(JSON.stringify(${JSON.stringify(metadata)}))
  )
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('ERC-20 stealth transfer:')
  console.log('  ✓ Any ERC-20 token supported')
  console.log('  ✓ Multiple tokens to same stealth address')
  console.log('  ✓ Metadata for token discovery')
  console.log('  ✓ Compatible with any EVM chain')
  console.log('')
  console.log('Supported tokens (examples):')
  console.log('  - USDC, USDT, DAI (stablecoins)')
  console.log('  - WETH, WBTC (wrapped assets)')
  console.log('  - Any ERC-20 compliant token')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 03-scan-and-claim.ts for claiming tokens')
  console.log('  2. See 04-batch-transfer.ts for multi-recipient')
  console.log('  3. See 06-viewing-key-disclosure.ts for compliance')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
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
