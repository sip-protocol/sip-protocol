/**
 * Cosmos IBC Stealth Transfers
 *
 * Implements privacy-preserving cross-chain transfers using IBC (Inter-Blockchain
 * Communication) protocol with stealth addresses.
 *
 * Key Features:
 * - Cross-chain stealth transfers between Cosmos chains
 * - Ephemeral key transmission via IBC memo field
 * - View tag for efficient scanning
 * - Support for multiple Cosmos chains (Hub, Osmosis, Injective, Celestia)
 *
 * IBC Memo Format:
 * ```json
 * {
 *   "sip": {
 *     "version": 1,
 *     "ephemeralKey": "0x...",
 *     "viewTag": 123
 *   }
 * }
 * ```
 *
 * @see https://ibc.cosmos.network/main/ibc/overview
 * @see https://github.com/cosmos/ibc
 */

import { hexToBytes, bytesToHex } from '@noble/hashes/utils'
import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import {
  CosmosStealthService,
  type CosmosChainId,
  type CosmosStealthResult,
  CHAIN_PREFIXES,
} from './stealth'
import type { HexString, StealthMetaAddress, ChainId } from '@sip-protocol/types'
import { ValidationError } from '../errors'

/**
 * IBC channel configuration for chain pairs
 */
export interface IBCChannel {
  /** Source channel ID (e.g., "channel-0") */
  sourceChannel: string
  /** Destination channel ID (e.g., "channel-141") */
  destChannel: string
  /** Port ID (typically "transfer" for token transfers) */
  portId: string
}

/**
 * Known IBC channels between Cosmos chains
 *
 * These are production channel IDs. For testnet/devnet, different channels may be used.
 * Channel mappings are bidirectional (source→dest and dest→source).
 *
 * @see https://www.mintscan.io/cosmos/relayers for channel explorer
 */
export const IBC_CHANNELS: Record<string, IBCChannel> = {
  // Cosmos Hub ↔ Osmosis
  'cosmos-osmosis': {
    sourceChannel: 'channel-141',
    destChannel: 'channel-0',
    portId: 'transfer',
  },
  'osmosis-cosmos': {
    sourceChannel: 'channel-0',
    destChannel: 'channel-141',
    portId: 'transfer',
  },

  // Cosmos Hub ↔ Injective
  'cosmos-injective': {
    sourceChannel: 'channel-220',
    destChannel: 'channel-1',
    portId: 'transfer',
  },
  'injective-cosmos': {
    sourceChannel: 'channel-1',
    destChannel: 'channel-220',
    portId: 'transfer',
  },

  // Cosmos Hub ↔ Celestia
  'cosmos-celestia': {
    sourceChannel: 'channel-674',
    destChannel: 'channel-0',
    portId: 'transfer',
  },
  'celestia-cosmos': {
    sourceChannel: 'channel-0',
    destChannel: 'channel-674',
    portId: 'transfer',
  },

  // Osmosis ↔ Injective
  'osmosis-injective': {
    sourceChannel: 'channel-122',
    destChannel: 'channel-8',
    portId: 'transfer',
  },
  'injective-osmosis': {
    sourceChannel: 'channel-8',
    destChannel: 'channel-122',
    portId: 'transfer',
  },

  // Osmosis ↔ Celestia
  'osmosis-celestia': {
    sourceChannel: 'channel-6994',
    destChannel: 'channel-2',
    portId: 'transfer',
  },
  'celestia-osmosis': {
    sourceChannel: 'channel-2',
    destChannel: 'channel-6994',
    portId: 'transfer',
  },

  // Injective ↔ Celestia
  'injective-celestia': {
    sourceChannel: 'channel-152',
    destChannel: 'channel-7',
    portId: 'transfer',
  },
  'celestia-injective': {
    sourceChannel: 'channel-7',
    destChannel: 'channel-152',
    portId: 'transfer',
  },
}

/**
 * Parameters for creating a stealth IBC transfer
 */
