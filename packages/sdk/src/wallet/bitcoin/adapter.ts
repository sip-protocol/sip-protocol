/**
 * Bitcoin Wallet Adapter
 *
 * Implementation of WalletAdapter for Bitcoin.
 * Supports Unisat, Xverse, Leather, and OKX wallets.
 */

import type {
  HexString,
  Asset,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
} from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import type {
  UnisatAPI,
  BitcoinAdapterConfig,
  BitcoinWalletName,
  BitcoinNetwork,
  BitcoinAddress,
  BitcoinBalance,
  SignPsbtOptions,
} from './types'
import {
  getBitcoinProvider,
  bitcoinPublicKeyToHex,
  isValidTaprootAddress,
} from './types'

/**
 * Bitcoin wallet adapter
 *
 * Provides SIP-compatible wallet interface for Bitcoin.
 * Works with Unisat, OKX, Xverse, and Leather wallets.
 *
 * @example Browser usage with Unisat
 * ```typescript
 * const wallet = new BitcoinWalletAdapter({ wallet: 'unisat' })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} sats`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello Bitcoin'))
 * ```
 *
 * @example With custom network
 * ```typescript
 * const wallet = new BitcoinWalletAdapter({
 *   wallet: 'unisat',
 *   network: 'testnet',
 * })
 * ```
 */
