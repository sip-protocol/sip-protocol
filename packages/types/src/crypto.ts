/**
 * Cryptographic primitives for SIP Protocol
 */

/** Hex-encoded string */
export type HexString = `0x${string}`

/** Hash type (32 bytes, hex encoded) */
export type Hash = HexString

/**
 * Pedersen commitment: value * G + blinding * H
 * Hides the actual value while allowing proofs
 */
export interface Commitment {
  /** The commitment value (hex encoded) */
  value: HexString
  /** Optional blinding factor for opening the commitment */
  blindingFactor?: HexString
}

/**
 * Zero-knowledge proof
 */
export interface ZKProof {
  /** Proof type identifier */
  type: 'funding' | 'validity' | 'fulfillment'
  /** The proof data (hex encoded) */
  proof: HexString
  /** Public inputs to the proof */
  publicInputs: HexString[]
}

/**
 * Viewing key for selective disclosure
 */
export interface ViewingKey {
  /** The viewing key (hex encoded) */
  key: HexString
  /** Key derivation path */
  path: string
  /** Hash of the viewing key for on-chain reference */
  hash: Hash
}

/**
 * Encrypted transaction data (can be decrypted with viewing key)
 */
export interface EncryptedTransaction {
  /** Encrypted data (hex encoded) */
  ciphertext: HexString
  /** Nonce for decryption */
  nonce: HexString
  /** Hash of the viewing key that can decrypt this */
  viewingKeyHash: Hash
}

/**
 * Viewing proof - proves transaction details to an auditor
 */
export interface ViewingProof {
  /** The decrypted transaction details */
  transaction: {
    sender: string
    recipient: string
    amount: string
    timestamp: number
  }
  /** Proof that decryption was done correctly */
  proof: ZKProof
}