export interface StealthIBCTransferParams {
  /** Source chain (where tokens are transferred from) */
  sourceChain: CosmosChainId
  /** Destination chain (where tokens are transferred to) */
  destChain: CosmosChainId
  /** Recipient's stealth meta-address (sip:cosmos:...) or StealthMetaAddress */
  recipientMetaAddress: string | StealthMetaAddress
  /** Amount to transfer (in base units) */
  amount: bigint
  /** Token denomination (e.g., "uatom", "uosmo", "inj") */
  denom: string
  /** Optional memo text (will be merged with SIP metadata) */
  memo?: string
  /** Optional timeout height */
  timeoutHeight?: {
    revisionNumber: bigint
    revisionHeight: bigint
  }
  /** Optional timeout timestamp (Unix timestamp in nanoseconds) */
  timeoutTimestamp?: bigint
}

/**
 * Result of stealth IBC transfer creation
 */
export interface StealthIBCTransfer {
  /** Source chain */
  sourceChain: CosmosChainId
  /** Destination chain */
  destChain: CosmosChainId
  /** Generated stealth address on destination chain (bech32) */
  stealthAddress: string
  /** Stealth public key (for verification) */
  stealthPublicKey: HexString
  /** Ephemeral public key (for recipient to derive private key) */
  ephemeralPublicKey: HexString
  /** View tag for efficient scanning (0-255) */
  viewTag: number
  /** Amount being transferred */
  amount: bigint
  /** Token denomination */
  denom: string
  /** IBC channel configuration */
  ibcChannel: IBCChannel
  /** IBC memo containing SIP metadata */
  memo: string
}

/**
 * IBC MsgTransfer message (Cosmos SDK standard)
 *
 * This is the standard IBC transfer message format.
 * @see https://github.com/cosmos/ibc-go/blob/main/proto/ibc/applications/transfer/v1/tx.proto
 */
export interface IBCMsgTransfer {
  /** Message type URL */
  typeUrl: '/ibc.applications.transfer.v1.MsgTransfer'
  /** Message value */
  value: {
    /** Source port (typically "transfer") */
    sourcePort: string
    /** Source channel ID */
    sourceChannel: string
    /** Token being transferred */
    token: {
      /** Token denomination */
      denom: string
      /** Amount (as string) */
      amount: string
    }
    /** Sender address (on source chain) */
    sender: string
    /** Receiver address (stealth address on dest chain) */
    receiver: string
    /** Optional timeout height */
    timeoutHeight?: {
      revisionNumber: string
      revisionHeight: string
    }
    /** Optional timeout timestamp (Unix nanos as string) */
    timeoutTimestamp?: string
    /** Memo containing SIP metadata */
    memo: string
  }
}

/**
 * Incoming IBC transfer to scan for stealth payments
 */
export interface IncomingIBCTransfer {
  /** Transfer ID or hash */
  id: string
  /** Sender address on source chain */
  sender: string
  /** Receiver address on dest chain (might be our stealth address) */
  receiver: string
  /** Amount received */
  amount: bigint
  /** Token denomination */
  denom: string
  /** IBC memo (contains SIP metadata) */
  memo: string
  /** Source chain */
  sourceChain: CosmosChainId
  /** Destination chain */
  destChain: CosmosChainId
  /** Block height */
  height: bigint
  /** Timestamp */
  timestamp: bigint
}

/**
 * Detected stealth transfer received by recipient
 */
export interface ReceivedStealthTransfer {
  /** Transfer ID */
  id: string
  /** Source chain */
  sourceChain: CosmosChainId
  /** Destination chain */
  destChain: CosmosChainId
  /** Stealth address that received funds */
  stealthAddress: string
  /** Amount received */
  amount: bigint
  /** Token denomination */
  denom: string
  /** Ephemeral public key (from memo) */
  ephemeralPublicKey: HexString
  /** View tag (from memo) */
  viewTag: number
  /** Derived private key to claim funds */
  privateKey: HexString
  /** Block height */
  height: bigint
  /** Timestamp */
  timestamp: bigint
}

/**
 * SIP metadata encoded in IBC memo
 */
interface SIPMemoMetadata {
  sip: {
    /** Protocol version */
    version: number
    /** Ephemeral public key (hex with 0x prefix) */
    ephemeralKey: HexString
    /** View tag for efficient scanning */
    viewTag: number
  }
}

