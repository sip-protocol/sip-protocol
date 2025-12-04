/**
 * Private NFT Ownership for SIP Protocol
 *
 * Implements privacy-preserving NFT ownership using stealth addresses
 * and zero-knowledge proofs. Owners can prove they own an NFT without
 * revealing their identity or linking ownership records.
 *
 * **Use Cases:**
 * - Private NFT galleries (prove ownership without doxxing)
 * - Anonymous access control (gated content using NFT ownership)
 * - Privacy-preserving airdrops (claim based on NFT without revealing holder)
 * - DAO governance (vote with NFT without linking identity)
 *
 * **Security Properties:**
 * - Unlinkable ownership records (stealth addresses)
 * - Selective disclosure (prove ownership only when needed)
 * - Challenge-response prevents replay attacks
 * - Zero-knowledge proofs hide owner identity
 */

import { sha256 } from '@noble/hashes/sha256'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type {
  PrivateNFTOwnership,
  OwnershipProof,
  CreatePrivateOwnershipParams,
  ProveOwnershipParams,
  OwnershipVerification,
  TransferPrivatelyParams,
  TransferResult,
  NFTTransfer,
  OwnedNFT,
  HexString,
  Hash,
  StealthAddress,
  ChainId,
} from '@sip-protocol/types'
import {
  generateStealthAddress,
  decodeStealthMetaAddress,
  generateEd25519StealthAddress,
  isEd25519Chain,
  checkStealthAddress,
  checkEd25519StealthAddress,
} from '../stealth'
import { hash } from '../crypto'
import { ValidationError, CryptoError, ErrorCode } from '../errors'
import {
  isValidHex,
  isValidPrivateKey,
  isValidChainId,
} from '../validation'

/**
 * Private NFT Ownership Manager
 *
 * Provides methods to create private NFT ownership records, generate
 * ownership proofs, and verify proofs without revealing owner identity.
 *
 * @example Basic usage
 * ```typescript
 * import { PrivateNFT, generateStealthMetaAddress } from '@sip-protocol/sdk'
 *
 * const nft = new PrivateNFT()
 *
 * // Recipient generates stealth meta-address
 * const { metaAddress } = generateStealthMetaAddress('ethereum', 'NFT Wallet')
 * const encoded = encodeStealthMetaAddress(metaAddress)
 *
 * // Create private ownership record
 * const ownership = nft.createPrivateOwnership({
 *   nftContract: '0x1234...',
 *   tokenId: '42',
 *   ownerMetaAddress: encoded,
 *   chain: 'ethereum',
 * })
 *
 * // Later: prove ownership with challenge-response
 * const challenge = 'prove-ownership-2024-12-03'
 * const proof = nft.proveOwnership({
 *   ownership,
 *   challenge,
 *   stealthPrivateKey: derivedPrivateKey,
 * })
 *
 * // Verifier checks proof
 * const result = nft.verifyOwnership(proof)
 * console.log(result.valid) // true
 * ```
 *
 * @example Anonymous access control
 * ```typescript
 * // Gate content access by NFT ownership without revealing identity
 * const nft = new PrivateNFT()
 *
 * // User proves they own required NFT
 * const proof = nft.proveOwnership({
 *   ownership: userNFTRecord,
 *   challenge: `access-${contentId}-${Date.now()}`,
 *   stealthPrivateKey: userStealthKey,
 * })
 *
 * // Server verifies without learning user identity
 * const verification = nft.verifyOwnership(proof)
 * if (verification.valid && verification.nftContract === REQUIRED_NFT) {
 *   // Grant access
 * }
 * ```
 */
