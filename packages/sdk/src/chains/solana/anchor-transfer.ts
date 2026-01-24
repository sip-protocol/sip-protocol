/**
 * Solana Anchor-based Shielded Transfer
 *
 * Uses the SIP Privacy Anchor program for on-chain privacy with:
 * - Pedersen commitments for hidden amounts
 * - Stealth addresses for hidden recipients
 * - Viewing keys for compliance
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Connection,
} from '@solana/web3.js'
import { sha256 } from '@noble/hashes/sha2'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { ValidationError } from '../../errors'
import { commit } from '../../commitment'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  decodeStealthMetaAddress,
} from '../../stealth'
import type { StealthMetaAddress, HexString, StealthAddress } from '@sip-protocol/types'

// Program ID - deployed on devnet
export const SIP_PRIVACY_PROGRAM_ID = new PublicKey(
  'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
)

// Config PDA - initialized on devnet
export const CONFIG_PDA = new PublicKey(
  'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ'
)

// Treasury/fee collector (using authority for now)
export const FEE_COLLECTOR = new PublicKey(
  'S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd'
)

// Seeds
const TRANSFER_RECORD_SEED = Buffer.from('transfer_record')

// Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
const SHIELDED_TRANSFER_DISCRIMINATOR = Buffer.from([
  0x9d, 0x2a, 0x42, 0x93, 0xee, 0x75, 0x61, 0x5c
])

export interface AnchorShieldedTransferParams {
  /** Solana connection */
  connection: Connection
  /** Sender's public key */
  sender: PublicKey
  /** Recipient's SIP address (sip:solana:spending:viewing) or StealthMetaAddress */
  recipient: string | StealthMetaAddress
  /** Amount in lamports */
  amount: bigint
  /** Transaction signer */
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
}

export interface AnchorShieldedTransferResult {
  /** Transaction signature */
  signature: string
  /** Transfer record PDA (noteId) */
  noteId: string
  /** Stealth address funds were sent to */
  stealthAddress: string
  /** Ephemeral public key for recipient scanning */
  ephemeralPublicKey: HexString
  /** Amount commitment */
  commitment: HexString
  /** View tag for quick filtering */
  viewTag: string
  /** Viewing key hash for compliance */
  viewingKeyHash: HexString
  /** Explorer URL */
  explorerUrl: string
}

/**
 * Execute a shielded SOL transfer using the Anchor program
 *
 * @example
 * ```typescript
 * const result = await shieldedTransfer({
 *   connection,
 *   sender: wallet.publicKey,
 *   recipient: 'sip:solana:0x02abc...:0x03def...',
 *   amount: 1_000_000_000n, // 1 SOL
 *   signTransaction: wallet.signTransaction,
 * })
 *
 * console.log('Tx:', result.signature)
 * console.log('Note ID:', result.noteId)
 * ```
 */
