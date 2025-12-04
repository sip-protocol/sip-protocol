/**
 * Bitcoin Wallet Types
 *
 * Type definitions for Bitcoin wallet adapters.
 * Supports Unisat, Xverse, Leather, and OKX wallets.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Bitcoin address types
 */
export type BitcoinAddressType = 'p2tr' | 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh'

/**
 * Bitcoin network types
 */
export type BitcoinNetwork = 'livenet' | 'testnet'

/**
 * Bitcoin address with metadata
 */
export interface BitcoinAddress {
  /** Address string (bc1p... for Taproot) */
  address: string
  /** Public key (33 bytes compressed or 32 bytes x-only for Taproot) */
  publicKey: string
  /** Address type */
  type: BitcoinAddressType
}

/**
 * Bitcoin balance information
 */
export interface BitcoinBalance {
  /** Confirmed balance in satoshis */
  confirmed: bigint
  /** Unconfirmed balance in satoshis */
  unconfirmed: bigint
  /** Total balance in satoshis */
  total: bigint
}

/**
 * Options for PSBT signing
 */
export interface SignPsbtOptions {
  /** Whether to automatically finalize after signing */
  autoFinalized?: boolean
  /** Specific inputs to sign */
  toSignInputs?: ToSignInput[]
}

/**
 * Input specification for PSBT signing
 */
export interface ToSignInput {
  /** Input index to sign */
  index: number
  /** Address associated with this input */
  address?: string
  /** Public key for this input */
  publicKey?: string
  /** Sighash types allowed (default: [0x01]) */
  sighashTypes?: number[]
}

/**
 * Supported Bitcoin wallet names
 */
export type BitcoinWalletName = 'unisat' | 'xverse' | 'leather' | 'okx'

/**
 * Configuration for Bitcoin wallet adapter
 */
export interface BitcoinAdapterConfig {
  /** Wallet to connect to */
  wallet?: BitcoinWalletName
  /** Bitcoin network */
  network?: BitcoinNetwork
  /** Injected provider (for testing) */
  provider?: UnisatAPI
}

/**
 * Unisat wallet API interface
 *
 * Official API: https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet
 */
export interface UnisatAPI {
  /**
   * Request account access
   * @returns Array of addresses (Taproot addresses)
   */
  requestAccounts(): Promise<string[]>

  /**
   * Get current accounts (if already connected)
   * @returns Array of addresses
   */
  getAccounts(): Promise<string[]>

  /**
   * Get public key for current account
   * @returns 64-char hex string (32 bytes x-only for Taproot)
   */
  getPublicKey(): Promise<string>

  /**
   * Get balance for current account
   * @returns Balance information in satoshis
   */
  getBalance(): Promise<{
    confirmed: number
    unconfirmed: number
    total: number
  }>

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   * @param psbtHex - PSBT in hex format
   * @param options - Signing options
   * @returns Signed PSBT in hex format
   */
  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string>

  /**
   * Sign a message
   * @param message - Message to sign
   * @param type - Signature type (default: 'ecdsa')
   * @returns Signature as base64 string
   */
  signMessage(message: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string>

  /**
   * Push a signed transaction to the network
   * @param rawTx - Raw transaction hex
   * @returns Transaction ID
   */
  pushTx(rawTx: string): Promise<string>

  /**
   * Get current network
   * @returns Network identifier
   */
  getNetwork(): Promise<BitcoinNetwork>

  /**
   * Switch network
   * @param network - Network to switch to
   */
  switchNetwork(network: BitcoinNetwork): Promise<void>

  /**
   * Get chain info
   * @returns Chain identifier ('BITCOIN_MAINNET' or 'BITCOIN_TESTNET')
   */
  getChain(): Promise<{ enum: string; name: string }>

  /**
   * Get inscription info for an inscriptionId
   */
  getInscriptions?(offset?: number, limit?: number): Promise<{
    total: number
    list: Array<{
      inscriptionId: string
      inscriptionNumber: number
      address: string
      outputValue: number
      content: string
      contentType: string
    }>
  }>
}

/**
 * Xverse wallet API interface
 *
 * Official API: https://docs.xverse.app/sats-connect
 */
export interface XverseAPI {
  /**
   * Request wallet connection
   */
  request(
    method: 'getAccounts' | 'getAddresses',
    params?: unknown
  ): Promise<{
    result: {
      addresses: Array<{
        address: string
        publicKey: string
        purpose: 'payment' | 'ordinals' | 'stacks'
        addressType: 'p2tr' | 'p2wpkh' | 'p2sh-p2wpkh' | 'stacks'
      }>
    }
  }>

  /**
   * Sign a PSBT
   */
  request(
    method: 'signPsbt',
    params: {
      psbt: string // base64 encoded PSBT
      signInputs: Record<string, number[]>
      broadcast?: boolean
    }
  ): Promise<{
    result: {
      psbt: string // base64 encoded signed PSBT
      txid?: string // if broadcast: true
    }
  }>