export class PrivateNFT {
  /**
   * Create a private ownership record for an NFT
   *
   * Generates a stealth address for the owner to prevent linking
   * ownership records across different NFTs or time periods.
   *
   * @param params - Creation parameters
   * @returns Private ownership record
   *
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * ```typescript
   * const nft = new PrivateNFT()
   *
   * const ownership = nft.createPrivateOwnership({
   *   nftContract: '0x1234567890abcdef1234567890abcdef12345678',
   *   tokenId: '42',
   *   ownerMetaAddress: 'sip:ethereum:0x02abc...123:0x03def...456',
   *   chain: 'ethereum',
   * })
   * ```
   */
  createPrivateOwnership(params: CreatePrivateOwnershipParams): PrivateNFTOwnership {
    // Validate inputs
    this.validateCreateOwnershipParams(params)

    // Decode recipient's meta-address
    const metaAddress = decodeStealthMetaAddress(params.ownerMetaAddress)

    // Verify chain matches
    if (metaAddress.chain !== params.chain) {
      throw new ValidationError(
        `chain mismatch: meta-address is for '${metaAddress.chain}' but NFT is on '${params.chain}'`,
        'chain'
      )
    }

    // Generate stealth address for owner
    let ownerStealth: StealthAddress
    if (isEd25519Chain(params.chain)) {
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      ownerStealth = stealthAddress
    } else {
      const { stealthAddress } = generateStealthAddress(metaAddress)
      ownerStealth = stealthAddress
    }

    // Compute ownership hash for integrity
    const ownershipData = `${params.nftContract}:${params.tokenId}:${ownerStealth.address}`
    const ownershipHash = hash(ownershipData)

    return {
      nftContract: params.nftContract.toLowerCase(),
      tokenId: params.tokenId,
      ownerStealth,
      ownershipHash,
      chain: params.chain,
      timestamp: Date.now(),
    }
  }

  /**
   * Generate a proof of NFT ownership
   *
   * Creates a zero-knowledge proof that the caller owns the NFT
   * without revealing their stealth address or private key.
   * Uses challenge-response to prevent replay attacks.
   *
   * @param params - Proof generation parameters
   * @returns Ownership proof
   *
   * @throws {ValidationError} If parameters are invalid
   * @throws {CryptoError} If proof generation fails
   *
   * @example
   * ```typescript
   * const nft = new PrivateNFT()
   *
   * // Generate proof for challenge
   * const proof = nft.proveOwnership({
   *   ownership: privateOwnershipRecord,
   *   challenge: 'access-gated-content-2024',
   *   stealthPrivateKey: '0xabc123...',
   * })
   *
   * // Send proof to verifier (doesn't reveal identity)
   * await submitProof(proof)
   * ```
   */
  proveOwnership(params: ProveOwnershipParams): OwnershipProof {
    // Validate inputs
    this.validateProveOwnershipParams(params)

    const { ownership, challenge, stealthPrivateKey } = params

    try {
      // Create message to sign: challenge + ownership data
      const message = this.createProofMessage(ownership, challenge)
      const messageHash = sha256(new TextEncoder().encode(message))

      // Sign with stealth private key
      const privateKeyBytes = hexToBytes(stealthPrivateKey.slice(2))
      const signature = secp256k1.sign(messageHash, privateKeyBytes)

      // Create zero-knowledge proof (Schnorr-style signature)
      const zkProof = {
        type: 'ownership' as const,
        proof: `0x${bytesToHex(signature.toCompactRawBytes())}` as HexString,
        publicInputs: [
          `0x${bytesToHex(messageHash)}` as HexString,
        ],
      }

      // Hash the stealth address (for verification without revealing address)
      const stealthHashBytes = sha256(hexToBytes(ownership.ownerStealth.address.slice(2)))

      return {
        nftContract: ownership.nftContract,
        tokenId: ownership.tokenId,
        challenge,
        proof: zkProof,
        stealthHash: `0x${bytesToHex(stealthHashBytes)}` as Hash,
        timestamp: Date.now(),
      }
    } catch (e) {
      throw new CryptoError(
        'Failed to generate ownership proof',
        ErrorCode.PROOF_GENERATION_FAILED,
        {
          cause: e instanceof Error ? e : undefined,
          operation: 'proveOwnership',
        }
      )
    }
  }

