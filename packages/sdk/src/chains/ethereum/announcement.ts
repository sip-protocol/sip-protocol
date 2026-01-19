/**
 * EIP-5564 Stealth Address Announcement Parser
 *
 * Parses and creates announcements for stealth address payments on Ethereum.
 * Implements the EIP-5564 announcement event format.
 *
 * ## EIP-5564 Announcement Format
 *
 * ```solidity
 * event Announcement(
 *   uint256 indexed schemeId,
 *   address indexed stealthAddress,
 *   address indexed caller,
 *   bytes ephemeralPubKey,
 *   bytes metadata
 * )
 * ```
 *
 * @see https://eips.ethereum.org/EIPS/eip-5564
 * @packageDocumentation
 */

import type { HexString, StealthAddress } from '@sip-protocol/types'
import { ValidationError } from '../../errors'
import { isValidHexLength } from '../../validation'
import type {
  EthereumAnnouncement,
  AnnouncementMetadata,
  AnnouncementEvent,
} from './types'
import {
  ANNOUNCEMENT_EVENT_SIGNATURE,
  SECP256K1_SCHEME_ID,
  VIEW_TAG_MAX,
  VIEW_TAG_MIN,
  isValidEthAddress,
} from './constants'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Zero address constant
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as HexString

/**
 * Metadata version byte
 */
export const METADATA_VERSION = 0x01

// ─── Announcement Parsing ───────────────────────────────────────────────────

/**
 * Parse an EIP-5564 announcement event log
 *
 * @param log - The raw event log from eth_getLogs
 * @returns Parsed announcement
 *
 * @example
 * ```typescript
 * const logs = await provider.getLogs({
 *   address: EIP5564_ANNOUNCER_ADDRESS,
 *   topics: [ANNOUNCEMENT_EVENT_SIGNATURE],
 *   fromBlock,
 *   toBlock,
 * })
 *
 * for (const log of logs) {
 *   const announcement = parseAnnouncementLog(log)
 *   console.log(announcement.stealthAddress)
 * }
 * ```
 */
export function parseAnnouncementLog(log: {
  address: HexString
  topics: HexString[]
  data: HexString
  blockNumber: number
  transactionHash: HexString
  logIndex: number
}): EthereumAnnouncement {
  // Validate topics
  if (log.topics.length < 4) {
    throw new ValidationError(
      `expected 4 topics, got ${log.topics.length}`,
      'log.topics'
    )
  }

  // Topic 0: Event signature (already filtered)
  // Topic 1: schemeId (indexed uint256)
  // Topic 2: stealthAddress (indexed address, padded to 32 bytes)
  // Topic 3: caller (indexed address, padded to 32 bytes)

  const schemeId = parseInt(log.topics[1], 16)
  const stealthAddress = `0x${log.topics[2].slice(-40)}` as HexString
  const caller = `0x${log.topics[3].slice(-40)}` as HexString

  // Parse data (non-indexed: ephemeralPubKey bytes, metadata bytes)
  const { ephemeralPublicKey, viewTag, metadata } = parseAnnouncementData(log.data)

  return {
    schemeId,
    stealthAddress,
    caller,
    ephemeralPublicKey,
    viewTag,
    metadata,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
  }
}

/**
 * Parse the data field of an announcement event
 *
 * @param data - The hex-encoded data field
 * @returns Parsed ephemeral key, view tag, and metadata
 */
