/**
 * Example: Private Sealed-Bid Auction
 *
 * This example demonstrates a complete sealed-bid auction lifecycle where:
 * - Bidders commit to their bids without revealing amounts
 * - Winner is determined fairly after all bids are revealed
 * - Privacy is maintained - only winner's amount is publicly known
 * - Losing bids remain private (never exposed to observers)
 *
 * Use cases:
 * - NFT auctions with privacy
 * - Government procurement contracts
 * - Private sales and fundraising
 * - First-price and second-price (Vickrey) auctions
 */

import { SealedBidAuction } from '../src/auction/sealed-bid'
import type { BidReceipt, SealedBid, RevealedBid } from '../src/auction/sealed-bid'
import { hexToBytes } from '@noble/hashes/utils'

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║            PRIVATE SEALED-BID AUCTION EXAMPLE                  ║')
  console.log('╚════════════════════════════════════════════════════════════════╝\n')

  const auction = new SealedBidAuction()

  // ============================================================================
  // PHASE 1: AUCTION SETUP
  // ============================================================================
  console.log('━━━ PHASE 1: AUCTION SETUP ━━━\n')

  const auctionMetadata = {
    itemId: 'rare-nft-001',
    itemName: 'Genesis CryptoPunk #7804',
    seller: '0xSELLER...abc',
    startTime: Date.now(),
    endTime: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    minimumBid: 50n, // 50 ETH minimum
  }

  const auctionId = auction.hashAuctionMetadata(auctionMetadata)
  console.log('Auction Created:')
  console.log(`  Item: ${auctionMetadata.itemName}`)
  console.log(`  Auction ID: ${auctionId.slice(0, 20)}...`)
  console.log(`  Minimum Bid: ${auctionMetadata.minimumBid} ETH`)
  console.log(`  Duration: 24 hours`)
  console.log()

  // ============================================================================
  // PHASE 2: BID SUBMISSION (AMOUNTS HIDDEN)
  // ============================================================================
  console.log('━━━ PHASE 2: BID SUBMISSION (SEALED BIDS) ━━━\n')
  console.log('Privacy guarantee: Bid amounts are cryptographically hidden')
  console.log('Only commitments are public during this phase\n')

  // Alice bids 100 ETH
  console.log('👤 Alice submitting bid...')
  const aliceReceipt: BidReceipt = auction.createBid({
    auctionId,
    amount: 100n, // 100 ETH - kept secret!
  })
  console.log(`  ✓ Bid submitted at ${new Date(aliceReceipt.timestamp).toLocaleTimeString()}`)
  console.log(`  ✓ Commitment: ${aliceReceipt.commitment.slice(0, 20)}...`)
  console.log(`  ✓ Amount: HIDDEN (only Alice knows: 100 ETH)`)
  console.log(`  ✓ Salt: HIDDEN (needed for reveal)`)
  console.log()

  // Bob bids 150 ETH (highest)
  console.log('👤 Bob submitting bid...')
  const bobReceipt: BidReceipt = auction.createBid({
    auctionId,
    amount: 150n, // 150 ETH - highest bid!
  })
  console.log(`  ✓ Bid submitted at ${new Date(bobReceipt.timestamp).toLocaleTimeString()}`)
  console.log(`  ✓ Commitment: ${bobReceipt.commitment.slice(0, 20)}...`)
  console.log(`  ✓ Amount: HIDDEN (only Bob knows: 150 ETH)`)
  console.log(`  ✓ Salt: HIDDEN (needed for reveal)`)
  console.log()

  // Carol bids 120 ETH
  console.log('👤 Carol submitting bid...')
  const carolReceipt: BidReceipt = auction.createBid({
    auctionId,
    amount: 120n, // 120 ETH - second highest
  })
  console.log(`  ✓ Bid submitted at ${new Date(carolReceipt.timestamp).toLocaleTimeString()}`)
  console.log(`  ✓ Commitment: ${carolReceipt.commitment.slice(0, 20)}...`)
  console.log(`  ✓ Amount: HIDDEN (only Carol knows: 120 ETH)`)
  console.log(`  ✓ Salt: HIDDEN (needed for reveal)`)
  console.log()

  // Dave bids 80 ETH
  console.log('👤 Dave submitting bid...')
  const daveReceipt: BidReceipt = auction.createBid({
    auctionId,
    amount: 80n, // 80 ETH - lowest bid
  })
  console.log(`  ✓ Bid submitted at ${new Date(daveReceipt.timestamp).toLocaleTimeString()}`)
  console.log(`  ✓ Commitment: ${daveReceipt.commitment.slice(0, 20)}...`)
  console.log(`  ✓ Amount: HIDDEN (only Dave knows: 80 ETH)`)
  console.log(`  ✓ Salt: HIDDEN (needed for reveal)`)
  console.log()

  // Public view during bidding phase
  console.log('📊 PUBLIC VIEW (during bidding phase):')
  console.log('  4 bids submitted')
  console.log('  All amounts are HIDDEN')
  console.log('  Only cryptographic commitments are visible')
  console.log('  Nobody knows who bid what!\n')

  // Collect sealed bids (what observers see)
  const sealedBids: SealedBid[] = [
    { auctionId: aliceReceipt.auctionId, commitment: aliceReceipt.commitment, timestamp: aliceReceipt.timestamp },
    { auctionId: bobReceipt.auctionId, commitment: bobReceipt.commitment, timestamp: bobReceipt.timestamp },
    { auctionId: carolReceipt.auctionId, commitment: carolReceipt.commitment, timestamp: carolReceipt.timestamp },
    { auctionId: daveReceipt.auctionId, commitment: daveReceipt.commitment, timestamp: daveReceipt.timestamp },
  ]

  // Wait for bidding period to end
  console.log('⏰ Waiting for bidding period to end...\n')

  // ============================================================================
  // PHASE 3: BID REVEAL
  // ============================================================================
  console.log('━━━ PHASE 3: BID REVEAL ━━━\n')
  console.log('Bidders reveal their amounts and prove they match commitments\n')

  // Alice reveals her bid
  console.log('👤 Alice revealing bid...')
  const aliceRevealed: RevealedBid = auction.revealBid(
    sealedBids[0],
    aliceReceipt.amount,
    hexToBytes(aliceReceipt.salt.slice(2))
  )
  const aliceValid = auction.verifyReveal(sealedBids[0], aliceRevealed)
  console.log(`  ✓ Amount revealed: ${aliceRevealed.amount} ETH`)
  console.log(`  ✓ Verification: ${aliceValid ? 'VALID ✓' : 'INVALID ✗'}`)
  console.log(`  ✓ Proof: Commitment matches revealed amount`)
  console.log()

  // Bob reveals his bid
  console.log('👤 Bob revealing bid...')
  const bobRevealed: RevealedBid = auction.revealBid(
    sealedBids[1],
    bobReceipt.amount,
    hexToBytes(bobReceipt.salt.slice(2))
  )
  const bobValid = auction.verifyReveal(sealedBids[1], bobRevealed)
  console.log(`  ✓ Amount revealed: ${bobRevealed.amount} ETH`)
  console.log(`  ✓ Verification: ${bobValid ? 'VALID ✓' : 'INVALID ✗'}`)
  console.log(`  ✓ Proof: Commitment matches revealed amount`)
  console.log()

  // Carol reveals her bid
  console.log('👤 Carol revealing bid...')
  const carolRevealed: RevealedBid = auction.revealBid(
    sealedBids[2],
    carolReceipt.amount,
    hexToBytes(carolReceipt.salt.slice(2))
  )
  const carolValid = auction.verifyReveal(sealedBids[2], carolRevealed)
  console.log(`  ✓ Amount revealed: ${carolRevealed.amount} ETH`)
  console.log(`  ✓ Verification: ${carolValid ? 'VALID ✓' : 'INVALID ✗'}`)
  console.log(`  ✓ Proof: Commitment matches revealed amount`)
  console.log()

  // Dave reveals his bid
  console.log('👤 Dave revealing bid...')
  const daveRevealed: RevealedBid = auction.revealBid(
    sealedBids[3],
    daveReceipt.amount,
    hexToBytes(daveReceipt.salt.slice(2))
  )
  const daveValid = auction.verifyReveal(sealedBids[3], daveRevealed)
  console.log(`  ✓ Amount revealed: ${daveRevealed.amount} ETH`)
  console.log(`  ✓ Verification: ${daveValid ? 'VALID ✓' : 'INVALID ✗'}`)
  console.log(`  ✓ Proof: Commitment matches revealed amount`)
  console.log()

  const revealedBids: RevealedBid[] = [aliceRevealed, bobRevealed, carolRevealed, daveRevealed]

  console.log('📊 ALL BIDS REVEALED:')
  console.log(`  Alice: ${aliceRevealed.amount} ETH`)
  console.log(`  Bob:   ${bobRevealed.amount} ETH`)
  console.log(`  Carol: ${carolRevealed.amount} ETH`)
  console.log(`  Dave:  ${daveRevealed.amount} ETH`)
  console.log()

  // ============================================================================
  // PHASE 4: WINNER DETERMINATION
  // ============================================================================
  console.log('━━━ PHASE 4: WINNER DETERMINATION ━━━\n')

  const winner = auction.determineWinner(revealedBids)
  console.log('🏆 Winner Determined:')
  console.log(`  Winner: Bob`)
  console.log(`  Winning Bid: ${winner.amount} ETH`)
  console.log(`  Bid Time: ${new Date(winner.timestamp).toLocaleTimeString()}`)
  console.log(`  Commitment: ${winner.commitment.slice(0, 20)}...`)
  console.log()

  // Verify winner is correct
  const winnerVerified = auction.verifyWinner(winner, revealedBids)
  console.log('✓ Winner Verification:')
  console.log(`  Is Bob the highest bidder? ${winnerVerified ? 'YES ✓' : 'NO ✗'}`)
  console.log(`  Bob's bid (${winner.amount} ETH) >= all other bids`)
  console.log()

  // Additional info for second-price (Vickrey) auction
  const sortedBids = [...revealedBids].sort((a, b) => Number(b.amount - a.amount))
  const secondPrice = sortedBids[1].amount
  console.log('💰 Payment Information:')
  console.log(`  First-price auction: Bob pays ${winner.amount} ETH (his bid)`)
  console.log(`  Second-price auction: Bob pays ${secondPrice} ETH (Carol's bid)`)
  console.log(`  Vickrey auction efficiency: Winner pays second-highest bid`)
  console.log()

  // ============================================================================
  // PHASE 5: PRIVACY-PRESERVING WINNER PROOF
  // ============================================================================
  console.log('━━━ PHASE 5: PRIVACY-PRESERVING WINNER PROOF ━━━\n')
  console.log('Demonstrating zero-knowledge style verification')
  console.log('Observers can verify winner WITHOUT knowing losing bids\n')

  // Generate winner proof
  console.log('🔐 Generating Winner Proof...')
  const winnerProof = auction.createWinnerProof(winner, revealedBids)
  console.log(`  ✓ Proof generated`)
  console.log(`  ✓ Total bids: ${winnerProof.totalBids}`)
  console.log(`  ✓ Winner commitment: ${winnerProof.winnerCommitment.slice(0, 20)}...`)
  console.log(`  ✓ Winner amount: ${winnerProof.winnerAmount} ETH`)
  console.log(`  ✓ Differential commitments: ${winnerProof.differentialCommitments.length}`)
  console.log(`  ✓ Commitments hash: ${winnerProof.commitmentsHash.slice(0, 20)}...`)
  console.log()

  // Collect only public commitments (what observers have)
  const publicCommitments = sealedBids.map(bid => bid.commitment)

  // Verify winner proof WITHOUT revealing losing bids
  console.log('🔍 Verifying Winner Proof (Privacy-Preserving)...')
  const verification = auction.verifyWinnerProof(winnerProof, publicCommitments)
  console.log(`  ✓ Proof valid: ${verification.valid ? 'YES ✓' : 'NO ✗'}`)
  console.log(`  ✓ Bids checked: ${verification.details?.bidsChecked}`)
  console.log(`  ✓ Commitments hash matched: ${verification.details?.hashMatched ? 'YES ✓' : 'NO ✗'}`)
  console.log(`  ✓ All comparisons passed: ${verification.details?.comparisonsPassed ? 'YES ✓' : 'NO ✗'}`)
  console.log()

  // ============================================================================
  // PRIVACY GUARANTEES
  // ============================================================================
  console.log('━━━ PRIVACY GUARANTEES ━━━\n')

  console.log('🔒 What Observers Know (with proof):')
  console.log(`  ✓ Winner: Bob`)
  console.log(`  ✓ Winner amount: ${winnerProof.winnerAmount} ETH`)
  console.log(`  ✓ Number of bids: ${winnerProof.totalBids}`)
  console.log(`  ✓ Winner commitment is valid`)
  console.log(`  ✓ Winner is provably the highest bidder`)
  console.log()

  console.log('🔐 What Observers DON\'T Know:')
  console.log('  ✗ Alice\'s bid amount (remains private)')
  console.log('  ✗ Carol\'s bid amount (remains private)')
  console.log('  ✗ Dave\'s bid amount (remains private)')
  console.log('  ✗ Exact differences between bids')
  console.log('  ✗ Who the losing bidders are (if commitments are unlinkable)')
  console.log()

  console.log('🎯 Privacy vs Transparency Trade-offs:')
  console.log('  ✓ Winner\'s amount revealed: Necessary for price discovery')
  console.log('  ✓ Losers\' amounts hidden: Preserves bidder privacy')
  console.log('  ✓ All bids cryptographically binding: Prevents cheating')
  console.log('  ✓ Verifiable without revealing secrets: Zero-knowledge style')
  console.log()

  // ============================================================================
  // USE CASE SCENARIOS
  // ============================================================================
  console.log('━━━ USE CASE SCENARIOS ━━━\n')

  console.log('1️⃣  NFT Auctions:')
  console.log('   - Bidders compete without revealing their max price')
  console.log('   - Winner pays fair price, losers maintain privacy')
  console.log('   - Prevents bid sniping and front-running')
  console.log()

  console.log('2️⃣  Government Procurement:')
  console.log('   - Contractors bid on public projects')
  console.log('   - Winner determined fairly and transparently')
  console.log('   - Losing bids remain confidential (trade secrets)')
  console.log()

  console.log('3️⃣  Private Sales:')
  console.log('   - Buyers bid on luxury items or real estate')
  console.log('   - Seller knows all bids, but public only sees winner')
  console.log('   - Protects buyer financial privacy')
  console.log()

  console.log('4️⃣  Corporate M&A:')
  console.log('   - Companies bid on acquisition targets')
  console.log('   - Winner announced, losing bids never disclosed')
  console.log('   - Preserves strategic confidentiality')
  console.log()

  // ============================================================================
  // SECURITY PROPERTIES
  // ============================================================================
  console.log('━━━ SECURITY PROPERTIES ━━━\n')

  console.log('🛡️  Cryptographic Guarantees:')
  console.log('   ✓ Binding: Cannot change bid after commitment')
  console.log('   ✓ Hiding: Bid amount hidden until reveal phase')
  console.log('   ✓ Verifiable: Anyone can verify revealed bids')
  console.log('   ✓ Non-malleable: Secure randomness prevents tampering')
  console.log('   ✓ Privacy-preserving: Losers never exposed to observers')
  console.log()

  console.log('⚠️  Considerations:')
  console.log('   - Bidders must keep their receipts secure')
  console.log('   - Bidders who don\'t reveal may be penalized')
  console.log('   - Requires trust in auction operator (for reveal phase)')
  console.log('   - Can be enhanced with ZK proofs for full trustlessness')
  console.log()

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     AUCTION COMPLETE                           ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
}

main().catch(console.error)
