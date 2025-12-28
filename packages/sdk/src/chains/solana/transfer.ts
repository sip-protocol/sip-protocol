/**
 * Solana Private SPL Token Transfer
 *
 * Send SPL tokens to a stealth address with on-chain announcement.
 * Uses ed25519 stealth addresses for Solana-native privacy.
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
} from '../../stealth'
import type { StealthMetaAddress } from '@sip-protocol/types'
import type {
  SolanaPrivateTransferParams,
  SolanaPrivateTransferResult,
} from './types'
import { createAnnouncementMemo } from './types'
import {
  MEMO_PROGRAM_ID,
  getExplorerUrl,
  ESTIMATED_TX_FEE_LAMPORTS,
  type SolanaCluster,
} from './constants'
import { bytesToHex } from '@noble/hashes/utils'

/**
 * Send SPL tokens privately to a stealth address
 *
 * This function:
 * 1. Generates a one-time stealth address from recipient's meta-address
 * 2. Creates/gets Associated Token Account for the stealth address
 * 3. Transfers tokens to the stealth address
 * 4. Adds memo with ephemeral key for recipient scanning
 *
 * @param params - Transfer parameters
 * @returns Transfer result with stealth address and explorer URL
 *
 * @example
 * ```typescript
 * import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'
 *
 * const result = await sendPrivateSPLTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   senderTokenAccount: senderATA,
 *   recipientMetaAddress: {
 *     chain: 'solana',
 *     spendingKey: '0x...',
 *     viewingKey: '0x...',
 *   },
 *   mint: new PublicKey('EPjFWdd5...'),  // USDC
 *   amount: 5_000_000n,  // 5 USDC (6 decimals)
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * console.log('Sent to:', result.stealthAddress)
 * console.log('View on Solscan:', result.explorerUrl)
 * ```
 */
export async function sendPrivateSPLTransfer(
  params: SolanaPrivateTransferParams
): Promise<SolanaPrivateTransferResult> {
  const {
    connection,
    sender,
    senderTokenAccount,
    recipientMetaAddress,
    mint,
    amount,
    signTransaction,
  } = params

  // Validate recipient meta-address is for Solana
  if (recipientMetaAddress.chain !== 'solana') {
    throw new Error(
      `Invalid chain: expected 'solana', got '${recipientMetaAddress.chain}'`
    )
  }

  // 1. Generate stealth address from recipient's meta-address
  const { stealthAddress } = generateEd25519StealthAddress(recipientMetaAddress)

  // Convert to Solana PublicKey (base58)
  const stealthAddressBase58 = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
  const stealthPubkey = new PublicKey(stealthAddressBase58)

  // Convert ephemeral public key to base58
  const ephemeralPubkeyBase58 = ed25519PublicKeyToSolanaAddress(
    stealthAddress.ephemeralPublicKey
  )

  // 2. Get or create Associated Token Account for stealth address
  const stealthATA = await getAssociatedTokenAddress(
    mint,
    stealthPubkey,
    true // allowOwnerOffCurve - stealth addresses may be off-curve
  )

  // Build transaction
  const transaction = new Transaction()

  // Check if stealth ATA exists
  let stealthATAExists = false
  try {
    await getAccount(connection, stealthATA)
    stealthATAExists = true
  } catch {
    // Account doesn't exist, we'll create it
    stealthATAExists = false
  }

  // Create ATA if it doesn't exist
  if (!stealthATAExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        sender, // payer
        stealthATA, // associatedToken
        stealthPubkey, // owner
        mint, // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
  }

  // 3. Add SPL transfer instruction
  transaction.add(
    createTransferInstruction(
      senderTokenAccount, // source
      stealthATA, // destination
      sender, // owner
      amount // amount
    )
  )

  // 4. Add memo with announcement for recipient scanning
  // Format: SIP:1:<ephemeral_pubkey_base58>:<view_tag_hex>
  // viewTag is a number (0-255), convert to 2-char hex
  const viewTagHex = stealthAddress.viewTag.toString(16).padStart(2, '0')
  const memoContent = createAnnouncementMemo(
    ephemeralPubkeyBase58,
    viewTagHex,
    stealthAddressBase58
  )

  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memoContent, 'utf-8'),
  })
  transaction.add(memoInstruction)

  // 5. Get recent blockhash and sign
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.lastValidBlockHeight = lastValidBlockHeight
  transaction.feePayer = sender

  // Sign the transaction
  const signedTx = await signTransaction(transaction)

  // 6. Send and confirm
  const txSignature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  // Wait for confirmation
  await connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash,
      lastValidBlockHeight,
    },
    'confirmed'
  )

  // Determine cluster from connection endpoint
  const cluster = detectCluster(connection.rpcEndpoint)

  return {
    txSignature,
    stealthAddress: stealthAddressBase58,
    ephemeralPublicKey: ephemeralPubkeyBase58,
    viewTag: viewTagHex,
    explorerUrl: getExplorerUrl(txSignature, cluster),
    cluster,
  }
}

/**
 * Estimate transaction fee for a private transfer
 *
 * @param connection - Solana RPC connection
 * @param needsATACreation - Whether ATA needs to be created
 * @returns Estimated fee in lamports
 */
export async function estimatePrivateTransferFee(
  connection: Parameters<typeof sendPrivateSPLTransfer>[0]['connection'],
  needsATACreation: boolean = true
): Promise<bigint> {
  // Base fee for transaction
  let fee = ESTIMATED_TX_FEE_LAMPORTS

  // Add rent for ATA creation if needed
  if (needsATACreation) {
    const rentExemption = await connection.getMinimumBalanceForRentExemption(165)
    fee += BigInt(rentExemption)
  }

  return fee
}

/**
 * Check if a stealth address already has an Associated Token Account
 *
 * @param connection - Solana RPC connection
 * @param stealthAddress - Stealth address (base58)
 * @param mint - Token mint
 * @returns True if ATA exists
 */
export async function hasTokenAccount(
  connection: Parameters<typeof sendPrivateSPLTransfer>[0]['connection'],
  stealthAddress: string,
  mint: PublicKey
): Promise<boolean> {
  try {
    const stealthPubkey = new PublicKey(stealthAddress)
    const ata = await getAssociatedTokenAddress(mint, stealthPubkey, true)
    await getAccount(connection, ata)
    return true
  } catch {
    return false
  }
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