/**
 * Cosmos IBC Stealth Service
 *
 * Provides IBC transfer functionality with stealth address privacy.
 */
export class CosmosIBCStealthService {
  private stealthService: CosmosStealthService

  constructor() {
    this.stealthService = new CosmosStealthService()
  }

  /**
   * Create a stealth IBC transfer
   *
   * Generates a stealth address on the destination chain and creates
   * an IBC transfer with SIP metadata in the memo field.
   *
   * @param params - Transfer parameters
   * @returns Stealth IBC transfer details
   * @throws {ValidationError} If parameters are invalid
   *
   * @example
   * ```typescript
   * const service = new CosmosIBCStealthService()
   * const transfer = service.createStealthIBCTransfer({
   *   sourceChain: 'cosmos',
   *   destChain: 'osmosis',
   *   recipientMetaAddress: 'sip:cosmos:0x02abc...123:0x03def...456',
   *   amount: 1000000n, // 1 ATOM (6 decimals)
   *   denom: 'uatom'
   * })
   * console.log(transfer.stealthAddress) // "osmo1..."
   * ```
   */
  createStealthIBCTransfer(params: StealthIBCTransferParams): StealthIBCTransfer {
    // Validate chains
    this.validateChain(params.sourceChain)
    this.validateChain(params.destChain)

    if (params.sourceChain === params.destChain) {
      throw new ValidationError(
        'source and destination chains must be different for IBC transfers',
        'sourceChain/destChain'
      )
    }

    // Validate amount
    if (params.amount <= 0n) {
      throw new ValidationError('amount must be positive', 'amount')
    }

    // Validate denom
    if (!params.denom || params.denom.length === 0) {
      throw new ValidationError('denom cannot be empty', 'denom')
    }

    // Parse recipient meta-address
    const metaAddress = this.parseMetaAddress(params.recipientMetaAddress)

    // Generate stealth address on destination chain
    const stealthResult = this.stealthService.generateStealthAddressFromMeta(
      metaAddress,
      params.destChain
    )

    // Get IBC channel
    const ibcChannel = this.getIBCChannel(params.sourceChain, params.destChain)

    // Create SIP memo
    const sipMemo = this.encodeSIPMemo(
      stealthResult.ephemeralPublicKey,
      stealthResult.viewTag,
      params.memo
    )

    return {
      sourceChain: params.sourceChain,
      destChain: params.destChain,
      stealthAddress: stealthResult.stealthAddress,
      stealthPublicKey: stealthResult.stealthPublicKey,
      ephemeralPublicKey: stealthResult.ephemeralPublicKey,
      viewTag: stealthResult.viewTag,
      amount: params.amount,
      denom: params.denom,
      ibcChannel,
      memo: sipMemo,
    }
  }

  /**
   * Build IBC MsgTransfer for a stealth transfer
   *
   * Creates a Cosmos SDK MsgTransfer message that can be signed and broadcast.
   *
   * @param transfer - Stealth IBC transfer details
   * @param senderAddress - Sender's address on source chain
   * @param timeoutHeight - Optional timeout height
   * @param timeoutTimestamp - Optional timeout timestamp (Unix nanos)
   * @returns IBC MsgTransfer message
   *
   * @example
   * ```typescript
   * const service = new CosmosIBCStealthService()
   * const transfer = service.createStealthIBCTransfer({...})
   * const msg = service.buildIBCMsgTransfer(
   *   transfer,
   *   'cosmos1sender...',
   *   undefined,
   *   BigInt(Date.now() + 600000) * 1_000_000n // 10 min timeout
   * )
   * // Sign and broadcast msg
   * ```
   */
  buildIBCMsgTransfer(
    transfer: StealthIBCTransfer,
    senderAddress: string,
    timeoutHeight?: { revisionNumber: bigint; revisionHeight: bigint },
    timeoutTimestamp?: bigint
  ): IBCMsgTransfer {
    // Validate sender address
    if (!this.stealthService.isValidCosmosAddress(senderAddress, transfer.sourceChain)) {
      throw new ValidationError(
        `invalid sender address for chain ${transfer.sourceChain}`,
        'senderAddress'
      )
    }

    const msg: IBCMsgTransfer = {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: {
        sourcePort: transfer.ibcChannel.portId,
        sourceChannel: transfer.ibcChannel.sourceChannel,
        token: {
          denom: transfer.denom,
          amount: transfer.amount.toString(),
        },
        sender: senderAddress,
        receiver: transfer.stealthAddress,
        memo: transfer.memo,
      },
    }

    // Add optional timeout height
    if (timeoutHeight) {
      msg.value.timeoutHeight = {
        revisionNumber: timeoutHeight.revisionNumber.toString(),
        revisionHeight: timeoutHeight.revisionHeight.toString(),
      }
    }

    // Add optional timeout timestamp
    if (timeoutTimestamp) {
      msg.value.timeoutTimestamp = timeoutTimestamp.toString()
    }

    return msg
  }