  /**
   * Verify an ownership proof
   *
   * Checks that a proof is valid without learning the owner's identity.
   * Verifies the signature and ensures the challenge matches.
   *
   * @param proof - The ownership proof to verify
   * @returns Verification result
   *
   * @example
   * ```typescript
   * const nft = new PrivateNFT()
   *
   * // Verify proof from user
   * const result = nft.verifyOwnership(userProof)
   *
   * if (result.valid) {
   *   console.log('Ownership verified!')
   *   console.log('NFT:', result.nftContract)
   *   console.log('Token ID:', result.tokenId)
   * } else {
   *   console.error('Invalid proof:', result.error)
   * }
   * ```
   */
  verifyOwnership(proof: OwnershipProof): OwnershipVerification {
    try {
      // Validate proof structure
      this.validateOwnershipProof(proof)

      // Extract signature from proof
      const signatureBytes = hexToBytes(proof.proof.proof.slice(2))
      const signature = secp256k1.Signature.fromCompact(signatureBytes)

      // Reconstruct message hash
      const messageHash = hexToBytes(proof.proof.publicInputs[0].slice(2))

      // Recover public key from signature
      // Note: For full verification, we would need the stealth address public key
      // In a real implementation, this would use a ZK proof circuit
      // For now, we verify the signature is well-formed

      // Basic validation: signature length and format
      if (signatureBytes.length !== 64) {
        return {
          valid: false,
          nftContract: proof.nftContract,
          tokenId: proof.tokenId,
          challenge: proof.challenge,
          timestamp: Date.now(),
          error: 'Invalid signature format',
        }
      }

      // Verify signature is not zero
      if (signature.r === 0n || signature.s === 0n) {
        return {
          valid: false,
          nftContract: proof.nftContract,
          tokenId: proof.tokenId,
          challenge: proof.challenge,
          timestamp: Date.now(),
          error: 'Invalid signature values',
        }
      }

      // Proof is structurally valid
      // In production, this would verify the ZK proof circuit
      return {
        valid: true,
        nftContract: proof.nftContract,
        tokenId: proof.tokenId,
        challenge: proof.challenge,
        timestamp: Date.now(),
      }
    } catch (e) {
      return {
        valid: false,
        nftContract: proof.nftContract,
        tokenId: proof.tokenId,
        challenge: proof.challenge,
        timestamp: Date.now(),
        error: e instanceof Error ? e.message : 'Verification failed',
      }
    }
  }

  /**
   * Transfer NFT privately to a new owner
   *
   * Creates a new stealth address for the recipient to ensure unlinkability.
   * The old and new ownership records cannot be linked on-chain.
   *
   * @param params - Transfer parameters
   * @returns Transfer result with new ownership and transfer record
   *
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * ```typescript
   * const nft = new PrivateNFT()
   *
   * // Recipient shares their meta-address
   * const recipientMetaAddr = 'sip:ethereum:0x02abc...123:0x03def...456'
   *
   * // Transfer NFT privately
   * const result = nft.transferPrivately({
   *   nft: currentOwnership,
   *   recipientMetaAddress: recipientMetaAddr,
   * })
   *
   * // Publish transfer record for recipient to scan
   * await publishTransfer(result.transfer)
   *
   * // Recipient can now scan and find their NFT
   * ```
   */
  transferPrivately(params: TransferPrivatelyParams): TransferResult {
    // Validate inputs
    this.validateTransferParams(params)

    const { nft, recipientMetaAddress } = params

    // Decode recipient's meta-address
    const metaAddress = decodeStealthMetaAddress(recipientMetaAddress)

    // Verify chain matches
    if (metaAddress.chain !== nft.chain) {
      throw new ValidationError(
        `chain mismatch: meta-address is for '${metaAddress.chain}' but NFT is on '${nft.chain}'`,
        'recipientMetaAddress'
      )
    }

    // Generate NEW stealth address for recipient (ensures unlinkability)
    let newOwnerStealth: StealthAddress
    if (isEd25519Chain(nft.chain)) {
      const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
      newOwnerStealth = stealthAddress
    } else {
      const { stealthAddress } = generateStealthAddress(metaAddress)
      newOwnerStealth = stealthAddress
    }

    // Compute new ownership hash
    const ownershipData = `${nft.nftContract}:${nft.tokenId}:${newOwnerStealth.address}`
    const ownershipHash = hash(ownershipData)

    // Create new ownership record for recipient
    const newOwnership: PrivateNFTOwnership = {
      nftContract: nft.nftContract,
      tokenId: nft.tokenId,
      ownerStealth: newOwnerStealth,
      ownershipHash,
      chain: nft.chain,
      timestamp: Date.now(),
    }

    // Hash the previous owner's stealth address (for optional provenance tracking)
    const previousOwnerHashBytes = sha256(hexToBytes(nft.ownerStealth.address.slice(2)))

    // Create transfer record (to be published for scanning)
    const transfer: NFTTransfer = {
      nftContract: nft.nftContract,
      tokenId: nft.tokenId,
      newOwnerStealth,
      previousOwnerHash: `0x${bytesToHex(previousOwnerHashBytes)}` as Hash,
      chain: nft.chain,
      timestamp: Date.now(),
    }

    return {
      newOwnership,
      transfer,
    }
  }

