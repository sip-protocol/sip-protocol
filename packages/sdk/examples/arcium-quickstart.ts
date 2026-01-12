/**
 * Arcium + SIP Quick Start Example
 *
 * Minimal example showing the combined privacy flow.
 * Run with: npx tsx examples/arcium-quickstart.ts
 */

import {
  createCombinedPrivacyServiceDevnet,
  createCSPLServiceDevnet,
} from '../src/privacy-backends'

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

async function main() {
  // ─── Option 1: Use C-SPL directly (just amount privacy) ─────────────────────

  console.log('=== C-SPL Token Service (Amount Privacy) ===\n')

  const cspl = createCSPLServiceDevnet()
  await cspl.initialize()

  // Wrap SPL → C-SPL
  const wrap = await cspl.wrap({
    splMint: USDC_MINT,
    owner: 'YourWalletAddress',
    amount: 100_000000n, // 100 USDC
  })
  console.log('Wrapped to C-SPL:', wrap.csplMint)

  // Confidential transfer
  const transfer = await cspl.transfer({
    csplMint: wrap.csplMint!,
    sender: 'YourWalletAddress',
    recipient: 'RecipientAddress',
    amount: 50_000000n, // 50 USDC
  })
  console.log('Transfer signature:', transfer.signature)

  // ─── Option 2: Use Combined Service (full privacy) ──────────────────────────

  console.log('\n=== Combined Privacy Service (Full Privacy) ===\n')

  const combined = createCombinedPrivacyServiceDevnet()
  await combined.initialize()

  // Execute private transfer with stealth address + C-SPL
  const result = await combined.executePrivateTransfer({
    splMint: USDC_MINT,
    sender: 'YourWalletAddress',
    recipientMetaAddress: 'sip:solana:0x02spending...:0x03viewing...',
    amount: 100_000000n,
    decimals: 6,
    viewingKey: '0x04auditor...', // Optional: for compliance
  })

  console.log('Privacy achieved:')
  console.log('  - Hidden recipient:', result.privacyAchieved.hiddenRecipient)
  console.log('  - Hidden amount:', result.privacyAchieved.hiddenAmount)
  console.log('  - Hidden sender:', result.privacyAchieved.hiddenSender)
  console.log('  - Compliance ready:', result.privacyAchieved.complianceSupport)
}

main().catch(console.error)