  /**
   * Scan incoming IBC transfers for stealth payments
   *
   * Checks if any incoming transfers are addressed to stealth addresses
   * belonging to the recipient. For each match, derives the private key
   * needed to claim the funds.
   *
   * @param viewingKey - Recipient's viewing private key
   * @param spendingPubKey - Recipient's spending public key
   * @param spendingPrivateKey - Recipient's spending private key
   * @param transfers - List of incoming IBC transfers to scan
   * @returns List of detected stealth transfers with derived keys
   *
   * @example
   * ```typescript
   * const service = new CosmosIBCStealthService()
   * const received = service.scanIBCTransfers(
   *   viewingPrivKey,
   *   spendingPubKey,
   *   spendingPrivKey,
   *   incomingTransfers
   * )
   *
   * for (const transfer of received) {
   *   console.log(`Received ${transfer.amount} ${transfer.denom}`)
   *   // Use transfer.privateKey to claim funds from transfer.stealthAddress
   * }
   * ```
   */
  scanIBCTransfers(
    viewingKey: Uint8Array,
    spendingPubKey: Uint8Array,
    spendingPrivateKey: HexString,
    transfers: IncomingIBCTransfer[]
  ): ReceivedStealthTransfer[] {
    const received: ReceivedStealthTransfer[] = []

    for (const transfer of transfers) {
      try {
        // Parse SIP metadata from memo
        const sipData = this.decodeSIPMemo(transfer.memo)
        if (!sipData) {
          continue // Not a SIP transfer
        }

        // Parse ephemeral public key from memo
        const ephemeralPubKey = hexToBytes(sipData.sip.ephemeralKey.slice(2))
        const viewingPrivKey = hexToBytes(`0x${bytesToHex(viewingKey)}`.slice(2))
        const spendingPrivKey = hexToBytes(spendingPrivateKey.slice(2))

        // Compute stealth private key using EIP-5564 algorithm:
        // 1. Compute shared secret: S = spendingPriv * ephemeralPub
        const sharedSecretPoint = secp256k1.getSharedSecret(spendingPrivKey, ephemeralPubKey)
        const sharedSecretHash = sha256(sharedSecretPoint)

        // 2. Derive stealth private key: stealthPriv = viewingPriv + hash(S) mod n
        const viewingPrivBigInt = bytesToBigInt(viewingPrivKey)
        const hashBigInt = bytesToBigInt(sharedSecretHash)
        const stealthPrivBigInt = (viewingPrivBigInt + hashBigInt) % secp256k1.CURVE.n

        // Convert to bytes and then to compressed public key
        const stealthPrivKey = bigIntToBytes(stealthPrivBigInt, 32)
        const stealthPubKey = secp256k1.getPublicKey(stealthPrivKey, true)

        // Convert to Cosmos address
        const derivedAddress = this.stealthService.stealthKeyToCosmosAddress(
          stealthPubKey,
          CHAIN_PREFIXES[transfer.destChain]
        )

        // Check if this stealth address matches the receiver
        if (derivedAddress === transfer.receiver) {
          // Match! This transfer is for us
          received.push({
            id: transfer.id,
            sourceChain: transfer.sourceChain,
            destChain: transfer.destChain,
            stealthAddress: transfer.receiver,
            amount: transfer.amount,
            denom: transfer.denom,
            ephemeralPublicKey: sipData.sip.ephemeralKey,
            viewTag: sipData.sip.viewTag,
            privateKey: `0x${bytesToHex(stealthPrivKey)}` as HexString,
            height: transfer.height,
            timestamp: transfer.timestamp,
          })
        }
      } catch (error) {
        // Skip this transfer if we can't parse or derive
        continue
      }
    }

    return received
  }