export class BitcoinWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'bitcoin' as const
  readonly name: string

  private provider: UnisatAPI | undefined
  private walletName: BitcoinWalletName
  private network: BitcoinNetwork

  constructor(config: BitcoinAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'unisat'
    this.name = `bitcoin-${this.walletName}`
    this.network = config.network ?? 'livenet'

    // Allow injecting provider for testing
    if (config.provider) {
      this.provider = config.provider
    }
  }

  /**
   * Get the current Bitcoin network
   */
  getNetwork(): BitcoinNetwork {
    return this.network
  }

  /**
   * Set the Bitcoin network
   */
  async setNetwork(network: BitcoinNetwork): Promise<void> {
    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      await this.provider.switchNetwork(network)
      this.network = network
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch network'
      throw new WalletError(message, WalletErrorCode.UNKNOWN, { cause: error as Error })
    }
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getBitcoinProvider(this.walletName)
      }

      if (!this.provider) {
        this.setError(
          WalletErrorCode.NOT_INSTALLED,
          `${this.walletName} wallet is not installed`
        )
        throw new WalletError(
          `${this.walletName} wallet is not installed`,
          WalletErrorCode.NOT_INSTALLED
        )
      }

      // Request account access
      const accounts = await this.provider.requestAccounts()

      if (!accounts || accounts.length === 0) {
        throw new WalletError(
          'No accounts returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Get the first account (Taproot address)
      const address = accounts[0]

      // Validate Taproot address format
      if (!isValidTaprootAddress(address, this.network)) {
        throw new WalletError(
          `Invalid Taproot address format: ${address}`,
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Get public key
      const publicKey = await this.provider.getPublicKey()
      const hexPubKey = bitcoinPublicKeyToHex(publicKey)

      // Update state
      this.setConnected(address, hexPubKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'

      // Check if user rejected
      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        this.setError(WalletErrorCode.CONNECTION_REJECTED, message)
        throw new WalletError(message, WalletErrorCode.CONNECTION_REJECTED)
      }

      this.setError(WalletErrorCode.CONNECTION_FAILED, message)
      throw error instanceof WalletError
        ? error
        : new WalletError(message, WalletErrorCode.CONNECTION_FAILED, { cause: error as Error })
    }
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    this.setDisconnected('User disconnected')
    // Note: Unisat doesn't have a disconnect method
    // The wallet remains accessible but we clear our state
  }

  /**
   * Sign a message
   *
   * Uses BIP-322 simple signature format by default
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Convert message to string (Unisat expects string)
      const messageStr = new TextDecoder().decode(message)

      // Sign using BIP-322 simple format (preferred for Taproot)
      const signature = await this.provider.signMessage(messageStr, 'bip322-simple')

      // Signature is returned as base64, convert to hex
      const sigBytes = Buffer.from(signature, 'base64')

      return {
        signature: ('0x' + sigBytes.toString('hex')) as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   *
   * The transaction data should be a PSBT in hex format
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Extract PSBT from transaction data
      const psbtHex = tx.data as string
      const options = tx.metadata?.signPsbtOptions as SignPsbtOptions | undefined

      // Sign PSBT
      const signedPsbt = await this.provider.signPsbt(psbtHex, options)

      return {
        unsigned: tx,
        signatures: [
          {
            signature: ('0x' + signedPsbt) as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: ('0x' + signedPsbt) as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign and send a PSBT
   *
   * Note: This signs the PSBT and broadcasts the finalized transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Extract PSBT from transaction data
      const psbtHex = tx.data as string
      const options = tx.metadata?.signPsbtOptions as SignPsbtOptions | undefined

      // Sign with autoFinalized: true to get a finalized PSBT ready for broadcast
      const signedPsbt = await this.provider.signPsbt(psbtHex, {
        ...options,
        autoFinalized: true, // Request wallet to finalize the PSBT
      })

      // Try to broadcast the finalized transaction
      let txid: string

      try {
        // First, try to push the signed PSBT directly
        // Some wallets return a raw transaction after finalization
        txid = await this.provider.pushTx(signedPsbt)
      } catch (pushError) {
        // If pushTx fails (e.g., Xverse/Leather), try extracting raw tx
        // The signed PSBT may need extraction of the final transaction
        const rawTx = this.extractRawTransaction(signedPsbt)
        if (rawTx) {
          txid = await this.provider.pushTx(rawTx)
        } else {
          throw pushError
        }
      }

      return {
        txHash: ('0x' + txid) as HexString,
        status: 'pending', // Transaction is broadcast but not confirmed
        timestamp: Date.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.TRANSACTION_REJECTED)
      }

      if (message.includes('insufficient') || message.includes('Insufficient')) {
        throw new WalletError(message, WalletErrorCode.INSUFFICIENT_FUNDS)
      }

      throw new WalletError(message, WalletErrorCode.TRANSACTION_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Extract raw transaction from a finalized PSBT
   *
   * A finalized PSBT has all inputs signed and can be converted to a raw transaction.
   * This is a simplified extraction - full implementation would use bitcoinjs-lib.
   *
   * @param psbtHex - Hex-encoded finalized PSBT
   * @returns Raw transaction hex or undefined if extraction fails
   */
  private extractRawTransaction(psbtHex: string): string | undefined {
    try {
      // PSBT format: magic bytes (4) + separator (1) + key-value pairs
      // After finalization, the PSBT contains the final scriptSig/witness for each input
      // Full extraction requires parsing the PSBT structure

      // For browser environments, we rely on the wallet to finalize properly
      // This is a fallback that checks if the hex looks like a raw transaction
      // Raw transactions start with version (4 bytes), typically 01000000 or 02000000

      const cleanHex = psbtHex.startsWith('0x') ? psbtHex.slice(2) : psbtHex

      // Check if it's already a raw transaction (not a PSBT)
      // PSBT magic: 70736274ff (psbt + 0xff)
      if (!cleanHex.startsWith('70736274ff')) {
        // Might already be a raw transaction
        if (cleanHex.startsWith('01000000') || cleanHex.startsWith('02000000')) {
          return cleanHex
        }
      }

      // Cannot extract without proper PSBT parsing library
      // Return undefined to let the caller handle the error
      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * Get native BTC balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const balance = await this.provider.getBalance()
      return BigInt(balance.total)
    } catch (error) {
      throw new WalletError(
        'Failed to get balance',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get token balance
   *
   * For Bitcoin, this returns BRC-20 token balances.
   * Uses Unisat Open API for balance queries.
   *
   * @param asset - Asset with token symbol (e.g., 'ordi', 'sats')
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'bitcoin') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Bitcoin adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    if (!this._address) {
      throw new WalletError('No address connected', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Query BRC-20 balance from indexer API
      const balance = await this.queryBrc20Balance(this._address, asset.symbol)
      return balance
    } catch (error) {
      // Return 0 if query fails (token might not exist or API unavailable)
      console.warn(`Failed to query BRC-20 balance for ${asset.symbol}:`, error)
      return 0n
    }
  }

  /**
   * Query BRC-20 token balance from indexer API
   *
   * Uses Unisat Open API as the default indexer.
   * Can be overridden by setting brc20ApiUrl in config.
   *
   * @param address - Bitcoin address
   * @param ticker - BRC-20 token ticker (e.g., 'ordi', 'sats')
   */
  private async queryBrc20Balance(address: string, ticker: string): Promise<bigint> {
    // Unisat Open API endpoint for BRC-20 balances
    // API docs: https://open-api.unisat.io/swagger.html
    const apiUrl = `https://open-api.unisat.io/v1/indexer/address/${address}/brc20/${ticker.toLowerCase()}/info`

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Note: Production usage may require API key
          // 'Authorization': `Bearer ${apiKey}`
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Token not found or no balance
          return 0n
        }
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()

      // Unisat API response format:
      // { code: 0, msg: 'ok', data: { ticker, overallBalance, transferableBalance, availableBalance } }
      if (data.code === 0 && data.data) {
        // availableBalance is the spendable balance (not in pending transfers)
        const balance = data.data.availableBalance || data.data.overallBalance || '0'
        // BRC-20 balances are strings, convert to bigint
        // Note: BRC-20 uses 18 decimal places by default
        return BigInt(balance.replace('.', '').padEnd(18, '0'))
      }

      return 0n
    } catch (error) {
      // Fallback: try alternative API or return 0
      return this.queryBrc20BalanceFallback(address, ticker)
    }
  }

  /**
   * Fallback BRC-20 balance query using Hiro/Ordinals API
   */
  private async queryBrc20BalanceFallback(address: string, ticker: string): Promise<bigint> {
    try {
      // Hiro Ordinals API
      const apiUrl = `https://api.hiro.so/ordinals/v1/brc-20/balances/${address}`

      const response = await fetch(apiUrl)
      if (!response.ok) return 0n

      const data = await response.json()

      // Find the specific ticker in results
      const tokenBalance = data.results?.find(
        (t: { ticker: string }) => t.ticker.toLowerCase() === ticker.toLowerCase()
      )

      if (tokenBalance?.overall_balance) {
        return BigInt(tokenBalance.overall_balance)
      }

      return 0n
    } catch {
      return 0n
    }
  }

  /**
   * Get Bitcoin addresses
   *
   * Returns the current Taproot address with metadata
   */
  async getAddresses(): Promise<BitcoinAddress[]> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const accounts = await this.provider.getAccounts()
      const publicKey = await this.provider.getPublicKey()

      return accounts.map((address) => ({
        address,
        publicKey,
        type: 'p2tr' as const, // Unisat uses Taproot by default
      }))
    } catch (error) {
      throw new WalletError(
        'Failed to get addresses',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get detailed balance information
   */
  async getBalanceDetails(): Promise<BitcoinBalance> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const balance = await this.provider.getBalance()
      return {
        confirmed: BigInt(balance.confirmed),
        unconfirmed: BigInt(balance.unconfirmed),
        total: BigInt(balance.total),
      }
    } catch (error) {
      throw new WalletError(
        'Failed to get balance details',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Sign a PSBT directly
   *
   * Bitcoin-specific method for PSBT signing with options
   */
  async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.signPsbt(psbtHex, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PSBT signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Push a raw transaction to the network
   *
   * Bitcoin-specific method for broadcasting transactions
   */
  async pushTx(rawTx: string): Promise<string> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.pushTx(rawTx)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction broadcast failed'

      if (message.includes('insufficient') || message.includes('Insufficient')) {
        throw new WalletError(message, WalletErrorCode.INSUFFICIENT_FUNDS)
      }

      throw new WalletError(message, WalletErrorCode.TRANSACTION_FAILED, {
        cause: error as Error,
      })
    }
  }
}

/**
 * Create a Bitcoin wallet adapter with default configuration
 */
export function createBitcoinAdapter(
  config: BitcoinAdapterConfig = {}
): BitcoinWalletAdapter {
  return new BitcoinWalletAdapter(config)
}
