# Quick Start: NFT Marketplace Privacy

**Time to read: 6 minutes**

Add private NFT ownership and sales to your marketplace.

## The Problem

NFT marketplaces expose:
- **Wallet addresses** - Linked to real identity
- **Purchase history** - Reveals collecting patterns
- **Holdings** - Makes users targets for social engineering

## Installation

```bash
pnpm add @sip-protocol/sdk
```

## 1. Private NFT Ownership

Transfer ownership without revealing the new owner:

```typescript
import {
  PrivateNFT,
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'

const nft = new PrivateNFT({
  network: 'mainnet',
})

// Buyer generates stealth meta-address
const buyerMeta = generateStealthMetaAddress()
const buyerReceiveAddress = encodeStealthMetaAddress(buyerMeta)

// Seller transfers to stealth address
const transfer = await nft.privateTransfer({
  mint: 'NFT_MINT_ADDRESS',
  recipientMeta: buyerReceiveAddress,
})

console.log('NFT transferred to stealth address:', transfer.stealthAddress)
console.log('TX:', transfer.signature)
// On-chain: NFT is at a random address
// Only buyer can prove ownership
```

## 2. Prove Ownership Without Revealing Identity

```typescript
import {
  proveOwnership,
  verifyOwnership,
} from '@sip-protocol/sdk'

// Generate proof that you own the NFT
const proof = await proveOwnership({
  mint: 'NFT_MINT_ADDRESS',
  stealthPrivateKey: buyerStealthPrivateKey,
  challenge: 'unique-challenge-from-verifier',
})

// Verifier checks proof
const isValid = await verifyOwnership({
  proof,
  mint: 'NFT_MINT_ADDRESS',
  challenge: 'unique-challenge-from-verifier',
})

console.log('Ownership verified:', isValid)
// Verifier learns: "someone owns this NFT"
// Verifier does NOT learn: wallet address, other holdings
```

## 3. Private NFT Sale

Complete a private sale with hidden buyer:

```typescript
// Seller lists NFT
const listing = await nft.createListing({
  mint: 'NFT_MINT_ADDRESS',
  price: 10n * 10n**9n, // 10 SOL
  currency: 'SOL',
})

// Buyer purchases to stealth address
const buyerMeta = generateStealthMetaAddress()

const purchase = await nft.privatePurchase({
  listingId: listing.id,
  buyerMeta: encodeStealthMetaAddress(buyerMeta),
  payment: {
    amount: listing.price,
    // Payment also goes to seller's stealth address
    sellerMeta: listing.sellerMeta,
  },
})

console.log('Purchase TX:', purchase.signature)
// On-chain: random address → random address
// No link between buyer and NFT collection
```

## 4. Private Auctions

Run sealed-bid auctions where bids are hidden:

```typescript
import {
  SealedBidAuction,
  createSealedBidAuction,
} from '@sip-protocol/sdk'

// Create auction
const auction = createSealedBidAuction({
  nftMint: 'NFT_MINT_ADDRESS',
  reservePrice: 5n * 10n**9n,
  endTime: new Date('2026-02-01'),
})

// Bidder submits sealed bid
const bid = await auction.submitBid({
  amount: 15n * 10n**9n, // Hidden from others
  bidderMeta: bidderStealthMeta,
  // Bid is encrypted, revealed only at auction end
})

console.log('Bid committed:', bid.commitment)

// After auction ends, reveal and settle
const winner = await auction.reveal()
if (winner) {
  const settlement = await auction.settle({
    winnerMeta: winner.bidderMeta,
    sellerMeta: sellerStealthMeta,
  })
  console.log('Winner:', winner.commitment) // Not their address
  console.log('Settlement TX:', settlement.signature)
}
```

## 5. Provenance with Privacy

Track NFT history without revealing holder addresses:

```typescript
import { createPrivateOwnership } from '@sip-protocol/sdk'

// Each transfer creates ownership record
const ownership = await createPrivateOwnership({
  mint: 'NFT_MINT_ADDRESS',
  ownerMeta: currentOwnerMeta,
  previousOwnershipProof: previousOwnershipRecord,
})

// Verify chain of ownership
const provenanceValid = await ownership.verifyProvenance()
console.log('Provenance verified:', provenanceValid)
// Shows: NFT has valid chain of transfers
// Hides: actual addresses in the chain
```