  /**
   * Get IBC channel for a chain pair
   *
   * Looks up the IBC channel configuration for transferring tokens
   * from source chain to destination chain.
   *
   * @param sourceChain - Source chain
   * @param destChain - Destination chain
   * @returns IBC channel configuration
   * @throws {ValidationError} If channel is not configured
   *
   * @example
   * ```typescript
   * const service = new CosmosIBCStealthService()
   * const channel = service.getIBCChannel('cosmos', 'osmosis')
   * console.log(channel.sourceChannel) // "channel-141"
   * ```
   */
  getIBCChannel(sourceChain: CosmosChainId, destChain: CosmosChainId): IBCChannel {
    const key = `${sourceChain}-${destChain}`
    const channel = IBC_CHANNELS[key]

    if (!channel) {
      throw new ValidationError(
        `no IBC channel configured for ${sourceChain} → ${destChain}`,
        'sourceChain/destChain'
      )
    }

    return channel
  }

  /**
   * Encode SIP metadata into IBC memo
   *
   * Creates a JSON memo containing the ephemeral key and view tag.
   * If custom memo text is provided, it's merged with SIP metadata.
   *
   * @param ephemeralKey - Ephemeral public key
   * @param viewTag - View tag
   * @param customMemo - Optional custom memo text
   * @returns JSON-encoded memo string
   */
  private encodeSIPMemo(
    ephemeralKey: HexString,
    viewTag: number,
    customMemo?: string
  ): string {
    const sipData: SIPMemoMetadata = {
      sip: {
        version: 1,
        ephemeralKey,
        viewTag,
      },
    }

    if (customMemo) {
      return JSON.stringify({
        ...sipData,
        note: customMemo,
      })
    }

    return JSON.stringify(sipData)
  }

  /**
   * Decode SIP metadata from IBC memo
   *
   * Parses the JSON memo and extracts SIP metadata.
   *
   * @param memo - IBC memo string
   * @returns Parsed SIP metadata, or null if not a valid SIP memo
   */
  private decodeSIPMemo(memo: string): SIPMemoMetadata | null {
    try {
      const parsed = JSON.parse(memo)

      // Validate SIP structure
      if (
        !parsed.sip ||
        typeof parsed.sip.version !== 'number' ||
        typeof parsed.sip.ephemeralKey !== 'string' ||
        typeof parsed.sip.viewTag !== 'number'
      ) {
        return null
      }

      // Validate ephemeral key format
      if (!parsed.sip.ephemeralKey.startsWith('0x') || parsed.sip.ephemeralKey.length !== 68) {
        return null
      }

      // Validate view tag range
      if (parsed.sip.viewTag < 0 || parsed.sip.viewTag > 255) {
        return null
      }

      return parsed as SIPMemoMetadata
    } catch {
      return null
    }
  }

  /**
   * Parse recipient meta-address (string or object)
   *
   * @param metaAddress - Meta-address as string or StealthMetaAddress object
   * @returns StealthMetaAddress object
   * @throws {ValidationError} If format is invalid
   */
  private parseMetaAddress(
    metaAddress: string | StealthMetaAddress
  ): StealthMetaAddress {
    if (typeof metaAddress === 'object') {
      // Validate object has required fields
      if (!metaAddress.spendingKey || !metaAddress.viewingKey || !metaAddress.chain) {
        throw new ValidationError(
          'meta-address must have spendingKey, viewingKey, and chain',
          'recipientMetaAddress'
        )
      }
      return metaAddress
    }

    // Parse string format: sip:chain:spendingKey:viewingKey
    const parts = metaAddress.split(':')
    if (parts.length < 4 || parts[0] !== 'sip') {
      throw new ValidationError(
        'invalid meta-address format, expected: sip:chain:spendingKey:viewingKey',
        'recipientMetaAddress'
      )
    }

    const [, chain, spendingKey, viewingKey] = parts
    return {
      chain: chain as ChainId,
      spendingKey: spendingKey as HexString,
      viewingKey: viewingKey as HexString,
    }
  }