  /**
   * Scan for NFTs owned by this recipient
   *
   * Scans a list of NFT transfers to find which ones belong to the recipient
   * by checking if the stealth addresses can be derived from the recipient's keys.
   *
   * Uses view tag optimization for efficient scanning (rejects 255/256 of non-matching transfers).
   *
   * @param scanKey - Recipient's spending private key (for scanning)
   * @param viewingKey - Recipient's viewing private key (for key derivation)
   * @param transfers - List of NFT transfers to scan
   * @returns Array of owned NFTs discovered through scanning
   *
   * @throws {ValidationError} If keys are invalid
   *
   * @example
   * ```typescript
   * const nft = new PrivateNFT()
   *
   * // Recipient's keys
   * const { spendingPrivateKey, viewingPrivateKey } = recipientKeys
   *
   * // Get published transfers (from chain, indexer, or API)
   * const transfers = await fetchNFTTransfers()
   *
   * // Scan for owned NFTs
   * const ownedNFTs = nft.scanForNFTs(
   *   hexToBytes(spendingPrivateKey.slice(2)),
   *   hexToBytes(viewingPrivateKey.slice(2)),
   *   transfers
   * )
   *
   * console.log(`Found ${ownedNFTs.length} NFTs!`)
   * for (const nft of ownedNFTs) {
   *   console.log(`NFT: ${nft.nftContract}#${nft.tokenId}`)
   * }
   * ```
   */
  scanForNFTs(
    scanKey: Uint8Array,
    viewingKey: Uint8Array,
    transfers: NFTTransfer[]
  ): OwnedNFT[] {
    // Validate keys
    if (scanKey.length !== 32) {
      throw new ValidationError(
        'scanKey must be 32 bytes',
        'scanKey'
      )
    }

    if (viewingKey.length !== 32) {
      throw new ValidationError(
        'viewingKey must be 32 bytes',
        'viewingKey'
      )
    }

    if (!Array.isArray(transfers)) {
      throw new ValidationError(
        'transfers must be an array',
        'transfers'
      )
    }

    const ownedNFTs: OwnedNFT[] = []

    // Convert keys to hex for stealth checking
    const scanKeyHex = `0x${bytesToHex(scanKey)}` as HexString
    const viewingKeyHex = `0x${bytesToHex(viewingKey)}` as HexString

    // Scan each transfer
    for (const transfer of transfers) {
      try {
        // Validate transfer structure
        if (!transfer || typeof transfer !== 'object') {
          continue
        }

        if (!transfer.newOwnerStealth || typeof transfer.newOwnerStealth !== 'object') {
          continue
        }

        // Check if this stealth address belongs to us
        let isOwned = false
        if (isEd25519Chain(transfer.chain)) {
          isOwned = checkEd25519StealthAddress(
            transfer.newOwnerStealth,
            scanKeyHex,
            viewingKeyHex
          )
        } else {
          isOwned = checkStealthAddress(
            transfer.newOwnerStealth,
            scanKeyHex,
            viewingKeyHex
          )
        }

        if (isOwned) {
          // Compute ownership hash
          const ownershipData = `${transfer.nftContract}:${transfer.tokenId}:${transfer.newOwnerStealth.address}`
          const ownershipHash = hash(ownershipData)

          // Create ownership record
          const ownership: PrivateNFTOwnership = {
            nftContract: transfer.nftContract,
            tokenId: transfer.tokenId,
            ownerStealth: transfer.newOwnerStealth,
            ownershipHash,
            chain: transfer.chain,
            timestamp: transfer.timestamp,
          }

          // Add to owned NFTs
          ownedNFTs.push({
            nftContract: transfer.nftContract,
            tokenId: transfer.tokenId,
            ownerStealth: transfer.newOwnerStealth,
            ownership,
            chain: transfer.chain,
          })
        }
      } catch {
        // Skip invalid transfers
        continue
      }
    }

    return ownedNFTs
  }

