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
  TOKEN_PROGRAM_ID,
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
  SOLANA_TOKEN_MINTS,
  type SolanaCluster,
} from './constants'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'

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
    limit = 100,
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

          // Check if this payment is for us using view tag first
          const ephemeralPubKeyHex = solanaAddressToEd25519PublicKey(
            announcement.ephemeralPublicKey
          )

          // Construct stealth address object for checking
          // viewTag is a number (0-255), parse from hex string
          const viewTagNumber = parseInt(announcement.viewTag, 16)
          const stealthAddressToCheck: StealthAddress = {
            address: announcement.stealthAddress
              ? solanaAddressToEd25519PublicKey(announcement.stealthAddress)
              : ('0x' + '00'.repeat(32)) as HexString, // Will be computed
            ephemeralPublicKey: ephemeralPubKeyHex,
            viewTag: viewTagNumber,
          }

          // Check if this is our payment
          const isOurs = checkEd25519StealthAddress(
            stealthAddressToCheck,
            viewingPrivateKey,
            spendingPublicKey
          )

          if (isOurs) {
            // Parse token transfer from transaction
            const transferInfo = parseTokenTransfer(tx)
            if (transferInfo) {
              results.push({
                stealthAddress: announcement.stealthAddress || '',
                ephemeralPublicKey: announcement.ephemeralPublicKey,
                amount: transferInfo.amount,
                mint: transferInfo.mint,
                tokenSymbol: getTokenSymbol(transferInfo.mint),
                txSignature: sigInfo.signature,
                slot: sigInfo.slot,
                timestamp: sigInfo.blockTime || 0,
              })
            }
          }
        }
      } catch (err) {
        // Skip failed transaction parsing
        console.warn(`Failed to parse tx ${sigInfo.signature}:`, err)
      }
    }
  } catch (err) {
    console.error('Scan failed:', err)
    throw new Error(`Failed to scan for payments: ${err}`)
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

  // Solana keypairs expect 64 bytes (32 byte seed + 32 byte public key)
  // We construct this from the derived scalar
  const stealthPubkey = new PublicKey(stealthAddress)
  const stealthKeypair = Keypair.fromSecretKey(
    new Uint8Array([...stealthPrivKeyBytes, ...stealthPubkey.toBytes()])
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
 */
export async function getStealthBalance(
  connection: SolanaScanParams['connection'],
  stealthAddress: string,
  mint: PublicKey
): Promise<bigint> {
  try {
    const stealthPubkey = new PublicKey(stealthAddress)
    const ata = await getAssociatedTokenAddress(mint, stealthPubkey, true)
    const account = await getAccount(connection, ata)
    return account.amount
  } catch {
    return 0n
  }
}

/**
 * Parse token transfer info from a transaction
 */
function parseTokenTransfer(
  tx: Awaited<ReturnType<typeof import('@solana/web3.js').Connection.prototype.getTransaction>>
): { mint: string; amount: bigint } | null {
  if (!tx?.meta?.postTokenBalances || !tx.meta.preTokenBalances) {
    return null
  }

  // Find token balance changes
  for (let i = 0; i < tx.meta.postTokenBalances.length; i++) {
    const post = tx.meta.postTokenBalances[i]
    const pre = tx.meta.preTokenBalances.find(
      (p) => p.accountIndex === post.accountIndex
    )

    const postAmount = BigInt(post.uiTokenAmount.amount)
    const preAmount = pre ? BigInt(pre.uiTokenAmount.amount) : 0n

    if (postAmount > preAmount) {
      return {
        mint: post.mint,
        amount: postAmount - preAmount,
      }
    }
  }

  return null
}

/**
 * Get token symbol from mint address
 */
function getTokenSymbol(mint: string): string | undefined {
  for (const [symbol, address] of Object.entries(SOLANA_TOKEN_MINTS)) {
    if (address === mint) {
      return symbol
    }
  }
  return undefined
}

/**
 * Detect Solana cluster from RPC endpoint
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
