/**
 * NFT Module for SIP Protocol
 *
 * Private NFT ownership using stealth addresses and zero-knowledge proofs.
 *
 * @module nft
 */

export {
  PrivateNFT,
  createPrivateOwnership,
  proveOwnership,
  verifyOwnership,
} from './private-nft'

// Re-export types for convenience
export type {
  PrivateNFTOwnership,
  OwnershipProof,
  OwnershipVerification,
  CreatePrivateOwnershipParams,
  ProveOwnershipParams,
  TransferPrivatelyParams,
  TransferResult,
  NFTTransfer,
  OwnedNFT,
} from '@sip-protocol/types'