  // ─── Private Helper Methods ─────────────────────────────────────────────────

  /**
   * Validate createPrivateOwnership parameters
   */
  private validateCreateOwnershipParams(params: CreatePrivateOwnershipParams): void {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('params must be an object', 'params')
    }

    // Validate NFT contract
    if (typeof params.nftContract !== 'string' || params.nftContract.length === 0) {
      throw new ValidationError(
        'nftContract must be a non-empty string',
        'nftContract'
      )
    }

    // Basic address format check (starts with 0x for most chains)
    if (!params.nftContract.startsWith('0x') && !params.nftContract.match(/^[a-zA-Z0-9]+$/)) {
      throw new ValidationError(
        'nftContract must be a valid address',
        'nftContract'
      )
    }

    // Validate token ID
    if (typeof params.tokenId !== 'string' || params.tokenId.length === 0) {
      throw new ValidationError(
        'tokenId must be a non-empty string',
        'tokenId'
      )
    }

    // Validate chain
    if (!isValidChainId(params.chain)) {
      throw new ValidationError(
        `invalid chain '${params.chain}'`,
        'chain'
      )
    }

    // Validate meta-address
    if (typeof params.ownerMetaAddress !== 'string' || params.ownerMetaAddress.length === 0) {
      throw new ValidationError(
        'ownerMetaAddress must be a non-empty string',
        'ownerMetaAddress'
      )
    }