export async function shieldedTransfer(
  params: AnchorShieldedTransferParams
): Promise<AnchorShieldedTransferResult> {
  const { connection, sender, recipient, amount, signTransaction } = params

  // Validate inputs
  if (!connection) {
    throw new ValidationError('connection is required', 'connection')
  }
  if (!sender) {
    throw new ValidationError('sender is required', 'sender')
  }
  if (!recipient) {
    throw new ValidationError('recipient is required', 'recipient')
  }
  if (amount <= 0n) {
    throw new ValidationError('amount must be positive', 'amount')
  }

  // Parse recipient address
  const recipientMeta: StealthMetaAddress = typeof recipient === 'string'
    ? decodeStealthMetaAddress(recipient)
    : recipient

  if (recipientMeta.chain !== 'solana') {
    throw new ValidationError(
      `Expected solana chain, got ${recipientMeta.chain}`,
      'recipient'
    )
  }

  // 1. Generate stealth address
  const stealthResult = generateEd25519StealthAddress(recipientMeta)
  const stealthAddr: StealthAddress = stealthResult.stealthAddress
  const stealthPubkey = ed25519PublicKeyToSolanaAddress(stealthAddr.address)
  const stealthAccountPubkey = new PublicKey(stealthPubkey)

  // 2. Generate Pedersen commitment
  const { commitment, blinding } = commit(amount)
  const commitmentBytes = hexToBytes(commitment.slice(2))

  // Ensure commitment is 33 bytes (compressed point)
  if (commitmentBytes.length !== 33) {
    throw new ValidationError(
      `Invalid commitment size: ${commitmentBytes.length}, expected 33`,
      'commitment'
    )
  }

  // 3. Prepare ephemeral public key (33 bytes compressed)
  const ephemeralPubkeyHex = stealthAddr.ephemeralPublicKey
  const ephemeralPubkeyBytes = hexToBytes(ephemeralPubkeyHex.slice(2))

  // Pad or truncate to 33 bytes if needed
  const ephemeralPubkey33 = new Uint8Array(33)
  ephemeralPubkey33[0] = 0x02 // compressed prefix
  ephemeralPubkey33.set(ephemeralPubkeyBytes.slice(0, 32), 1)

  // 4. Compute viewing key hash
  const viewingKeyBytes = hexToBytes(recipientMeta.viewingKey.slice(2))
  const viewingKeyHash = sha256(viewingKeyBytes)

  // 5. Encrypt amount with viewing key
  const encryptedAmount = encryptAmount(amount, recipientMeta.viewingKey)
  const encryptedAmountBytes = hexToBytes(encryptedAmount.slice(2))

  // 6. Create mock proof (real ZK proof integration in future)
  const mockProof = createMockProof(commitment, amount, blinding)

  // 7. Get current transfer count to derive PDA
  const configAccount = await connection.getAccountInfo(CONFIG_PDA)
  if (!configAccount) {
    throw new ValidationError('SIP Privacy program not initialized', 'config')
  }

  // Parse total_transfers from config (offset: 8 + 32 + 2 + 1 = 43, size: 8)
  const totalTransfers = configAccount.data.readBigUInt64LE(43)

  // 8. Derive transfer record PDA
  const [transferRecordPda] = PublicKey.findProgramAddressSync(
    [
      TRANSFER_RECORD_SEED,
      sender.toBuffer(),
      Buffer.from(bigintToLeBytes(totalTransfers)),
    ],
    SIP_PRIVACY_PROGRAM_ID
  )

  // 9. Build instruction data
  const instructionData = buildShieldedTransferData({
    commitment: commitmentBytes,
    stealthPubkey: stealthAccountPubkey,
    ephemeralPubkey: ephemeralPubkey33,
    viewingKeyHash,
    encryptedAmount: encryptedAmountBytes,
    proof: mockProof,
    actualAmount: amount,
  })

  // 10. Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
      { pubkey: transferRecordPda, isSigner: false, isWritable: true },
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: stealthAccountPubkey, isSigner: false, isWritable: true },
      { pubkey: FEE_COLLECTOR, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: SIP_PRIVACY_PROGRAM_ID,
    data: instructionData,
  })

  // 11. Build transaction
  const transaction = new Transaction()
  transaction.add(instruction)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = sender

  // 12. Sign and send
  const signedTx = await signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signedTx.serialize())

  // Wait for confirmation
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  })

  // 13. Return result
  const cluster = await getCluster(connection)

  return {
    signature,
    noteId: transferRecordPda.toBase58(),
    stealthAddress: stealthAccountPubkey.toBase58(),
    ephemeralPublicKey: ephemeralPubkeyHex,
    commitment,
    viewTag: `0x${stealthAddr.viewTag.toString(16).padStart(2, '0')}`,
    viewingKeyHash: `0x${bytesToHex(viewingKeyHash)}`,
    explorerUrl: `https://solscan.io/tx/${signature}?cluster=${cluster}`,
  }
}

/**
 * Build the instruction data for shielded_transfer
 */