## 6. Gated Access with Hidden Holders

Gate access to content/Discord without revealing who holds:

```typescript
// User proves they hold an NFT from collection
const accessProof = await proveOwnership({
  collection: 'COLLECTION_ADDRESS', // Any NFT from this collection
  stealthPrivateKey: userStealthKey,
  challenge: 'discord-server-join-' + Date.now(),
  // Prove membership without revealing which NFT
  hideTokenId: true,
})

// Server verifies
const hasAccess = await verifyOwnership({
  proof: accessProof,
  collection: 'COLLECTION_ADDRESS',
  challenge: accessProof.challenge,
})

// User gains access without server knowing:
// - Which specific NFT they hold
// - Their wallet address
// - Their other holdings
```

## Complete Marketplace Integration

```typescript
import {
  PrivateNFT,
  SealedBidAuction,
  generateStealthMetaAddress,
  encodeStealthMetaAddress,
  proveOwnership,
  verifyOwnership,
} from '@sip-protocol/sdk'

class PrivateNFTMarketplace {
  private nft: PrivateNFT

  constructor() {
    this.nft = new PrivateNFT({ network: 'mainnet' })
  }

  // List NFT for sale
  async list(params: {
    mint: string
    price: bigint
    sellerMeta: string
  }) {
    return this.nft.createListing(params)
  }

  // Buy NFT privately
  async buy(params: {
    listingId: string
    buyerMeta: string
  }) {
    // Generate one-time payment + receive addresses
    return this.nft.privatePurchase({
      listingId: params.listingId,
      buyerMeta: params.buyerMeta,
    })
  }

  // Create sealed-bid auction
  async createAuction(params: {
    mint: string
    reservePrice: bigint
    endTime: Date
    sellerMeta: string
  }) {
    return createSealedBidAuction(params)
  }

  // Verify ownership for gated access
  async verifyAccess(params: {
    proof: string
    collection: string
    challenge: string
  }) {
    return verifyOwnership(params)
  }

  // Generate stealth address for new user
  generateUserAddress() {
    const meta = generateStealthMetaAddress()
    return {
      address: encodeStealthMetaAddress(meta),
      // Store these securely
      spendingKey: meta.spendingKey.privateKey,
      viewingKey: meta.viewingKey.privateKey,
    }
  }
}

// Usage
const marketplace = new PrivateNFTMarketplace()

// Seller lists
const listing = await marketplace.list({
  mint: 'ABC123...',
  price: 10n * 10n**9n,
  sellerMeta: sellerAddress,
})

// Buyer creates private address and purchases
const buyer = marketplace.generateUserAddress()
const purchase = await marketplace.buy({
  listingId: listing.id,
  buyerMeta: buyer.address,
})

// Buyer can later prove ownership
const proof = await proveOwnership({
  mint: 'ABC123...',
  stealthPrivateKey: buyer.spendingKey,
  challenge: 'verify-ownership-123',
})
```

## Privacy Comparison

| Feature | Traditional | With SIP |
|---------|-------------|----------|
| Buyer address | Public | Hidden |
| Seller address | Public | Hidden (optional) |
| Sale price | Public | Hidden (optional) |
| Ownership history | Full addresses | Cryptographic proofs |
| Collection holdings | Visible | Private |

## Use Cases

1. **High-value collectors** - Hide holdings from thieves
2. **Celebrity NFTs** - Buy without paparazzi
3. **DAO treasuries** - Private art fund management
4. **Gaming items** - Trade without revealing main account
5. **Token-gated access** - Prove membership, not identity

## Next Steps

- [Payment App Integration](./QUICK-START-PAYMENTS.md)
- [Enterprise Compliance](./QUICK-START-COMPLIANCE.md)
- [Full API Reference](https://docs.sip-protocol.org/sdk)

---

Built with SIP Protocol - The Privacy Standard for Web3
