/**
 * 03-scan-and-claim.ts
 *
 * Demonstrates scanning for stealth payments and claiming funds.
 *
 * This example shows:
 * 1. Scanning announcements for incoming payments
 * 2. Using view tags for efficient filtering
 * 3. Deriving private keys for matched payments
 * 4. Claiming funds with derived keys
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/03-scan-and-claim.ts
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthPrivateKey,
  publicKeyToEthAddress,
  type StealthAddress,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Announcement {
  blockNumber: number
  txHash: HexString
  stealthAddress: string
  ephemeralPublicKey: HexString
  viewTag: number
  metadata?: string
}

interface DiscoveredPayment {
  announcement: Announcement
  stealthAddress: string
  privateKey: HexString
  balance?: bigint
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: SCAN AND CLAIM PAYMENTS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: SETUP RECIPIENT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Setup recipient keys')
  console.log('─────────────────────────────────────────────────────────────────')

  // Recipient has their meta-address and private keys
  const recipient = generateStealthMetaAddress('ethereum', 'Scanner Wallet')

  console.log('Recipient setup:')
  console.log(`  Meta-Address:     ${truncate(recipient.metaAddress.spendingKey)}...`)
  console.log(`  Spending Key:     ${truncate(recipient.spendingPrivateKey)} (KEEP SECRET)`)
  console.log(`  Viewing Key:      ${truncate(recipient.viewingPrivateKey)} (KEEP SECRET)`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SIMULATE ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Simulate incoming announcements')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate multiple payments (some for us, some not)
  const announcements = await simulateAnnouncements(recipient)

  console.log(`Received ${announcements.length} announcements to scan`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SCAN WITH VIEW TAG OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Scan announcements (view tag optimization)')
  console.log('─────────────────────────────────────────────────────────────────')

  const discoveredPayments: DiscoveredPayment[] = []
  let viewTagMatches = 0
  let fullMatches = 0

  for (const announcement of announcements) {
    // Reconstruct stealth address from announcement
    const stealthAddress: StealthAddress = {
      address: publicKeyFromAddress(announcement.stealthAddress), // In practice, retrieved differently
      ephemeralPublicKey: announcement.ephemeralPublicKey,
      viewTag: announcement.viewTag,
    }

    // Check if this payment is for us
    // The SDK automatically uses view tag for optimization
    const isOurs = checkStealthAddress(
      stealthAddress,
      recipient.spendingPrivateKey,
      recipient.viewingPrivateKey
    )

    if (isOurs) {
      fullMatches++

      // Derive the private key for this stealth address
      const recovery = deriveStealthPrivateKey(
        stealthAddress,
        recipient.spendingPrivateKey,
        recipient.viewingPrivateKey
      )

      discoveredPayments.push({
        announcement,
        stealthAddress: announcement.stealthAddress,
        privateKey: recovery.privateKey,
      })

      console.log(`  ✓ MATCH: Block ${announcement.blockNumber}, ${announcement.stealthAddress.slice(0, 18)}...`)
    }
  }

  console.log('')
  console.log(`Scan results:`)
  console.log(`  Total announcements:  ${announcements.length}`)
  console.log(`  Discovered payments:  ${fullMatches}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: CHECK BALANCES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Check discovered payment balances')
  console.log('─────────────────────────────────────────────────────────────────')

  // Simulate checking balances (in production, query blockchain)
  for (const payment of discoveredPayments) {
    payment.balance = BigInt(Math.floor(Math.random() * 1e18)) // Mock balance

    console.log(`  ${payment.stealthAddress.slice(0, 18)}...`)
    console.log(`    Balance: ${formatEth(payment.balance)} ETH`)
    console.log(`    Private Key: ${truncate(payment.privateKey)}`)
    console.log('')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: CLAIM FUNDS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Claim funds to main wallet')
  console.log('─────────────────────────────────────────────────────────────────')

  const mainWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0aB12' // Your main wallet

  console.log(`
Claiming with ethers.js:

  import { ethers } from 'ethers'

  // For each discovered payment
  for (const payment of discoveredPayments) {
    // Create wallet from derived private key
    const stealthWallet = new ethers.Wallet(
      payment.privateKey,
      provider
    )

    // Check balance
    const balance = await provider.getBalance(payment.stealthAddress)

    if (balance > 0n) {
      // Calculate gas needed
      const gasPrice = await provider.getFeeData()
      const gasLimit = 21000n // Standard ETH transfer
      const gasCost = gasLimit * gasPrice.gasPrice

      // Transfer remaining balance to main wallet
      const tx = await stealthWallet.sendTransaction({
        to: '${mainWallet}',
        value: balance - gasCost, // Leave gas for tx
        gasLimit,
      })

      console.log('Claimed:', tx.hash)
    }
  }
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: CLAIM ERC-20 TOKENS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Claim ERC-20 tokens')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Claiming ERC-20 tokens:

  // Problem: Stealth address has no ETH for gas
  // Solution 1: Fund with ETH first
  // Solution 2: Use ERC-4337 relayer (see next step)

  // Option 1: Fund stealth address with ETH
  const fundTx = await mainWallet.sendTransaction({
    to: payment.stealthAddress,
    value: ethers.parseEther('0.01'), // Gas money
  })
  await fundTx.wait()

  // Then transfer tokens
  const stealthWallet = new ethers.Wallet(payment.privateKey, provider)
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, stealthWallet)

  const tokenBalance = await usdc.balanceOf(payment.stealthAddress)
  await usdc.transfer('${mainWallet}', tokenBalance)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: GASLESS CLAIM WITH ERC-4337
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 7: Gasless claim with ERC-4337 relayer')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Using SIP's ERC-4337 relayer for gas-sponsored claims:

  import { createPimlicoRelayer } from '@sip-protocol/sdk/evm'

  const relayer = createPimlicoRelayer({
    apiKey: process.env.PIMLICO_API_KEY,
    chain: 'ethereum',
  })

  // For each discovered payment with tokens
  for (const payment of discoveredPayments) {
    // Create transfer calldata
    const calldata = usdc.interface.encodeFunctionData('transfer', [
      '${mainWallet}',
      tokenBalance,
    ])

    // Relay with sponsored gas
    const result = await relayer.relayTransaction({
      to: USDC_ADDRESS,
      data: calldata,
      signer: payment.privateKey, // Signs the UserOperation
    })

    console.log('Relayed:', result.userOpHash)
    console.log('Tx Hash:', result.transactionHash)
  }
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: CONTINUOUS SCANNING
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 8: Continuous scanning pattern')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Production scanning pattern:

  import { createPublicClient, http } from 'viem'
  import { mainnet } from 'viem/chains'

  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  // SIP Registry contract events
  const SIP_REGISTRY = '0x...'

  // Track last scanned block
  let lastBlock = await client.getBlockNumber()

  async function scanNewAnnouncements() {
    const currentBlock = await client.getBlockNumber()

    // Get new Announcement events
    const logs = await client.getLogs({
      address: SIP_REGISTRY,
      event: {
        type: 'event',
        name: 'Announcement',
        inputs: [
          { type: 'uint256', indexed: true, name: 'schemeId' },
          { type: 'address', indexed: true, name: 'stealthAddress' },
          { type: 'address', indexed: true, name: 'caller' },
          { type: 'bytes', name: 'ephemeralPubKey' },
          { type: 'bytes', name: 'metadata' },
        ],
      },
      fromBlock: lastBlock + 1n,
      toBlock: currentBlock,
    })

    for (const log of logs) {
      // Check if payment is for us
      const stealthAddress = {
        address: addressToPublicKey(log.args.stealthAddress),
        ephemeralPublicKey: log.args.ephemeralPubKey,
        viewTag: extractViewTag(log.args.ephemeralPubKey),
      }

      if (checkStealthAddress(stealthAddress, spendingKey, viewingKey)) {
        // Found a payment!
        await processPayment(log)
      }
    }

    lastBlock = currentBlock
  }

  // Poll every 12 seconds (1 block)
  setInterval(scanNewAnnouncements, 12000)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Scanning and claiming:')
  console.log('  ✓ View tag optimization (256x faster)')
  console.log('  ✓ Private key derivation for matches')
  console.log('  ✓ ETH and ERC-20 claiming')
  console.log('  ✓ Gasless claims with ERC-4337')
  console.log('')
  console.log('Performance notes:')
  console.log('  - View tag filters 255/256 announcements')
  console.log('  - Only full check for 1/256 matches')
  console.log('  - Batch queries for efficiency')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 04-batch-transfer.ts for multi-recipient')
  console.log('  2. See 05-metamask-integration.ts for wallet UI')
  console.log('  3. See 06-viewing-key-disclosure.ts for compliance')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Simulate announcements from blockchain
 * In production, these would be fetched from SIP Registry events
 */