function buildShieldedTransferData(params: {
  commitment: Uint8Array
  stealthPubkey: PublicKey
  ephemeralPubkey: Uint8Array
  viewingKeyHash: Uint8Array
  encryptedAmount: Uint8Array
  proof: Uint8Array
  actualAmount: bigint
}): Buffer {
  const {
    commitment,
    stealthPubkey,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof,
    actualAmount,
  } = params

  // Calculate total size
  const size =
    8 + // discriminator
    33 + // commitment
    32 + // stealth_pubkey
    33 + // ephemeral_pubkey
    32 + // viewing_key_hash
    4 + encryptedAmount.length + // encrypted_amount (Vec<u8>)
    4 + proof.length + // proof (Vec<u8>)
    8 // actual_amount

  const buffer = Buffer.alloc(size)
  let offset = 0

  // Discriminator
  SHIELDED_TRANSFER_DISCRIMINATOR.copy(buffer, offset)
  offset += 8

  // Commitment [u8; 33]
  buffer.set(commitment, offset)
  offset += 33

  // Stealth pubkey (Pubkey = 32 bytes)
  buffer.set(stealthPubkey.toBuffer(), offset)
  offset += 32

  // Ephemeral pubkey [u8; 33]
  buffer.set(ephemeralPubkey, offset)
  offset += 33

  // Viewing key hash [u8; 32]
  buffer.set(viewingKeyHash, offset)
  offset += 32

  // Encrypted amount Vec<u8> (4-byte length prefix + data)
  buffer.writeUInt32LE(encryptedAmount.length, offset)
  offset += 4
  buffer.set(encryptedAmount, offset)
  offset += encryptedAmount.length

  // Proof Vec<u8>
  buffer.writeUInt32LE(proof.length, offset)
  offset += 4
  buffer.set(proof, offset)
  offset += proof.length

  // Actual amount u64
  buffer.writeBigUInt64LE(actualAmount, offset)

  return buffer
}

/**
 * Create a mock proof for development (real ZK proof in future)
 */
function createMockProof(
  commitment: HexString,
  amount: bigint,
  blinding: HexString
): Uint8Array {
  // Mock proof: 128 bytes of deterministic data
  const proof = new Uint8Array(128)
  const commitmentBytes = hexToBytes(commitment.slice(2))

  // Fill with hash of inputs for reproducibility
  const inputHash = sha256(
    new Uint8Array([
      ...commitmentBytes,
      ...bigintToLeBytes(amount),
      ...hexToBytes(blinding.slice(2)),
    ])
  )

  proof.set(inputHash, 0)
  proof.set(inputHash, 32)
  proof.set(inputHash, 64)
  proof.set(inputHash, 96)

  return proof
}

/**
 * Convert bigint to little-endian bytes (8 bytes)
 */
function bigintToLeBytes(value: bigint): Uint8Array {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  view.setBigUint64(0, value, true)
  return new Uint8Array(buffer)
}

/**
 * Detect cluster from connection
 */
async function getCluster(connection: Connection): Promise<string> {
  const endpoint = connection.rpcEndpoint
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('testnet')) return 'testnet'
  if (endpoint.includes('mainnet') || endpoint.includes('api.mainnet-beta')) return 'mainnet'
  return 'devnet'
}

/**
 * Encrypt amount using viewing key (XChaCha20-Poly1305)
 */
function encryptAmount(amount: bigint, viewingKey: HexString): HexString {
  // Simple encryption: amount XOR'd with viewing key hash
  // TODO: Use proper XChaCha20-Poly1305 from @noble/ciphers
  const amountBytes = bigintToLeBytes(amount)
  const keyHash = sha256(hexToBytes(viewingKey.slice(2)))

  const encrypted = new Uint8Array(amountBytes.length)
  for (let i = 0; i < amountBytes.length; i++) {
    encrypted[i] = amountBytes[i] ^ keyHash[i]
  }

  return `0x${bytesToHex(encrypted)}`
}