export function parseAnnouncementData(data: HexString): {
  ephemeralPublicKey: HexString
  viewTag: number
  metadata?: HexString
} {
  // Remove 0x prefix
  const hex = data.startsWith('0x') ? data.slice(2) : data

  if (hex.length < 128) {
    throw new ValidationError(
      'announcement data too short (need at least 64 bytes for offsets)',
      'data'
    )
  }

  // ABI-encoded bytes layout:
  // - bytes[0:32]: offset to ephemeralPubKey
  // - bytes[32:64]: offset to metadata
  // - bytes[64:...]: encoded data

  const ephemeralOffset = parseInt(hex.slice(0, 64), 16) * 2
  const metadataOffset = parseInt(hex.slice(64, 128), 16) * 2

  // Parse ephemeral public key
  const ephemeralLength = parseInt(hex.slice(ephemeralOffset, ephemeralOffset + 64), 16)
  const ephemeralStart = ephemeralOffset + 64
  const ephemeralHex = hex.slice(ephemeralStart, ephemeralStart + ephemeralLength * 2)
  const ephemeralPublicKey = `0x${ephemeralHex}` as HexString

  // Extract view tag (first byte of hash of shared secret, stored in first byte of metadata or derived)
  // In EIP-5564, view tag is the first byte of the ephemeral public key hash
  // For simplicity, we compute it as first byte of ephemeral key
  const viewTag = parseInt(ephemeralHex.slice(0, 2), 16)

  // Parse metadata (if present and different from ephemeral)
  let metadata: HexString | undefined
  if (metadataOffset !== ephemeralOffset && metadataOffset < hex.length) {
    const metadataLength = parseInt(hex.slice(metadataOffset, metadataOffset + 64), 16)
    if (metadataLength > 0) {
      const metadataStart = metadataOffset + 64
      const metadataHex = hex.slice(metadataStart, metadataStart + metadataLength * 2)
      metadata = `0x${metadataHex}` as HexString
    }
  }

  return {
    ephemeralPublicKey,
    viewTag,
    metadata,
  }
}

/**
 * Parse announcement metadata
 *
 * @param metadata - The metadata hex string
 * @returns Parsed metadata fields
 */
export function parseAnnouncementMetadata(
  metadata: HexString
): AnnouncementMetadata {
  const hex = metadata.startsWith('0x') ? metadata.slice(2) : metadata

  // Metadata format (flexible, version-prefixed):
  // byte 0: version
  // bytes 1-20: token address (20 bytes, zero for ETH)
  // bytes 21-53: amount commitment (33 bytes, compressed point)
  // bytes 54-85: blinding hash (32 bytes)
  // bytes 86+: extra data

  const result: AnnouncementMetadata = {}

  if (hex.length < 2) {
    return result
  }

  const version = parseInt(hex.slice(0, 2), 16)

  if (version === METADATA_VERSION && hex.length >= 42) {
    // Token address (20 bytes)
    const tokenHex = hex.slice(2, 42)
    if (tokenHex !== '0'.repeat(40)) {
      result.tokenAddress = `0x${tokenHex}` as HexString
    }

    // Amount commitment (33 bytes, if present)
    if (hex.length >= 108) {
      result.amountCommitment = `0x${hex.slice(42, 108)}` as HexString
    }

    // Blinding hash (32 bytes, if present)
    if (hex.length >= 172) {
      result.blindingHash = `0x${hex.slice(108, 172)}` as HexString
    }

    // Extra data (remaining bytes)
    if (hex.length > 172) {
      result.extraData = `0x${hex.slice(172)}` as HexString
    }
  }

  return result
}

// ─── Announcement Creation ──────────────────────────────────────────────────

/**
 * Create announcement metadata bytes
 *
 * @param options - Metadata options
 * @returns Encoded metadata hex string
 */
export function createAnnouncementMetadata(options: {
  tokenAddress?: HexString
  amountCommitment?: HexString
  blindingHash?: HexString
  extraData?: HexString
}): HexString {
  const parts: string[] = []

  // Version byte
  parts.push(METADATA_VERSION.toString(16).padStart(2, '0'))

  // Token address (20 bytes, zero-padded)
  if (options.tokenAddress) {
    const addr = options.tokenAddress.slice(2).toLowerCase()
    parts.push(addr.padStart(40, '0'))
  } else {
    parts.push('0'.repeat(40))
  }

  // Amount commitment (33 bytes)
  if (options.amountCommitment) {
    const commitment = options.amountCommitment.slice(2)
    parts.push(commitment.padStart(66, '0'))
  }

  // Blinding hash (32 bytes)
  if (options.blindingHash) {
    const hash = options.blindingHash.slice(2)
    parts.push(hash.padStart(64, '0'))
  }

  // Extra data
  if (options.extraData) {
    parts.push(options.extraData.slice(2))
  }

  return `0x${parts.join('')}` as HexString
}