  /**
   * Validate Cosmos chain ID
   */
  private validateChain(chain: CosmosChainId): void {
    if (!(chain in CHAIN_PREFIXES)) {
      throw new ValidationError(
        `invalid Cosmos chain '${chain}', must be one of: ${Object.keys(CHAIN_PREFIXES).join(', ')}`,
        'chain'
      )
    }
  }

  /**
   * Check if a string is a valid SIP memo
   *
   * @param memo - Memo string to check
   * @returns true if memo contains valid SIP metadata
   */
  isSIPMemo(memo: string): boolean {
    return this.decodeSIPMemo(memo) !== null
  }

  /**
   * Extract custom note from SIP memo (if present)
   *
   * @param memo - IBC memo string
   * @returns Custom note text, or undefined if not present
   */
  extractCustomNote(memo: string): string | undefined {
    try {
      const parsed = JSON.parse(memo)
      return parsed.note
    } catch {
      return undefined
    }
  }
}

// ─── Standalone Functions ──────────────────────────────────────────────────

/**
 * Create a stealth IBC transfer
 *
 * Convenience function that creates a CosmosIBCStealthService instance.
 *
 * @param params - Transfer parameters
 * @returns Stealth IBC transfer details
 */
export function createStealthIBCTransfer(
  params: StealthIBCTransferParams
): StealthIBCTransfer {
  const service = new CosmosIBCStealthService()
  return service.createStealthIBCTransfer(params)
}

/**
 * Build IBC MsgTransfer for a stealth transfer
 *
 * Convenience function that creates a CosmosIBCStealthService instance.
 *
 * @param transfer - Stealth IBC transfer details
 * @param senderAddress - Sender's address
 * @param timeoutHeight - Optional timeout height
 * @param timeoutTimestamp - Optional timeout timestamp
 * @returns IBC MsgTransfer message
 */
export function buildIBCMsgTransfer(
  transfer: StealthIBCTransfer,
  senderAddress: string,
  timeoutHeight?: { revisionNumber: bigint; revisionHeight: bigint },
  timeoutTimestamp?: bigint
): IBCMsgTransfer {
  const service = new CosmosIBCStealthService()
  return service.buildIBCMsgTransfer(transfer, senderAddress, timeoutHeight, timeoutTimestamp)
}

/**
 * Scan incoming IBC transfers for stealth payments
 *
 * Convenience function that creates a CosmosIBCStealthService instance.
 *
 * @param viewingKey - Recipient's viewing private key
 * @param spendingPubKey - Recipient's spending public key
 * @param spendingPrivateKey - Recipient's spending private key
 * @param transfers - List of incoming IBC transfers
 * @returns List of detected stealth transfers
 */
export function scanIBCTransfers(
  viewingKey: Uint8Array,
  spendingPubKey: Uint8Array,
  spendingPrivateKey: HexString,
  transfers: IncomingIBCTransfer[]
): ReceivedStealthTransfer[] {
  const service = new CosmosIBCStealthService()
  return service.scanIBCTransfers(viewingKey, spendingPubKey, spendingPrivateKey, transfers)
}

/**
 * Get IBC channel for a chain pair
 *
 * Convenience function that creates a CosmosIBCStealthService instance.
 *
 * @param sourceChain - Source chain
 * @param destChain - Destination chain
 * @returns IBC channel configuration
 */
export function getIBCChannel(
  sourceChain: CosmosChainId,
  destChain: CosmosChainId
): IBCChannel {
  const service = new CosmosIBCStealthService()
  return service.getIBCChannel(sourceChain, destChain)
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Convert bytes to bigint (big-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}

/**
 * Convert bigint to bytes (big-endian)
 */
function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}