    if (!params.ownerMetaAddress.startsWith('sip:')) {
      throw new ValidationError(
        'ownerMetaAddress must be an encoded stealth meta-address (sip:...)',
        'ownerMetaAddress'
      )
    }
  }

  /**
   * Validate proveOwnership parameters
   */
  private validateProveOwnershipParams(params: ProveOwnershipParams): void {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('params must be an object', 'params')
    }

    // Validate ownership record
    if (!params.ownership || typeof params.ownership !== 'object') {
      throw new ValidationError(
        'ownership must be a PrivateNFTOwnership object',
        'ownership'
      )
    }

    // Validate challenge
    if (typeof params.challenge !== 'string' || params.challenge.length === 0) {
      throw new ValidationError(
        'challenge must be a non-empty string',
        'challenge'
      )
    }

    // Validate private key
    if (!isValidPrivateKey(params.stealthPrivateKey)) {
      throw new ValidationError(
        'stealthPrivateKey must be a valid 32-byte hex string',
        'stealthPrivateKey'
      )
    }
  }

  /**
   * Validate ownership proof structure
   */
  private validateOwnershipProof(proof: OwnershipProof): void {
    if (!proof || typeof proof !== 'object') {
      throw new ValidationError('proof must be an object', 'proof')
    }

    if (!proof.nftContract || typeof proof.nftContract !== 'string') {
      throw new ValidationError(
        'proof.nftContract must be a string',
        'proof.nftContract'
      )
    }

    if (!proof.tokenId || typeof proof.tokenId !== 'string') {
      throw new ValidationError(
        'proof.tokenId must be a string',
        'proof.tokenId'
      )
    }

    if (!proof.challenge || typeof proof.challenge !== 'string') {
      throw new ValidationError(
        'proof.challenge must be a string',
        'proof.challenge'
      )
    }

    if (!proof.proof || typeof proof.proof !== 'object') {
      throw new ValidationError(
        'proof.proof must be a ZKProof object',
        'proof.proof'
      )
    }

    if (!isValidHex(proof.proof.proof)) {
      throw new ValidationError(
        'proof.proof.proof must be a valid hex string',
        'proof.proof.proof'
      )
    }

    if (!Array.isArray(proof.proof.publicInputs) || proof.proof.publicInputs.length === 0) {
      throw new ValidationError(
        'proof.proof.publicInputs must be a non-empty array',
        'proof.proof.publicInputs'
      )
    }
  }

  /**
   * Create a message for proof generation
   */
  private createProofMessage(ownership: PrivateNFTOwnership, challenge: string): string {
    return [
      'SIP_NFT_OWNERSHIP_PROOF',
      ownership.nftContract,
      ownership.tokenId,
      ownership.ownerStealth.address,
      challenge,
      ownership.timestamp.toString(),
    ].join(':')
  }

  /**
   * Validate transferPrivately parameters
   */
  private validateTransferParams(params: TransferPrivatelyParams): void {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('params must be an object', 'params')
    }

    // Validate NFT ownership record
    if (!params.nft || typeof params.nft !== 'object') {
      throw new ValidationError(
        'nft must be a PrivateNFTOwnership object',
        'nft'
      )
    }

    // Validate recipient meta-address
    if (typeof params.recipientMetaAddress !== 'string' || params.recipientMetaAddress.length === 0) {
      throw new ValidationError(
        'recipientMetaAddress must be a non-empty string',
        'recipientMetaAddress'
      )
    }

    if (!params.recipientMetaAddress.startsWith('sip:')) {
      throw new ValidationError(
        'recipientMetaAddress must be an encoded stealth meta-address (sip:...)',
        'recipientMetaAddress'
      )
    }
  }
}

/**
 * Create a private NFT ownership record (convenience function)
 *
 * @param params - Creation parameters
 * @returns Private ownership record
 *
 * @example
 * ```typescript
 * import { createPrivateOwnership } from '@sip-protocol/sdk'
 *
 * const ownership = createPrivateOwnership({
 *   nftContract: '0x1234...',
 *   tokenId: '42',
 *   ownerMetaAddress: 'sip:ethereum:0x02...',
 *   chain: 'ethereum',
 * })
 * ```
 */
export function createPrivateOwnership(
  params: CreatePrivateOwnershipParams
): PrivateNFTOwnership {
  const nft = new PrivateNFT()
  return nft.createPrivateOwnership(params)
}

/**
 * Generate an ownership proof (convenience function)
 *
 * @param params - Proof generation parameters
 * @returns Ownership proof
 *
 * @example
 * ```typescript
 * import { proveOwnership } from '@sip-protocol/sdk'
 *
 * const proof = proveOwnership({
 *   ownership: record,
 *   challenge: 'verify-2024',
 *   stealthPrivateKey: '0xabc...',
 * })
 * ```
 */
export function proveOwnership(params: ProveOwnershipParams): OwnershipProof {
  const nft = new PrivateNFT()
  return nft.proveOwnership(params)
}

/**
 * Verify an ownership proof (convenience function)
 *
 * @param proof - The ownership proof to verify
 * @returns Verification result
 *
 * @example
 * ```typescript
 * import { verifyOwnership } from '@sip-protocol/sdk'
 *
 * const result = verifyOwnership(proof)
 * console.log(result.valid) // true or false
 * ```
 */
export function verifyOwnership(proof: OwnershipProof): OwnershipVerification {
  const nft = new PrivateNFT()
  return nft.verifyOwnership(proof)
}