/**
 * Encode announcement call data for the Announcer contract
 *
 * @param schemeId - The EIP-5564 scheme ID (1 for secp256k1)
 * @param stealthAddress - The stealth Ethereum address
 * @param ephemeralPublicKey - The ephemeral public key (33 bytes compressed)
 * @param metadata - Optional metadata bytes
 * @returns Encoded call data
 */
export function encodeAnnouncementCallData(
  schemeId: number,
  stealthAddress: HexString,
  ephemeralPublicKey: HexString,
  metadata?: HexString
): HexString {
  // Function selector: announce(uint256,address,bytes,bytes)
  const selector = '0x3f62a9e6'

  // Encode parameters
  const schemeIdHex = schemeId.toString(16).padStart(64, '0')
  const stealthAddressHex = stealthAddress.slice(2).padStart(64, '0')

  // Dynamic data offsets
  const ephemeralOffset = (4 * 32).toString(16).padStart(64, '0') // After 4 static params
  const metadataOffset = metadata
    ? ((4 * 32 + 32 + Math.ceil((ephemeralPublicKey.slice(2).length / 2 + 32) / 32) * 32))
        .toString(16)
        .padStart(64, '0')
    : ephemeralOffset // Point to same location if no metadata

  // Encode ephemeral public key bytes
  const ephemeralBytes = ephemeralPublicKey.slice(2)
  const ephemeralLength = (ephemeralBytes.length / 2).toString(16).padStart(64, '0')
  const ephemeralPadded = ephemeralBytes.padEnd(
    Math.ceil(ephemeralBytes.length / 64) * 64,
    '0'
  )

  // Encode metadata bytes
  let metadataEncoded = ''
  if (metadata) {
    const metadataBytes = metadata.slice(2)
    const metadataLength = (metadataBytes.length / 2).toString(16).padStart(64, '0')
    const metadataPadded = metadataBytes.padEnd(
      Math.ceil(metadataBytes.length / 64) * 64,
      '0'
    )
    metadataEncoded = metadataLength + metadataPadded
  } else {
    metadataEncoded = '0'.repeat(64) // Zero length
  }

  return `${selector}${schemeIdHex}${stealthAddressHex}${ephemeralOffset}${metadataOffset}${ephemeralLength}${ephemeralPadded}${metadataEncoded}` as HexString
}

// ─── Announcement Filtering ─────────────────────────────────────────────────

/**
 * Filter announcements by scheme ID
 *
 * @param announcements - Announcements to filter
 * @param schemeId - Scheme ID to filter for (default: secp256k1 = 1)
 * @returns Filtered announcements
 */
export function filterBySchemeId(
  announcements: EthereumAnnouncement[],
  schemeId: number = SECP256K1_SCHEME_ID
): EthereumAnnouncement[] {
  return announcements.filter((a) => a.schemeId === schemeId)
}

/**
 * Filter announcements by view tag (quick pre-filter before full check)
 *
 * @param announcements - Announcements to filter
 * @param viewTag - Expected view tag
 * @returns Announcements with matching view tag
 */
export function filterByViewTag(
  announcements: EthereumAnnouncement[],
  viewTag: number
): EthereumAnnouncement[] {
  if (viewTag < VIEW_TAG_MIN || viewTag > VIEW_TAG_MAX) {
    throw new ValidationError(
      `viewTag must be between ${VIEW_TAG_MIN} and ${VIEW_TAG_MAX}`,
      'viewTag'
    )
  }

  return announcements.filter((a) => a.viewTag === viewTag)
}

/**
 * Filter announcements by block range
 *
 * @param announcements - Announcements to filter
 * @param fromBlock - Start block (inclusive)
 * @param toBlock - End block (inclusive)
 * @returns Filtered announcements
 */
export function filterByBlockRange(
  announcements: EthereumAnnouncement[],
  fromBlock: number,
  toBlock: number
): EthereumAnnouncement[] {
  return announcements.filter(
    (a) =>
      a.blockNumber !== undefined &&
      a.blockNumber >= fromBlock &&
      a.blockNumber <= toBlock
  )
}

/**
 * Filter announcements by token (from metadata)
 *
 * @param announcements - Announcements to filter
 * @param tokenAddress - Token contract address (use ZERO_ADDRESS for ETH)
 * @returns Filtered announcements
 */
