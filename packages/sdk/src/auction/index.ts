/**
 * Sealed-Bid Auction Module
 *
 * Cryptographic primitives for privacy-preserving sealed-bid auctions.
 *
 * @module auction
 */

export {
  SealedBidAuction,
  createSealedBidAuction,
  type SealedBid,
  type BidReceipt,
  type RevealedBid,
  type CreateBidParams,
  type VerifyBidParams,
} from './sealed-bid'

// Re-export winner verification types from @sip-protocol/types
export type { WinnerResult, WinnerProof, WinnerVerification } from '@sip-protocol/types'