async function simulateAnnouncements(
  recipient: ReturnType<typeof generateStealthMetaAddress>
): Promise<Announcement[]> {
  const announcements: Announcement[] = []

  // Generate 10 announcements (mix of ours and others)
  for (let i = 0; i < 10; i++) {
    const isOurs = i % 3 === 0 // Every 3rd is for us

    if (isOurs) {
      // Generate stealth address for recipient
      const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
      const ethAddress = publicKeyToEthAddress(stealthAddress.address)

      announcements.push({
        blockNumber: 18000000 + i * 100,
        txHash: `0x${randomHex(64)}` as HexString,
        stealthAddress: ethAddress,
        ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
        viewTag: stealthAddress.viewTag,
        metadata: JSON.stringify({ amount: '1000000' }),
      })
    } else {
      // Generate random announcement (not for us)
      const other = generateStealthMetaAddress('ethereum')
      const { stealthAddress } = generateStealthAddress(other.metaAddress)
      const ethAddress = publicKeyToEthAddress(stealthAddress.address)

      announcements.push({
        blockNumber: 18000000 + i * 100,
        txHash: `0x${randomHex(64)}` as HexString,
        stealthAddress: ethAddress,
        ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
        viewTag: stealthAddress.viewTag,
      })
    }
  }

  return announcements
}

/**
 * Mock function to get public key from address
 * In practice, this is retrieved from announcement data
 */
function publicKeyFromAddress(address: string): HexString {
  // This is a mock - in practice, you'd use the stealth public key from announcement
  // The announcement contains the full ephemeral public key, which is used for derivation
  return `0x02${randomHex(64)}` as HexString
}

function truncate(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(6)
}

function randomHex(length: number): string {
  return Array.from({ length: length / 2 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('')
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