export function filterByToken(
  announcements: EthereumAnnouncement[],
  tokenAddress: HexString
): EthereumAnnouncement[] {
  const normalizedToken = tokenAddress.toLowerCase()

  return announcements.filter((a) => {
    if (!a.metadata) {
      // No metadata = native ETH
      return normalizedToken === ZERO_ADDRESS.toLowerCase()
    }

    const parsed = parseAnnouncementMetadata(a.metadata)
    const announcementToken = parsed.tokenAddress?.toLowerCase() || ZERO_ADDRESS.toLowerCase()

    return announcementToken === normalizedToken
  })
}

// ─── Announcement Conversion ────────────────────────────────────────────────

/**
 * Convert an announcement to a StealthAddress object
 *
 * @param announcement - The announcement
 * @returns StealthAddress object for further processing
 */
export function announcementToStealthAddress(
  announcement: EthereumAnnouncement
): StealthAddress {
  return {
    address: announcement.stealthAddress,
    ephemeralPublicKey: announcement.ephemeralPublicKey,
    viewTag: announcement.viewTag,
  }
}

/**
 * Create an announcement from a stealth address result
 *
 * @param stealthAddress - The stealth address
 * @param stealthEthAddress - The derived Ethereum address
 * @param caller - The sender's address
 * @param metadata - Optional metadata
 * @returns Partial announcement (without tx details)
 */
export function createAnnouncementFromStealth(
  stealthAddress: StealthAddress,
  stealthEthAddress: HexString,
  caller: HexString,
  metadata?: HexString
): Omit<EthereumAnnouncement, 'txHash' | 'blockNumber' | 'logIndex' | 'timestamp'> {
  return {
    schemeId: SECP256K1_SCHEME_ID,
    stealthAddress: stealthEthAddress,
    caller,
    ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
    viewTag: stealthAddress.viewTag,
    metadata,
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an announcement structure
 *
 * @param announcement - The announcement to validate
 * @returns True if valid
 */
export function isValidAnnouncement(announcement: EthereumAnnouncement): boolean {
  // Check scheme ID
  if (announcement.schemeId !== SECP256K1_SCHEME_ID) {
    return false
  }

  // Check stealth address
  if (!isValidEthAddress(announcement.stealthAddress)) {
    return false
  }

  // Check caller
  if (!isValidEthAddress(announcement.caller)) {
    return false
  }

  // Check ephemeral public key (33 bytes = 66 hex chars + 0x)
  if (!isValidHexLength(announcement.ephemeralPublicKey, 33)) {
    return false
  }

  // Check view tag
  if (
    announcement.viewTag < VIEW_TAG_MIN ||
    announcement.viewTag > VIEW_TAG_MAX
  ) {
    return false
  }

  return true
}

/**
 * Get the event topic for filtering logs
 *
 * @returns The Announcement event signature topic
 */
export function getAnnouncementEventTopic(): HexString {
  return ANNOUNCEMENT_EVENT_SIGNATURE as HexString
}

/**
 * Build topics array for eth_getLogs filtering
 *
 * @param schemeId - Optional scheme ID filter
 * @param stealthAddress - Optional stealth address filter
 * @param caller - Optional caller filter
 * @returns Topics array for eth_getLogs
 */
export function buildAnnouncementTopics(options?: {
  schemeId?: number
  stealthAddress?: HexString
  caller?: HexString
}): (HexString | null)[] {
  const topics: (HexString | null)[] = [
    ANNOUNCEMENT_EVENT_SIGNATURE as HexString, // Topic 0: event signature
    null, // Topic 1: schemeId
    null, // Topic 2: stealthAddress
    null, // Topic 3: caller
  ]

  if (options?.schemeId !== undefined) {
    topics[1] = `0x${options.schemeId.toString(16).padStart(64, '0')}` as HexString
  }

  if (options?.stealthAddress) {
    topics[2] = `0x${options.stealthAddress.slice(2).padStart(64, '0')}` as HexString
  }

  if (options?.caller) {
    topics[3] = `0x${options.caller.slice(2).padStart(64, '0')}` as HexString
  }

  return topics
}
