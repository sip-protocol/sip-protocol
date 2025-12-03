/**
 * Private Voting for SIP Protocol
 *
 * Provides encrypted voting with timelock or committee key encryption.
 * Enables private DAO governance where votes are hidden during voting period
 * and revealed after deadline or by committee decision.
 *
 * ## Security Properties
 * - **Confidentiality**: Votes encrypted until revelation
 * - **Integrity**: Authentication tag prevents tampering
 * - **Verifiability**: Revealed votes can be verified against encrypted versions
 *
 * ## Use Cases
 * - Private DAO governance proposals
 * - Confidential treasury spending votes
 * - Timelock-based vote revelation
 * - Committee-controlled vote disclosure
 */

import type { HexString } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { hkdf } from '@noble/hashes/hkdf'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { ValidationError, CryptoError, ErrorCode } from '../errors'
import { secureWipe } from '../secure-memory'
import { isValidHex } from '../validation'
import { commit, addCommitments, generateBlinding } from '../commitment'

/**
 * Domain separation for vote encryption key derivation
 */
const VOTE_ENCRYPTION_DOMAIN = 'SIP-PRIVATE-VOTE-ENCRYPTION-V1'

/**
 * XChaCha20-Poly1305 nonce size (24 bytes)
 */
const NONCE_SIZE = 24

/**
 * Maximum size for vote data (1MB)
 * Prevents DoS attacks via large payloads
 */
const MAX_VOTE_DATA_SIZE = 1024 * 1024

/**
 * Encrypted vote data
 */
export interface EncryptedVote {
  /** The encrypted vote data (includes authentication tag) */
  ciphertext: HexString
  /** Nonce used for encryption (needed for decryption) */
  nonce: HexString
  /** Hash of the encryption key used (for key identification) */
  encryptionKeyHash: HexString
  /** Proposal ID this vote is for */
  proposalId: string
  /** Voter's identifier (public key or address) */
  voter: string
  /** Timestamp when vote was cast */
  timestamp: number
}

/**
 * Revealed vote data
 */
export interface RevealedVote {
  /** Proposal ID */
  proposalId: string
  /** Vote choice (e.g., 0 = no, 1 = yes, 2 = abstain) */
  choice: number
  /** Voting weight/power */
  weight: bigint
  /** Voter's identifier */
  voter: string
  /** Timestamp when vote was cast */
  timestamp: number
  /** The encrypted vote this was revealed from */
  encryptedVote: EncryptedVote
}

/**
 * Encrypted tally of aggregated votes
 *
 * Uses Pedersen commitment homomorphism to sum votes without decrypting
 * individual votes. Each choice gets a separate commitment.
 */
export interface EncryptedTally {
  /** Proposal ID this tally is for */
  proposalId: string
  /** Map of choice -> aggregated commitment (choice as string key) */
  tallies: Record<string, HexString>
  /**
   * Encrypted blinding factors for each choice (committee holds decryption key)
   * This is encrypted with XChaCha20-Poly1305 using committee key
   */
  encryptedBlindings: Record<string, { ciphertext: HexString; nonce: HexString }>
  /** Number of votes included in this tally */
  voteCount: number
  /** Timestamp when tally was computed */
  timestamp: number
}

/**
 * Final revealed tally results
 */
export interface TallyResult {
  /** Proposal ID */
  proposalId: string
  /** Map of choice -> total weight (choice as string key) */
  results: Record<string, bigint>
  /** Total number of votes tallied */
  voteCount: number
  /** Timestamp when tally was revealed */
  timestamp: number
  /** The encrypted tally this was revealed from */
  encryptedTally: EncryptedTally
}

/**
 * Decryption share from a committee member
 *
 * In threshold cryptography, each committee member contributes a share
 * to collectively decrypt the tally.
 */
export interface DecryptionShare {
  /** Committee member's identifier */
  memberId: string
  /** The decryption share data */
  share: HexString
  /** Signature or proof that this share is valid (future use) */
  proof?: HexString
}

/**
 * Parameters for casting a vote
 */