  /**
   * Sign a message
   */
  request(
    method: 'signMessage',
    params: {
      address: string
      message: string
      protocol?: 'ECDSA' | 'BIP322'
    }
  ): Promise<{
    result: {
      signature: string
      messageHash: string
      address: string
    }
  }>

  /**
   * Send BTC
   */
  request(
    method: 'sendTransfer',
    params: {
      recipients: Array<{ address: string; amount: number }>
    }
  ): Promise<{
    result: { txid: string }
  }>
}

/**
 * Leather wallet API interface
 *
 * Official API: https://leather.gitbook.io/developers/bitcoin/connect
 */
export interface LeatherAPI {
  /**
   * Request wallet connection and get addresses
   */
  request(
    method: 'getAddresses'
  ): Promise<{
    result: {
      addresses: Array<{
        symbol: 'BTC' | 'STX'
        type?: 'p2wpkh' | 'p2tr'
        address: string
        publicKey: string
        derivationPath?: string
      }>
    }
  }>

  /**
   * Sign a PSBT
   */
  request(
    method: 'signPsbt',
    params: {
      hex: string // hex encoded PSBT
      account?: number
      allowedSighash?: number[]
      signAtIndex?: number | number[]
      broadcast?: boolean
    }
  ): Promise<{
    result: {
      hex: string // hex encoded signed PSBT
      txid?: string // if broadcast: true
    }
  }>

  /**
   * Sign a message
   */
  request(
    method: 'signMessage',
    params: {
      message: string
      paymentType?: 'p2wpkh' | 'p2tr'
      account?: number
    }
  ): Promise<{
    result: {
      signature: string
      address: string
      message: string
    }
  }>

  /**
   * Send BTC
   */
  request(
    method: 'sendTransfer',
    params: {
      recipients: Array<{ address: string; amount: string }>
      account?: number
    }
  ): Promise<{
    result: { txid: string }
  }>
}

/**
 * Global window interface for Bitcoin wallets
 */
declare global {
  interface Window {
    unisat?: UnisatAPI
    XverseProviders?: {
      BitcoinProvider?: XverseAPI
    }
    LeatherProvider?: LeatherAPI
    btc?: LeatherAPI // Alternative Leather injection
    okxwallet?: {
      bitcoin?: UnisatAPI // OKX uses same API as Unisat
    }
  }
}

/**
 * Wrapper to adapt Xverse API to UnisatAPI interface
 */
export function createXverseWrapper(xverse: XverseAPI): UnisatAPI {
  let cachedAddress: string | undefined
  let cachedPublicKey: string | undefined

  return {
    async requestAccounts(): Promise<string[]> {
      const response = await xverse.request('getAddresses')
      const btcAddresses = response.result.addresses.filter(
        (a) => a.purpose === 'payment' || a.purpose === 'ordinals'
      )
      if (btcAddresses.length > 0) {
        // Prefer Taproot (ordinals) address
        const taprootAddr = btcAddresses.find((a) => a.addressType === 'p2tr')
        const primaryAddr = taprootAddr || btcAddresses[0]
        cachedAddress = primaryAddr.address
        cachedPublicKey = primaryAddr.publicKey
      }
      return btcAddresses.map((a) => a.address)
    },

    async getAccounts(): Promise<string[]> {
      if (cachedAddress) return [cachedAddress]
      return this.requestAccounts()
    },

    async getPublicKey(): Promise<string> {
      if (cachedPublicKey) return cachedPublicKey
      await this.requestAccounts()
      return cachedPublicKey || ''
    },

    async getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }> {
      // Xverse doesn't expose balance directly, return 0s
      // Balance should be fetched from external API
      return { confirmed: 0, unconfirmed: 0, total: 0 }
    },

    async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
      // Convert hex to base64 for Xverse
      const psbtBase64 = Buffer.from(psbtHex, 'hex').toString('base64')
      const signInputs: Record<string, number[]> = {}

      if (options?.toSignInputs && cachedAddress) {
        signInputs[cachedAddress] = options.toSignInputs.map((i) => i.index)
      } else if (cachedAddress) {
        // Sign all inputs by default
        signInputs[cachedAddress] = [0]
      }

      const response = await xverse.request('signPsbt', {
        psbt: psbtBase64,
        signInputs,
        broadcast: false,
      })

      // Convert back to hex
      return Buffer.from(response.result.psbt, 'base64').toString('hex')
    },

    async signMessage(message: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string> {
      if (!cachedAddress) {
        await this.requestAccounts()
      }
      const response = await xverse.request('signMessage', {
        address: cachedAddress!,
        message,
        protocol: type === 'bip322-simple' ? 'BIP322' : 'ECDSA',
      })
      return response.result.signature
    },

    async pushTx(_rawTx: string): Promise<string> {
      // Xverse requires using signPsbt with broadcast: true
      throw new Error('Use signPsbt with broadcast: true for Xverse')
    },

    async getNetwork(): Promise<BitcoinNetwork> {
      // Xverse doesn't expose network, assume mainnet
      return 'livenet'
    },

    async switchNetwork(_network: BitcoinNetwork): Promise<void> {
      throw new Error('Network switching not supported by Xverse')
    },

    async getChain(): Promise<{ enum: string; name: string }> {
      return { enum: 'BITCOIN_MAINNET', name: 'Bitcoin Mainnet' }
    },
  }
}

