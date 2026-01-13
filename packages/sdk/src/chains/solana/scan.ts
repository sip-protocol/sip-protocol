/**
 * Solana Stealth Payment Scanning and Claiming
 *
 * Scan the blockchain for incoming stealth payments and claim them.
 */

import {
  PublicKey,
  Transaction,
  Keypair,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token'
import {
  checkEd25519StealthAddress,
  deriveEd25519StealthPrivateKey,
  solanaAddressToEd25519PublicKey,
} from '../../stealth'
import type { StealthAddress, HexString } from '@sip-protocol/types'
import type {
  SolanaScanParams,
  SolanaScanResult,
  SolanaClaimParams,
  SolanaClaimResult,
} from './types'
import { parseAnnouncement } from './types'
import {
  SIP_MEMO_PREFIX,
  MEMO_PROGRAM_ID,
  getExplorerUrl,
  DEFAULT_SCAN_LIMIT,
  VIEW_TAG_MAX,
  type SolanaCluster,
} from './constants'
import { getTokenSymbol, parseTokenTransferFromBalances } from './utils'
import type { SolanaRPCProvider } from './providers/interface'
import { hexToBytes } from '@noble/hashes/utils'
import { ed25519 } from '@noble/curves/ed25519'

/**
 * Scan for incoming stealth payments
 *
 * Queries the Solana blockchain for transactions containing SIP announcements,
 * then checks if any match the recipient's viewing key.
 *
 * @param params - Scanning parameters
 * @returns Array of detected payments
 *
 * @example
 * ```typescript
 * const payments = await scanForPayments({
 *   connection,
 *   viewingPrivateKey: '0x...',
 *   spendingPublicKey: '0x...',
 *   fromSlot: 250000000,
 * })
 *
 * for (const payment of payments) {
 *   console.log(`Found ${payment.amount} at ${payment.stealthAddress}`)
 * }
 * ```
 */
export async function scanForPayments(
  params: SolanaScanParams
): Promise<SolanaScanResult[]> {
  const {
    connection,
    viewingPrivateKey,
    spendingPublicKey,
    fromSlot,
    toSlot,
    limit = DEFAULT_SCAN_LIMIT,
    provider,
  } = params

  const results: SolanaScanResult[] = []

  // Get recent signatures for the memo program
  // This is a simplified approach - in production, you'd want to
  // index announcements more efficiently
  const memoProgram = new PublicKey(MEMO_PROGRAM_ID)

  try {
    // Get recent transactions mentioning the memo program
    // Note: This is limited - a production implementation would use
    // a dedicated indexer or getProgramAccounts
    const signatures = await connection.getSignaturesForAddress(
      memoProgram,
      {
        limit,
        minContextSlot: fromSlot,
      }
    )

    // Filter by slot range if specified
    const filteredSignatures = toSlot
      ? signatures.filter((s) => s.slot <= toSlot)
      : signatures

    // Process each transaction
    for (const sigInfo of filteredSignatures) {
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        })

        if (!tx?.meta?.logMessages) continue

        // Look for SIP announcement in logs
        for (const log of tx.meta.logMessages) {
          if (!log.includes(SIP_MEMO_PREFIX)) continue

          // Extract memo content from log
          const memoMatch = log.match(/Program log: (.+)/)
          if (!memoMatch) continue

          const memoContent = memoMatch[1]
          const announcement = parseAnnouncement(memoContent)
          if (!announcement) continue

          // M5 FIX: Wrap ephemeral key conversion in try-catch
          let ephemeralPubKeyHex: HexString
          try {
            ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(
              announcement.ephemeralPublicKey
            )
          } catch {
            // Invalid ephemeral key format, skip this announcement
            continue
          }

          // Construct stealth address object for checking
          // viewTag is a number (0-255), parse from hex string
          const viewTagNumber = parseInt(announcement.viewTag, 16)

          // M5 FIX: Validate view tag range
          if (!Number.isInteger(viewTagNumber) || viewTagNumber < 0 || viewTagNumber > VIEW_TAG_MAX) {
            continue
          }

          let stealthAddressHex: HexString
          try {
            stealthAddressHex = announcement.stealthAddress
              ? solanaAddressToEd25519PublicKey(announcement.stealthAddress)
              : ('0x' + '00'.repeat(32)) as HexString
          } catch {
            continue
          }

          const stealthAddressToCheck: StealthAddress = {
            address: stealthAddressHex,
            ephemeralPublicKey: ephemeralPubKeyHex,
            viewTag: viewTagNumber,
          }

          // M5 FIX: Wrap checkEd25519StealthAddress in try-catch
          // This can throw for invalid curve points
          let isOurs = false
          try {
            isOurs = checkEd25519StealthAddress(
              stealthAddressToCheck,
              viewingPrivateKey,
              spendingPublicKey
            )
          } catch {
            // Invalid keys or malformed data - not our payment
            continue
          }

          if (isOurs) {
            // Parse token transfer from transaction using shared utility
            const transferInfo = parseTokenTransferFromBalances(
              tx?.meta?.preTokenBalances as Parameters<typeof parseTokenTransferFromBalances>[0],
              tx?.meta?.postTokenBalances as Parameters<typeof parseTokenTransferFromBalances>[1]
            )
            if (transferInfo) {
              // If provider is available, use it for more accurate current balance
              let amount = transferInfo.amount
              const tokenSymbol = getTokenSymbol(transferInfo.mint)

              if (provider && announcement.stealthAddress) {
                try {
                  // Use getTokenBalance for efficient single-token query
                  const balance = await provider.getTokenBalance(
                    announcement.stealthAddress,
                    transferInfo.mint
                  )
                  // Only use provider balance if > 0 (confirms tokens still there)
                  if (balance > 0n) {
                    amount = balance
                  }
                } catch {
                  // Fallback to parsed transfer info if provider fails
                }
              }

              results.push({
                stealthAddress: announcement.stealthAddress || '',
                ephemeralPublicKey: announcement.ephemeralPublicKey,
                amount,
                mint: transferInfo.mint,
                tokenSymbol,
                txSignature: sigInfo.signature,
                slot: sigInfo.slot,
                timestamp: sigInfo.blockTime || 0,
              })
            }
          }
        }
      } catch {
        // M10 FIX: Skip failed transaction parsing silently
        // Individual tx parse failures shouldn't block scanning
      }
    }
  } catch (err) {
    // M10 FIX: Remove console.error, throw proper error
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to scan for payments: ${message}`)
  }

  return results
}

/**
 * Claim a stealth payment
 *
 * Derives the stealth private key and transfers funds to the destination.
 *
 * @param params - Claim parameters
 * @returns Claim result with transaction signature
 *
 * @example
 * ```typescript
 * const result = await claimStealthPayment({
 *   connection,
 *   stealthAddress: '7xK9...',
 *   ephemeralPublicKey: '8yL0...',
 *   viewingPrivateKey: '0x...',
 *   spendingPrivateKey: '0x...',
 *   destinationAddress: 'myWallet...',
 *   mint: new PublicKey('EPjFWdd5...'),
 * })
 *
 * console.log('Claimed! Tx:', result.txSignature)
 * ```
 */
/** Minimum SOL balance required for transaction fees (in lamports) */
const MIN_SOL_FOR_FEES = 5000n // ~0.000005 SOL, typical tx fee

export async function claimStealthPayment(
  params: SolanaClaimParams
): Promise<SolanaClaimResult> {
  const {
    connection,
    stealthAddress,
    ephemeralPublicKey,
    viewingPrivateKey,
    spendingPrivateKey,
    destinationAddress,
    mint,
  } = params

  // M7 FIX: Check SOL balance for fees before attempting claim
  const stealthPubkeyForBalance = new PublicKey(stealthAddress)
  const solBalance = await connection.getBalance(stealthPubkeyForBalance)
  if (BigInt(solBalance) < MIN_SOL_FOR_FEES) {
    throw new Error(
      `Insufficient SOL for transaction fees. Stealth address has ${solBalance} lamports, ` +
      `needs at least ${MIN_SOL_FOR_FEES} lamports (~0.000005 SOL). ` +
      `Fund the stealth address with SOL before claiming.`
    )
  }

  // Convert addresses to hex for SDK functions
  const stealthAddressHex = solanaAddressToEd25519PublicKey(stealthAddress)
  const ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(ephemeralPublicKey)

  // Construct stealth address object
  const stealthAddressObj: StealthAddress = {
    address: stealthAddressHex,
    ephemeralPublicKey: ephemeralPubKeyHex,
    viewTag: 0, // Not needed for derivation
  }

  // Derive stealth private key
  const recovery = deriveEd25519StealthPrivateKey(
    stealthAddressObj,
    spendingPrivateKey,
    viewingPrivateKey
  )

  // Create Solana keypair from derived private key
  // Note: ed25519 private keys in Solana are seeds, not raw scalars
  // The SDK returns a scalar, so we need to handle this carefully
  const stealthPrivKeyBytes = hexToBytes(recovery.privateKey.slice(2))

  // Validate that the derived private key (scalar) produces the expected public key
  // Note: SIP derives a scalar, not a seed. We use scalar multiplication to verify.
  const stealthPubkey = new PublicKey(stealthAddress)
  const expectedPubKeyBytes = stealthPubkey.toBytes()

  // Convert scalar bytes to bigint (little-endian for ed25519)
  const scalarBigInt = bytesToBigIntLE(stealthPrivKeyBytes)
  const ED25519_ORDER = 2n ** 252n + 27742317777372353535851937790883648493n
  let validScalar = scalarBigInt % ED25519_ORDER
  if (validScalar === 0n) validScalar = 1n

  // Derive public key via scalar multiplication
  const derivedPubKeyBytes = ed25519.ExtendedPoint.BASE.multiply(validScalar).toRawBytes()

  if (!derivedPubKeyBytes.every((b, i) => b === expectedPubKeyBytes[i])) {
    throw new Error(
      'Stealth key derivation failed: derived private key does not produce expected public key. ' +
      'This may indicate incorrect spending/viewing keys or corrupted announcement data.'
    )
  }

  // Solana keypairs expect 64 bytes (32 byte seed + 32 byte public key)
  // We construct this from the derived scalar (now validated)
  const stealthKeypair = Keypair.fromSecretKey(
    new Uint8Array([...stealthPrivKeyBytes, ...expectedPubKeyBytes])
  )

  // Get token accounts
  const stealthATA = await getAssociatedTokenAddress(
    mint,
    stealthPubkey,
    true
  )

  const destinationPubkey = new PublicKey(destinationAddress)
  const destinationATA = await getAssociatedTokenAddress(
    mint,
    destinationPubkey
  )

  // Get balance
  const stealthAccount = await getAccount(connection, stealthATA)
  const amount = stealthAccount.amount

  // Build transfer transaction
  const transaction = new Transaction()

  transaction.add(
    createTransferInstruction(
      stealthATA,
      destinationATA,
      stealthPubkey,
      amount
    )
  )

  // Get blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = stealthPubkey // Stealth address pays fee

  // Sign with stealth keypair
  transaction.sign(stealthKeypair)

  // Send transaction
  const txSignature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    }
  )

  // Wait for confirmation
  await connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  )

  // Detect cluster
  const cluster = detectCluster(connection.rpcEndpoint)

  return {
    txSignature,
    destinationAddress,
    amount,
    explorerUrl: getExplorerUrl(txSignature, cluster),
  }
}

/**
 * Get token balance for a stealth address
 *
 * @param connection - Solana RPC connection
 * @param stealthAddress - Stealth address to check (base58)
 * @param mint - SPL token mint address
 * @param provider - Optional RPC provider for efficient queries
 * @returns Token balance in smallest unit
 *
 * @example
 * ```typescript
 * // Using standard RPC
 * const balance = await getStealthBalance(connection, stealthAddr, mint)
 *
 * // Using Helius for efficient queries
 * const helius = createProvider('helius', { apiKey })
 * const balance = await getStealthBalance(connection, stealthAddr, mint, helius)
 * ```
 */
export async function getStealthBalance(
  connection: SolanaScanParams['connection'],
  stealthAddress: string,
  mint: PublicKey,
  provider?: SolanaRPCProvider
): Promise<bigint> {
  // Use provider if available for efficient queries
  if (provider) {
    try {
      return await provider.getTokenBalance(stealthAddress, mint.toBase58())
    } catch {
      // Fallback to standard RPC if provider fails
    }
  }

  // Standard RPC fallback
  try {
    const stealthPubkey = new PublicKey(stealthAddress)
    const ata = await getAssociatedTokenAddress(mint, stealthPubkey, true)
    const account = await getAccount(connection, ata)
    return account.amount
  } catch {
    return 0n
  }
}

// Token transfer parsing and symbol lookup moved to ./utils.ts (L3 fix)

/**
 * Detect Solana cluster from RPC endpoint URL
 *
 * Parses the endpoint URL to determine which Solana cluster it connects to.
 *
 * @param endpoint - RPC endpoint URL
 * @returns Detected cluster name
 * @internal
 */
function detectCluster(endpoint: string): SolanaCluster {
  if (endpoint.includes('devnet')) {
    return 'devnet'
  }
  if (endpoint.includes('testnet')) {
    return 'testnet'
  }
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
    return 'localnet'
  }
  return 'mainnet-beta'
}

/**
 * Convert bytes to bigint in little-endian format
 *
 * Used for ed25519 scalar conversion where bytes are in little-endian order.
 *
 * @param bytes - Byte array to convert
 * @returns BigInt representation of the bytes
 * @internal
 */
function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}