export interface CastVoteParams {
  /** Proposal ID to vote on */
  proposalId: string
  /** Vote choice (e.g., 0 = no, 1 = yes, 2 = abstain) */
  choice: number
  /** Voting weight/power */
  weight: bigint
  /** Encryption key (timelock or committee key) */
  encryptionKey: string
  /** Optional voter identifier (defaults to 'anonymous') */
  voter?: string
}

/**
 * Vote data that gets encrypted
 */
interface VoteData {
  proposalId: string
  choice: number
  weight: string // bigint serialized as string
  voter: string
  timestamp: number
}

/**
 * Private voting implementation with encryption
 *
 * Enables confidential voting where votes are encrypted during the voting period
 * and can be revealed later with the appropriate decryption key.
 *
 * @example Cast encrypted vote
 * ```typescript
 * const voting = new PrivateVoting()
 *
 * // Committee derives a shared encryption key
 * const encryptionKey = deriveCommitteeKey(...)
 *
 * const encryptedVote = voting.castVote({
 *   proposalId: 'proposal-123',
 *   choice: 1, // yes
 *   weight: 1000n,
 *   encryptionKey,
 * })
 *
 * // Store encrypted vote on-chain or in database
 * await storeVote(encryptedVote)
 * ```
 *
 * @example Reveal votes after deadline
 * ```typescript
 * // After voting period ends, reveal votes
 * const decryptionKey = unlockTimelockKey(...)
 *
 * const revealed = voting.revealVote(
 *   encryptedVote,
 *   decryptionKey
 * )
 *
 * console.log(`Vote for proposal ${revealed.proposalId}:`)
 * console.log(`  Choice: ${revealed.choice}`)
 * console.log(`  Weight: ${revealed.weight}`)
 * ```
 *
 * @example Committee-controlled revelation
 * ```typescript
 * // Committee member reveals vote when authorized
 * const committeeKey = getCommitteeMemberKey(memberId)
 *
 * try {
 *   const revealed = voting.revealVote(encryptedVote, committeeKey)
 *   // Process revealed vote
 * } catch (e) {
 *   console.error('Unauthorized revelation attempt')
 * }
 * ```
 */
export class PrivateVoting {
  /**
   * Cast an encrypted vote
   *
   * Encrypts vote data using XChaCha20-Poly1305 authenticated encryption.
   * The encryption key is typically derived from:
   * - Timelock encryption (reveals after specific time)
   * - Committee multisig key (reveals by committee decision)
   * - Threshold scheme (reveals when threshold reached)
   *
   * @param params - Vote casting parameters
   * @returns Encrypted vote that can be stored publicly
   *
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * ```typescript
   * const voting = new PrivateVoting()
   *
   * const encryptedVote = voting.castVote({
   *   proposalId: 'prop-001',
   *   choice: 1,
   *   weight: 100n,
   *   encryptionKey: '0xabc...',
   * })
   * ```
   */
  castVote(params: CastVoteParams): EncryptedVote {
    // Validate parameters
    this.validateCastVoteParams(params)

    const { proposalId, choice, weight, encryptionKey, voter = 'anonymous' } = params

    // Derive encryption key from provided key
    const derivedKey = this.deriveEncryptionKey(encryptionKey, proposalId)

    try {
      // Generate random nonce (24 bytes for XChaCha20)
      const nonce = randomBytes(NONCE_SIZE)

      // Prepare vote data
      const voteData: VoteData = {
        proposalId,
        choice,
        weight: weight.toString(),
        voter,
        timestamp: Date.now(),
      }

      // Serialize to JSON
      const plaintext = utf8ToBytes(JSON.stringify(voteData))

      // Encrypt with XChaCha20-Poly1305
      const cipher = xchacha20poly1305(derivedKey, nonce)
      const ciphertext = cipher.encrypt(plaintext)

      // Compute encryption key hash for identification
      const keyHash = sha256(hexToBytes(encryptionKey.slice(2)))

      return {
        ciphertext: `0x${bytesToHex(ciphertext)}` as HexString,
        nonce: `0x${bytesToHex(nonce)}` as HexString,
        encryptionKeyHash: `0x${bytesToHex(keyHash)}` as HexString,
        proposalId,
        voter,
        timestamp: voteData.timestamp,
      }
    } finally {
      // Securely wipe derived key after use
      secureWipe(derivedKey)
    }
  }