/**
 * Wrapper to adapt Leather API to UnisatAPI interface
 */
export function createLeatherWrapper(leather: LeatherAPI): UnisatAPI {
  let cachedAddress: string | undefined
  let cachedPublicKey: string | undefined

  return {
    async requestAccounts(): Promise<string[]> {
      const response = await leather.request('getAddresses')
      const btcAddresses = response.result.addresses.filter((a) => a.symbol === 'BTC')
      if (btcAddresses.length > 0) {
        // Prefer Taproot address
        const taprootAddr = btcAddresses.find((a) => a.type === 'p2tr')
        const primaryAddr = taprootAddr || btcAddresses[0]
        cachedAddress = primaryAddr.address
        cachedPublicKey = primaryAddr.publicKey
      }
      return btcAddresses.map((a) => a.address)
    },

    async getAccounts(): Promise<string[]> {
      if (cachedAddress) return [cachedAddress]
      return this.requestAccounts()
    },

    async getPublicKey(): Promise<string> {
      if (cachedPublicKey) return cachedPublicKey
      await this.requestAccounts()
      return cachedPublicKey || ''
    },

    async getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }> {
      // Leather doesn't expose balance directly
      return { confirmed: 0, unconfirmed: 0, total: 0 }
    },

    async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
      const signAtIndex = options?.toSignInputs?.map((i) => i.index)

      const response = await leather.request('signPsbt', {
        hex: psbtHex,
        signAtIndex,
        broadcast: false,
      })

      return response.result.hex
    },

    async signMessage(message: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string> {
      const response = await leather.request('signMessage', {
        message,
        paymentType: 'p2tr',
      })
      return response.result.signature
    },

    async pushTx(_rawTx: string): Promise<string> {
      throw new Error('Use signPsbt with broadcast: true for Leather')
    },

    async getNetwork(): Promise<BitcoinNetwork> {
      return 'livenet'
    },

    async switchNetwork(_network: BitcoinNetwork): Promise<void> {
      throw new Error('Network switching not supported by Leather')
    },

    async getChain(): Promise<{ enum: string; name: string }> {
      return { enum: 'BITCOIN_MAINNET', name: 'Bitcoin Mainnet' }
    },
  }
}

/**
 * Get Bitcoin wallet provider from window
 */
export function getBitcoinProvider(wallet: BitcoinWalletName): UnisatAPI | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  switch (wallet) {
    case 'unisat':
      return window.unisat
    case 'okx':
      // OKX wallet has bitcoin namespace
      return window.okxwallet?.bitcoin
    case 'xverse': {
      const xverse = window.XverseProviders?.BitcoinProvider
      return xverse ? createXverseWrapper(xverse) : undefined
    }
    case 'leather': {
      const leather = window.LeatherProvider || window.btc
      return leather ? createLeatherWrapper(leather) : undefined
    }
    default:
      return undefined
  }
}

/**
 * Detect available Bitcoin wallets
 */
export function detectBitcoinWallets(): BitcoinWalletName[] {
  const wallets: BitcoinWalletName[] = []

  if (typeof window === 'undefined') {
    return wallets
  }

  if (window.unisat) {
    wallets.push('unisat')
  }

  if (window.okxwallet?.bitcoin) {
    wallets.push('okx')
  }

  if (window.XverseProviders?.BitcoinProvider) {
    wallets.push('xverse')
  }

  if (window.LeatherProvider || window.btc) {
    wallets.push('leather')
  }

  return wallets
}

/**
 * Convert Bitcoin address to hex format
 * For Taproot (P2TR), this extracts the 32-byte x-only pubkey from the address
 */
export function bitcoinAddressToHex(address: string): HexString {
  // For now, return the address as-is with 0x prefix
  // Full implementation would decode bech32m and extract the witness program
  return `0x${address}` as HexString
}

/**
 * Convert Bitcoin public key to SIP hex format
 * Handles both compressed (33 bytes) and x-only (32 bytes) public keys
 */
export function bitcoinPublicKeyToHex(pubkey: string): HexString {
  // Remove 0x prefix if present
  const cleanPubkey = pubkey.startsWith('0x') ? pubkey.slice(2) : pubkey

  // Validate length
  if (cleanPubkey.length !== 64 && cleanPubkey.length !== 66) {
    throw new Error(`Invalid Bitcoin public key length: ${cleanPubkey.length} (expected 64 or 66 hex chars)`)
  }

  return `0x${cleanPubkey}` as HexString
}

/**
 * Validate Taproot address format
 */
export function isValidTaprootAddress(address: string, network: BitcoinNetwork = 'livenet'): boolean {
  // Basic validation - full implementation would use bech32m decoder
  if (network === 'livenet') {
    return address.startsWith('bc1p') && address.length >= 62
  } else {
    return address.startsWith('tb1p') && address.length >= 62
  }
}
