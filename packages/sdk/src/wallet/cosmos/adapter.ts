/**
 * Cosmos Wallet Adapter
 *
 * Implementation of WalletAdapter for Cosmos ecosystem.
 * Supports Keplr, Leap, Cosmostation, and other Cosmos wallets.
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
  Keplr,
  CosmosAdapterConfig,
  CosmosWalletName,
  Key,
  StdSignDoc,
  DirectSignDoc,
  AminoSignResponse,
  DirectSignResponse,
  CosmosUnsignedTransaction,
} from './types'
import {
  getCosmosProvider,
  cosmosPublicKeyToHex,
  getDefaultRpcEndpoint,
  getDefaultRestEndpoint,
  CosmosChainId,
} from './types'

/**
 * Cosmos wallet adapter implementation
 *
 * Provides SIP-compatible wallet interface for Cosmos ecosystem.
 * Works with Keplr, Leap, Cosmostation, and other Cosmos wallets.
 *
 * @example Browser usage with Keplr
 * ```typescript
 * const wallet = new CosmosWalletAdapter({
 *   wallet: 'keplr',
 *   chainId: 'cosmoshub-4',
 * })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} uatom`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello'))
 * ```
 *
 * @example With custom RPC endpoint
 * ```typescript
 * const wallet = new CosmosWalletAdapter({
 *   wallet: 'keplr',
 *   chainId: 'osmosis-1',
 *   rpcEndpoint: 'https://my-rpc.example.com',
 * })
 * ```
 */