  /**
   * Reveal an encrypted vote
   *
   * Decrypts vote data using the provided decryption key. The key must match
   * the original encryption key used when casting the vote.
   *
   * @param vote - Encrypted vote to reveal
   * @param decryptionKey - Key to decrypt the vote (must match encryption key)
   * @returns Revealed vote data
   *
   * @throws {CryptoError} If decryption fails (wrong key or tampered data)
   * @throws {ValidationError} If vote data is invalid
   *
   * @example
   * ```typescript
   * const voting = new PrivateVoting()
   *
   * try {
   *   const revealed = voting.revealVote(encryptedVote, decryptionKey)
   *   console.log(`Choice: ${revealed.choice}, Weight: ${revealed.weight}`)
   * } catch (e) {
   *   console.error('Failed to reveal vote:', e.message)
   * }
   * ```
   */
  revealVote(
    vote: EncryptedVote,
    decryptionKey: string,
  ): RevealedVote {
    // Validate encrypted vote
    this.validateEncryptedVote(vote)

    // Validate decryption key
    if (!isValidHex(decryptionKey)) {
      throw new ValidationError(
        'decryptionKey must be a valid hex string with 0x prefix',
        'decryptionKey',
        undefined,
        ErrorCode.INVALID_KEY
      )
    }

    // Derive encryption key (same process as encryption)
    const derivedKey = this.deriveEncryptionKey(decryptionKey, vote.proposalId)

    try {
      // Verify key hash matches (optional but helpful error message)
      const keyHash = sha256(hexToBytes(decryptionKey.slice(2)))
      const expectedKeyHash = `0x${bytesToHex(keyHash)}` as HexString

      if (vote.encryptionKeyHash !== expectedKeyHash) {
        throw new CryptoError(
          'Decryption key hash mismatch - this key cannot decrypt this vote',
          ErrorCode.DECRYPTION_FAILED,
          { operation: 'revealVote' }
        )
      }

      // Parse nonce and ciphertext
      const nonceHex = vote.nonce.startsWith('0x') ? vote.nonce.slice(2) : vote.nonce
      const nonce = hexToBytes(nonceHex)

      const ciphertextHex = vote.ciphertext.startsWith('0x')
        ? vote.ciphertext.slice(2)
        : vote.ciphertext
      const ciphertext = hexToBytes(ciphertextHex)

      // Decrypt with XChaCha20-Poly1305
      const cipher = xchacha20poly1305(derivedKey, nonce)
      let plaintext: Uint8Array

      try {
        plaintext = cipher.decrypt(ciphertext)
      } catch (e) {
        throw new CryptoError(
          'Decryption failed - authentication tag verification failed. ' +
          'Either the decryption key is incorrect or the vote has been tampered with.',
          ErrorCode.DECRYPTION_FAILED,
          {
            cause: e instanceof Error ? e : undefined,
            operation: 'revealVote',
          }
        )
      }

      // Parse JSON
      const textDecoder = new TextDecoder()
      const jsonString = textDecoder.decode(plaintext)

      // Validate size
      if (jsonString.length > MAX_VOTE_DATA_SIZE) {
        throw new ValidationError(
          `decrypted vote data exceeds maximum size limit (${MAX_VOTE_DATA_SIZE} bytes)`,
          'voteData',
          { received: jsonString.length, max: MAX_VOTE_DATA_SIZE },
          ErrorCode.INVALID_INPUT
        )
      }

      // Parse and validate vote data
      let voteData: VoteData
      try {
        voteData = JSON.parse(jsonString) as VoteData
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new CryptoError(
            'Decryption succeeded but vote data is malformed JSON',
            ErrorCode.DECRYPTION_FAILED,
            { cause: e, operation: 'revealVote' }
          )
        }
        throw e
      }

      // Validate required fields
      if (
        typeof voteData.proposalId !== 'string' ||
        typeof voteData.choice !== 'number' ||
        typeof voteData.weight !== 'string' ||
        typeof voteData.voter !== 'string' ||
        typeof voteData.timestamp !== 'number'
      ) {
        throw new ValidationError(
          'invalid vote data format',
          'voteData',
          { received: voteData },
          ErrorCode.INVALID_INPUT
        )
      }

      // Verify proposal ID matches
      if (voteData.proposalId !== vote.proposalId) {
        throw new ValidationError(
          'proposal ID mismatch between encrypted vote and decrypted data',
          'proposalId',
          { encrypted: vote.proposalId, decrypted: voteData.proposalId },
          ErrorCode.INVALID_INPUT
        )
      }

      // Parse weight from string
      let weight: bigint
      try {
        weight = BigInt(voteData.weight)
      } catch (e) {
        throw new ValidationError(
          'invalid weight value',
          'weight',
          { received: voteData.weight },
          ErrorCode.INVALID_AMOUNT
        )
      }

      return {
        proposalId: voteData.proposalId,
        choice: voteData.choice,
        weight,
        voter: voteData.voter,
        timestamp: voteData.timestamp,
        encryptedVote: vote,
      }
    } finally {
      // Securely wipe derived key after use
      secureWipe(derivedKey)
    }
  }

  /**
   * Derive encryption key from provided key using HKDF
   *
   * Uses HKDF-SHA256 with domain separation for security.
   * Incorporates proposal ID for key binding.
   *
   * @param key - Source encryption key
   * @param proposalId - Proposal ID for key binding
   * @returns 32-byte derived encryption key (caller must wipe after use)
   */
  private deriveEncryptionKey(key: string, proposalId: string): Uint8Array {
    // Extract the raw key bytes (remove 0x prefix if present)
    const keyHex = key.startsWith('0x') ? key.slice(2) : key
    const keyBytes = hexToBytes(keyHex)

    try {
      // Use HKDF to derive a proper encryption key
      // HKDF(SHA256, ikm=key, salt=domain, info=proposalId, length=32)
      const salt = utf8ToBytes(VOTE_ENCRYPTION_DOMAIN)
      const info = utf8ToBytes(proposalId)

      return hkdf(sha256, keyBytes, salt, info, 32)
    } finally {
      // Securely wipe source key bytes
      secureWipe(keyBytes)
    }
  }

  /**
   * Validate cast vote parameters
   */
  private validateCastVoteParams(params: CastVoteParams): void {
    const { proposalId, choice, weight, encryptionKey, voter } = params

    // Validate proposal ID
    if (typeof proposalId !== 'string' || proposalId.length === 0) {
      throw new ValidationError(
        'proposalId must be a non-empty string',
        'proposalId',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    // Validate choice
    if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0) {
      throw new ValidationError(
        'choice must be a non-negative integer',
        'choice',
        { received: choice },
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate weight
    if (typeof weight !== 'bigint') {
      throw new ValidationError(
        'weight must be a bigint',
        'weight',
        { received: typeof weight },
        ErrorCode.INVALID_AMOUNT
      )
    }

    if (weight < 0n) {
      throw new ValidationError(
        'weight must be non-negative',
        'weight',
        { received: weight.toString() },
        ErrorCode.INVALID_AMOUNT
      )
    }

    // Validate encryption key
    if (!isValidHex(encryptionKey)) {
      throw new ValidationError(
        'encryptionKey must be a valid hex string with 0x prefix',
        'encryptionKey',
        undefined,
        ErrorCode.INVALID_KEY
      )
    }

    // Validate voter (optional)
    if (voter !== undefined && typeof voter !== 'string') {
      throw new ValidationError(
        'voter must be a string',
        'voter',
        { received: typeof voter },
        ErrorCode.INVALID_INPUT
      )
    }
  }

  /**
   * Tally votes homomorphically
   *
   * Aggregates encrypted votes by summing Pedersen commitments for each choice.
   * Individual votes remain hidden - only the final tally can be revealed.
   *
   * This leverages the homomorphic property of Pedersen commitments:
   * C(v1) + C(v2) = C(v1 + v2) when blindings are properly tracked.
   *
   * **Note:** In this simplified implementation, we reveal individual votes to
   * compute commitments for each choice. A full production implementation would
   * use commitments directly from votes without decryption.
   *
   * @param votes - Array of encrypted votes to tally
   * @param decryptionKey - Key to decrypt votes (committee key)
   * @returns Encrypted tally with aggregated commitments per choice
   *
   * @throws {ValidationError} If votes array is empty or has inconsistent proposal IDs
   * @throws {CryptoError} If decryption fails
   *
   * @example
   * ```typescript
   * const voting = new PrivateVoting()
   * const encryptionKey = generateRandomBytes(32)
   *
   * // Cast multiple votes
   * const votes = [
   *   voting.castVote({ proposalId: 'p1', choice: 0, weight: 100n, encryptionKey }),
   *   voting.castVote({ proposalId: 'p1', choice: 1, weight: 200n, encryptionKey }),
   *   voting.castVote({ proposalId: 'p1', choice: 0, weight: 150n, encryptionKey }),
   * ]
   *
   * // Tally homomorphically
   * const tally = voting.tallyVotes(votes, encryptionKey)
   * // tally contains: choice 0 -> commitment(250), choice 1 -> commitment(200)
   * ```
   */
  tallyVotes(votes: EncryptedVote[], decryptionKey: string): EncryptedTally {
    // Validate inputs
    if (!Array.isArray(votes)) {
      throw new ValidationError(
        'votes must be an array',
        'votes',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (votes.length === 0) {
      throw new ValidationError(
        'votes array cannot be empty',
        'votes',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate all votes are for the same proposal
    const proposalId = votes[0].proposalId
    for (const vote of votes) {
      if (vote.proposalId !== proposalId) {
        throw new ValidationError(
          'all votes must be for the same proposal',
          'votes',
          { expected: proposalId, received: vote.proposalId },
          ErrorCode.INVALID_INPUT
        )
      }
    }

    // Validate decryption key
    if (!isValidHex(decryptionKey)) {
      throw new ValidationError(
        'decryptionKey must be a valid hex string with 0x prefix',
        'decryptionKey',
        undefined,
        ErrorCode.INVALID_KEY
      )
    }

    // Decrypt all votes and group by choice
    const votesByChoice: Record<string, bigint[]> = {}

    for (const encryptedVote of votes) {
      const revealed = this.revealVote(encryptedVote, decryptionKey)
      const choiceKey = revealed.choice.toString()

      if (!votesByChoice[choiceKey]) {
        votesByChoice[choiceKey] = []
      }
      votesByChoice[choiceKey].push(revealed.weight)
    }

    // Create commitments for each choice's total
    const tallies: Record<string, HexString> = {}
    const blindings: Record<string, HexString> = {}

    for (const [choice, weights] of Object.entries(votesByChoice)) {
      // Sum weights for this choice
      const totalWeight = weights.reduce((sum, w) => sum + w, 0n)

      // Create Pedersen commitment to the total
      // In production, you'd aggregate commitments directly without revealing
      // Here we commit to the sum for simplicity
      const { commitment, blinding } = commit(totalWeight, hexToBytes(generateBlinding().slice(2)))
      tallies[choice] = commitment
      blindings[choice] = blinding
    }

    // Encrypt the blinding factors with the decryption key
    // This allows the committee to later reveal the tally
    const encryptedBlindings: Record<string, { ciphertext: HexString; nonce: HexString }> = {}

    for (const [choice, blinding] of Object.entries(blindings)) {
      // Generate nonce for encryption
      const nonce = randomBytes(NONCE_SIZE)

      // Derive encryption key
      const derivedKey = this.deriveEncryptionKey(decryptionKey, `${proposalId}-tally-${choice}`)

      try {
        // Encrypt the blinding factor
        const cipher = xchacha20poly1305(derivedKey, nonce)
        const blindingBytes = hexToBytes(blinding.slice(2))
        const ciphertext = cipher.encrypt(blindingBytes)

        encryptedBlindings[choice] = {
          ciphertext: `0x${bytesToHex(ciphertext)}` as HexString,
          nonce: `0x${bytesToHex(nonce)}` as HexString,
        }
      } finally {
        secureWipe(derivedKey)
      }
    }

    return {
      proposalId,
      tallies,
      encryptedBlindings,
      voteCount: votes.length,
      timestamp: Date.now(),
    }
  }

  /**
   * Reveal the final tally using threshold decryption
   *
   * In a full threshold cryptography implementation, t-of-n committee members
   * would each provide a decryption share. When enough shares are collected,
   * the tally can be revealed.
   *
   * **Note:** This simplified implementation uses a single decryption key.
   * A production system would implement proper threshold secret sharing
   * (e.g., Shamir's Secret Sharing) for committee-based decryption.
   *
   * @param tally - Encrypted tally to reveal
   * @param decryptionShares - Decryption shares from committee members
   * @returns Final tally results with revealed vote counts per choice
   *
   * @throws {ValidationError} If tally is invalid or insufficient shares provided
   * @throws {CryptoError} If threshold reconstruction fails
   *
   * @example
   * ```typescript
   * const voting = new PrivateVoting()
   *
   * // After tallying...
   * const shares = [
   *   { memberId: 'member1', share: '0xabc...' },
   *   { memberId: 'member2', share: '0xdef...' },
   *   { memberId: 'member3', share: '0x123...' },
   * ]
   *
   * const results = voting.revealTally(encryptedTally, shares)
   * console.log(results.results) // { "0": 250n, "1": 200n }
   * ```
   */
  revealTally(
    tally: EncryptedTally,
    decryptionShares: DecryptionShare[],
  ): TallyResult {
    // Validate tally
    this.validateEncryptedTally(tally)

    // Validate decryption shares
    if (!Array.isArray(decryptionShares)) {
      throw new ValidationError(
        'decryptionShares must be an array',
        'decryptionShares',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (decryptionShares.length === 0) {
      throw new ValidationError(
        'must provide at least one decryption share',
        'decryptionShares',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate each share
    for (const share of decryptionShares) {
      if (!share || typeof share !== 'object') {
        throw new ValidationError(
          'each decryption share must be an object',
          'decryptionShares',
          undefined,
          ErrorCode.INVALID_INPUT
        )
      }

      if (typeof share.memberId !== 'string' || share.memberId.length === 0) {
        throw new ValidationError(
          'each share must have a non-empty memberId',
          'decryptionShares.memberId',
          undefined,
          ErrorCode.INVALID_INPUT
        )
      }

      if (!isValidHex(share.share)) {
        throw new ValidationError(
          'each share.share must be a valid hex string',
          'decryptionShares.share',
          undefined,
          ErrorCode.INVALID_ENCRYPTED_DATA
        )
      }
    }

    // In this simplified implementation, we reconstruct the decryption key
    // from the shares. In production, this would use Shamir's Secret Sharing
    // or a proper threshold scheme.
    //
    // For now, we'll use XOR reconstruction (simplified 1-of-n threshold)
    let reconstructedKey: Uint8Array | null = null

    try {
      // Simple XOR reconstruction (toy example)
      reconstructedKey = hexToBytes(decryptionShares[0].share.slice(2))

      for (let i = 1; i < decryptionShares.length; i++) {
        const shareBytes = hexToBytes(decryptionShares[i].share.slice(2))

        if (shareBytes.length !== reconstructedKey.length) {
          throw new ValidationError(
            'all decryption shares must have the same length',
            'decryptionShares',
            undefined,
            ErrorCode.INVALID_INPUT
          )
        }

        for (let j = 0; j < reconstructedKey.length; j++) {
          reconstructedKey[j] ^= shareBytes[j]
        }
      }

      // Convert reconstructed key to hex
      const reconstructedKeyHex = `0x${bytesToHex(reconstructedKey)}` as HexString

      // Decrypt blinding factors and brute-force search for values
      const results: Record<string, bigint> = {}

      for (const [choice, commitmentPoint] of Object.entries(tally.tallies)) {
        // Decrypt the blinding factor for this choice
        const encBlinding = tally.encryptedBlindings[choice]
        if (!encBlinding) {
          throw new CryptoError(
            `missing encrypted blinding factor for choice ${choice}`,
            ErrorCode.DECRYPTION_FAILED,
            { operation: 'revealTally', context: { choice } }
          )
        }

        // Derive decryption key for this choice's blinding
        const derivedKey = this.deriveEncryptionKey(
          reconstructedKeyHex,
          `${tally.proposalId}-tally-${choice}`
        )

        let blindingFactor: HexString
        try {
          // Decrypt the blinding factor
          const nonceBytes = hexToBytes(encBlinding.nonce.slice(2))
          const ciphertextBytes = hexToBytes(encBlinding.ciphertext.slice(2))

          const cipher = xchacha20poly1305(derivedKey, nonceBytes)
          const blindingBytes = cipher.decrypt(ciphertextBytes)

          blindingFactor = `0x${bytesToHex(blindingBytes)}` as HexString
        } catch (e) {
          throw new CryptoError(
            'failed to decrypt blinding factor',
            ErrorCode.DECRYPTION_FAILED,
            {
              cause: e instanceof Error ? e : undefined,
              operation: 'revealTally',
              context: { choice },
            }
          )
        } finally {
          secureWipe(derivedKey)
        }

        // Now brute-force search for the value
        // In production, you'd use ZK range proofs to avoid this
        let found = false
        const maxTries = 1000000n // Reasonable limit for vote counts

        for (let value = 0n; value <= maxTries; value++) {
          try {
            // Try to create a commitment with this value and the decrypted blinding
            const { commitment: testCommit } = commit(
              value,
              hexToBytes(blindingFactor.slice(2))
            )

            // Check if it matches
            if (testCommit === commitmentPoint) {
              results[choice] = value
              found = true
              break
            }
          } catch {
            // Invalid commitment, continue
            continue
          }
        }

        if (!found) {
          throw new CryptoError(
            'failed to reveal tally - value exceeds searchable range',
            ErrorCode.DECRYPTION_FAILED,
            { operation: 'revealTally', context: { choice, maxTries: maxTries.toString() } }
          )
        }
      }

      return {
        proposalId: tally.proposalId,
        results,
        voteCount: tally.voteCount,
        timestamp: Date.now(),
        encryptedTally: tally,
      }
    } catch (e) {
      if (e instanceof ValidationError || e instanceof CryptoError) {
        throw e
      }

      throw new CryptoError(
        'threshold decryption failed',
        ErrorCode.DECRYPTION_FAILED,
        {
          cause: e instanceof Error ? e : undefined,
          operation: 'revealTally',
        }
      )
    } finally {
      // Securely wipe reconstructed key
      if (reconstructedKey) {
        secureWipe(reconstructedKey)
      }
    }
  }

  /**
   * Validate encrypted tally structure
   */
  private validateEncryptedTally(tally: EncryptedTally): void {
    if (!tally || typeof tally !== 'object') {
      throw new ValidationError(
        'tally must be an object',
        'tally',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (typeof tally.proposalId !== 'string' || tally.proposalId.length === 0) {
      throw new ValidationError(
        'proposalId must be a non-empty string',
        'tally.proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    if (!tally.tallies || typeof tally.tallies !== 'object') {
      throw new ValidationError(
        'tallies must be an object',
        'tally.tallies',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate each tally commitment
    for (const [choice, commitment] of Object.entries(tally.tallies)) {
      if (!isValidHex(commitment)) {
        throw new ValidationError(
          `tally for choice ${choice} must be a valid hex string`,
          'tally.tallies',
          undefined,
          ErrorCode.INVALID_ENCRYPTED_DATA
        )
      }
    }

    // Validate encrypted blindings
    if (!tally.encryptedBlindings || typeof tally.encryptedBlindings !== 'object') {
      throw new ValidationError(
        'encryptedBlindings must be an object',
        'tally.encryptedBlindings',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate each encrypted blinding
    for (const [choice, encBlinding] of Object.entries(tally.encryptedBlindings)) {
      if (!encBlinding || typeof encBlinding !== 'object') {
        throw new ValidationError(
          `encrypted blinding for choice ${choice} must be an object`,
          'tally.encryptedBlindings',
          undefined,
          ErrorCode.INVALID_ENCRYPTED_DATA
        )
      }

      if (!isValidHex(encBlinding.ciphertext)) {
        throw new ValidationError(
          `encrypted blinding ciphertext for choice ${choice} must be a valid hex string`,
          'tally.encryptedBlindings.ciphertext',
          undefined,
          ErrorCode.INVALID_ENCRYPTED_DATA
        )
      }

      if (!isValidHex(encBlinding.nonce)) {
        throw new ValidationError(
          `encrypted blinding nonce for choice ${choice} must be a valid hex string`,
          'tally.encryptedBlindings.nonce',
          undefined,
          ErrorCode.INVALID_ENCRYPTED_DATA
        )
      }
    }

    if (typeof tally.voteCount !== 'number' || !Number.isInteger(tally.voteCount) || tally.voteCount < 0) {
      throw new ValidationError(
        'voteCount must be a non-negative integer',
        'tally.voteCount',
        { received: tally.voteCount },
        ErrorCode.INVALID_INPUT
      )
    }

    if (typeof tally.timestamp !== 'number' || !Number.isInteger(tally.timestamp)) {
      throw new ValidationError(
        'timestamp must be an integer',
        'tally.timestamp',
        { received: tally.timestamp },
        ErrorCode.INVALID_INPUT
      )
    }
  }

  /**
   * Validate encrypted vote structure
   */
  private validateEncryptedVote(vote: EncryptedVote): void {
    if (!vote || typeof vote !== 'object') {
      throw new ValidationError(
        'vote must be an object',
        'vote',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate ciphertext
    if (!isValidHex(vote.ciphertext)) {
      throw new ValidationError(
        'ciphertext must be a valid hex string',
        'vote.ciphertext',
        undefined,
        ErrorCode.INVALID_ENCRYPTED_DATA
      )
    }

    // Validate nonce
    if (!isValidHex(vote.nonce)) {
      throw new ValidationError(
        'nonce must be a valid hex string',
        'vote.nonce',
        undefined,
        ErrorCode.INVALID_ENCRYPTED_DATA
      )
    }

    // Validate encryption key hash
    if (!isValidHex(vote.encryptionKeyHash)) {
      throw new ValidationError(
        'encryptionKeyHash must be a valid hex string',
        'vote.encryptionKeyHash',
        undefined,
        ErrorCode.INVALID_ENCRYPTED_DATA
      )
    }

    // Validate proposal ID
    if (typeof vote.proposalId !== 'string' || vote.proposalId.length === 0) {
      throw new ValidationError(
        'proposalId must be a non-empty string',
        'vote.proposalId',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate voter
    if (typeof vote.voter !== 'string') {
      throw new ValidationError(
        'voter must be a string',
        'vote.voter',
        { received: typeof vote.voter },
        ErrorCode.INVALID_INPUT
      )
    }

    // Validate timestamp
    if (typeof vote.timestamp !== 'number' || !Number.isInteger(vote.timestamp)) {
      throw new ValidationError(
        'timestamp must be an integer',
        'vote.timestamp',
        { received: vote.timestamp },
        ErrorCode.INVALID_INPUT
      )
    }
  }
}

/**
 * Create a new PrivateVoting instance
 *
 * @returns PrivateVoting instance
 *
 * @example
 * ```typescript
 * import { createPrivateVoting } from '@sip-protocol/sdk'
 *
 * const voting = createPrivateVoting()
 *
 * const encryptedVote = voting.castVote({
 *   proposalId: 'proposal-123',
 *   choice: 1,
 *   weight: 1000n,
 *   encryptionKey: '0xabc...',
 * })
 * ```
 */
export function createPrivateVoting(): PrivateVoting {
  return new PrivateVoting()
}
