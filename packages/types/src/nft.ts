/**
 * NFT Types for SIP Protocol
 *
 * Types for private NFT ownership using stealth addresses and zero-knowledge proofs.
 */

import type { HexString, Hash, ZKProof } from './crypto'
import type { ChainId, StealthAddress } from './stealth'

/**
 * Private NFT ownership record
 *
 * Stores the relationship between an NFT and its private owner
 * using stealth addresses for unlinkability.
 */
export interface PrivateNFTOwnership {
  /** NFT contract address */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** Stealth address of the owner (unlinkable) */
  ownerStealth: StealthAddress
  /** Hash of ownership data for integrity */
  ownershipHash: Hash
  /** Chain where NFT exists */
  chain: ChainId
  /** Timestamp of ownership creation */
  timestamp: number
}

/**
 * Proof that someone owns a specific NFT without revealing their identity
 */
export interface OwnershipProof {
  /** The NFT being proven */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** Challenge that was signed */
  challenge: string
  /** Zero-knowledge proof of ownership */
  proof: ZKProof
  /** Hash of the stealth address (for verification without revealing address) */
  stealthHash: Hash
  /** Timestamp of proof generation */
  timestamp: number
}

/**
 * Parameters for creating private NFT ownership
 */
export interface CreatePrivateOwnershipParams {
  /** NFT contract address */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** Recipient's stealth meta-address (encoded) */
  ownerMetaAddress: string
  /** Chain where NFT exists */
  chain: ChainId
}

/**
 * Parameters for proving NFT ownership
 */
export interface ProveOwnershipParams {
  /** Private ownership record */
  ownership: PrivateNFTOwnership
  /** Challenge string to prove freshness */
  challenge: string
  /** Stealth address private key */
  stealthPrivateKey: HexString
}

/**
 * Result of ownership verification
 */
export interface OwnershipVerification {
  /** Whether proof is valid */
  valid: boolean
  /** NFT contract address */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** Challenge that was verified */
  challenge: string
  /** Timestamp of verification */
  timestamp: number
  /** Error message if invalid */
  error?: string
}

/**
 * Parameters for transferring NFT privately
 */
export interface TransferPrivatelyParams {
  /** Current private ownership record */
  nft: PrivateNFTOwnership
  /** Recipient's stealth meta-address (encoded) */
  recipientMetaAddress: string
}

/**
 * Result of private NFT transfer
 */
export interface TransferResult {
  /** New ownership record for recipient */
  newOwnership: PrivateNFTOwnership
  /** Transfer record for publication */
  transfer: NFTTransfer
}

/**
 * NFT transfer record (published on-chain or off-chain)
 *
 * This record is made public so recipients can scan for their NFTs.
 * It contains the ephemeral key needed for recipients to detect ownership.
 */
export interface NFTTransfer {
  /** NFT contract address */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** New owner's stealth address */
  newOwnerStealth: StealthAddress
  /** Previous owner's stealth hash (for provenance, optional) */
  previousOwnerHash?: Hash
  /** Chain where NFT exists */
  chain: ChainId
  /** Timestamp of transfer */
  timestamp: number
}

/**
 * NFT owned by recipient (discovered through scanning)
 */
export interface OwnedNFT {
  /** NFT contract address */
  nftContract: string
  /** Token ID */
  tokenId: string
  /** Recipient's stealth address for this NFT */
  ownerStealth: StealthAddress
  /** Full ownership record */
  ownership: PrivateNFTOwnership
  /** Chain where NFT exists */
  chain: ChainId
}