export class CosmosWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'cosmos' as const
  readonly name: string

  private provider: Keplr | undefined
  private walletName: CosmosWalletName
  private _chainId: string
  private rpcEndpoint: string
  private restEndpoint: string
  private bech32Prefix: string
  private keyInfo: Key | undefined

  constructor(config: CosmosAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'keplr'
    this.name = `cosmos-${this.walletName}`
    this._chainId = config.chainId ?? CosmosChainId.COSMOSHUB
    this.rpcEndpoint = config.rpcEndpoint ?? getDefaultRpcEndpoint(this._chainId)
    this.restEndpoint = config.restEndpoint ?? getDefaultRestEndpoint(this._chainId)
    this.bech32Prefix = config.bech32Prefix ?? 'cosmos'

    // Allow injecting provider for testing
    if (config.provider) {
      this.provider = config.provider
    }
  }

  /**
   * Get the current Cosmos chain ID
   */
  getChainId(): string {
    return this._chainId
  }

  /**
   * Get the RPC endpoint
   */
  getRpcEndpoint(): string {
    return this.rpcEndpoint
  }

  /**
   * Get the REST endpoint
   */
  getRestEndpoint(): string {
    return this.restEndpoint
  }

  /**
   * Set the RPC endpoint
   */
  setRpcEndpoint(endpoint: string): void {
    this.rpcEndpoint = endpoint
  }

  /**
   * Set the REST endpoint
   */
  setRestEndpoint(endpoint: string): void {
    this.restEndpoint = endpoint
  }

  /**
   * Get the Bech32 address prefix
   */
  getBech32Prefix(): string {
    return this.bech32Prefix
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getCosmosProvider(this.walletName)
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

      // Enable the chain
      await this.provider.enable(this._chainId)

      // Get key info
      this.keyInfo = await this.provider.getKey(this._chainId)

      if (!this.keyInfo) {
        throw new WalletError(
          'No key returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Update state
      const address = this.keyInfo.address
      const hexPubKey = cosmosPublicKeyToHex(this.keyInfo.pubKey)
      this.setConnected(address, hexPubKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'

      // Check if user rejected
      if (message.includes('Request rejected') || message.includes('rejected')) {
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
    this.provider = undefined
    this.keyInfo = undefined
  }

  /**
   * Sign a message using signArbitrary
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const stdSig = await this.provider.signArbitrary(
        this._chainId,
        this._address,
        message
      )

      return {
        signature: ('0x' + Buffer.from(stdSig.signature, 'base64').toString('hex')) as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('Request rejected') || message.includes('rejected')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign a transaction
   *
   * The transaction data should contain either aminoSignDoc or directSignDoc
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const cosmosTx = tx.data as CosmosUnsignedTransaction

      let signature: Signature
      let signResponse: AminoSignResponse | DirectSignResponse

      // Use direct signing if directSignDoc is provided, otherwise use amino
      if (cosmosTx.directSignDoc) {
        signResponse = await this.provider.signDirect(
          this._chainId,
          this._address,
          {
            bodyBytes: cosmosTx.directSignDoc.bodyBytes,
            authInfoBytes: cosmosTx.directSignDoc.authInfoBytes,
            chainId: cosmosTx.directSignDoc.chainId,
            accountNumber: cosmosTx.directSignDoc.accountNumber,
          }
        )

        const directResponse = signResponse as DirectSignResponse
        signature = {
          signature: ('0x' + Buffer.from(directResponse.signature.signature, 'base64').toString('hex')) as HexString,
          publicKey: this._publicKey as HexString,
        }
      } else if (cosmosTx.aminoSignDoc) {
        signResponse = await this.provider.signAmino(
          this._chainId,
          this._address,
          cosmosTx.aminoSignDoc
        )

        const aminoResponse = signResponse as AminoSignResponse
        signature = {
          signature: ('0x' + Buffer.from(aminoResponse.signature.signature, 'base64').toString('hex')) as HexString,
          publicKey: this._publicKey as HexString,
        }
      } else {
        throw new WalletError(
          'Transaction must contain either aminoSignDoc or directSignDoc',
          WalletErrorCode.INVALID_TRANSACTION
        )
      }

      // Serialize response, handling BigInt
      const responseStr = JSON.stringify(signResponse, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )

      return {
        unsigned: tx,
        signatures: [signature],
        serialized: ('0x' + Buffer.from(responseStr).toString('hex')) as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('Request rejected') || message.includes('rejected')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign and send a transaction
   *
   * Note: Cosmos wallets don't typically provide a signAndSend method,
   * so this will sign the transaction but you'll need to broadcast it separately
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    try {
      // Sign the transaction
      const signed = await this.signTransaction(tx)

      // For Cosmos, we would need to broadcast via RPC
      // This is a simplified implementation
      const mockTxHash = ('0x' + Buffer.from(`cosmos_tx_${Date.now()}`).toString('hex')) as HexString

      return {
        txHash: mockTxHash,
        status: 'pending', // Transaction is signed but not broadcast
        timestamp: Date.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'

      if (message.includes('Request rejected') || message.includes('rejected')) {
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
   * Get native token balance (e.g., ATOM, OSMO)
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    try {
      const response = await fetch(`${this.restEndpoint}/cosmos/bank/v1beta1/balances/${this._address}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`)
      }

      const data = await response.json()
      const balances = data.balances as Array<{ denom: string; amount: string }>

      // Get the first balance or 0
      const balance = balances[0]?.amount ?? '0'
      return BigInt(balance)
    } catch (error) {
      throw new WalletError(
        'Failed to get balance',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get token balance by denomination
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'cosmos') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Cosmos adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    try {
      const response = await fetch(`${this.restEndpoint}/cosmos/bank/v1beta1/balances/${this._address}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`)
      }

      const data = await response.json()
      const balances = data.balances as Array<{ denom: string; amount: string }>

      // Find the balance for the specified denomination
      const denom = asset.address ?? asset.symbol.toLowerCase()
      const balance = balances.find((b) => b.denom === denom)?.amount ?? '0'

      return BigInt(balance)
    } catch (error) {
      throw new WalletError(
        'Failed to get token balance',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Sign using Amino (legacy method)
   */
  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.signAmino(this._chainId, signerAddress, signDoc)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'
      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign using Direct (protobuf method)
   */
  async signDirect(
    signerAddress: string,
    signDoc: DirectSignDoc
  ): Promise<DirectSignResponse> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.signDirect(this._chainId, signerAddress, {
        bodyBytes: signDoc.bodyBytes,
        authInfoBytes: signDoc.authInfoBytes,
        chainId: signDoc.chainId,
        accountNumber: signDoc.accountNumber,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'
      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Get account info
   */
  getKeyInfo(): Key | undefined {
    return this.keyInfo
  }
}

/**
 * Create a Cosmos wallet adapter with default configuration
 */
export function createCosmosAdapter(
  config: CosmosAdapterConfig = {}
): CosmosWalletAdapter {
  return new CosmosWalletAdapter(config)
}
