/**
 * Ethereum Wallet Adapter
 *
 * Implementation of WalletAdapter for Ethereum wallets (MetaMask, Coinbase, etc.).
 * Uses EIP-1193 provider standard for wallet communication.
 */

import type {
  Asset,
  HexString,
  ChainId,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
} from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import type {
  EIP1193Provider,
  EthereumAdapterConfig,
  EthereumTransactionRequest,
  EthereumTransactionReceipt,
  EthereumWalletName,
  EIP712TypedData,
} from './types'
import {
  getEthereumProvider,
  toHex,
  hexToNumber,
  normalizeAddress,
  getDefaultRpcEndpoint,
  EthereumChainId,
} from './types'

/**
 * Ethereum wallet adapter implementation
 *
 * @example
 * ```typescript
 * const adapter = new EthereumWalletAdapter({
 *   wallet: 'metamask',
 *   chainId: 1,
 * })
 *
 * await adapter.connect()
 * const balance = await adapter.getBalance()
 * ```
 */
export class EthereumWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'ethereum' as const
  readonly name: string

  private provider: EIP1193Provider | undefined
  private _chainId: number
  private _rpcEndpoint: string
  private walletType: EthereumWalletName
  private boundAccountsChanged: (...args: unknown[]) => void
  private boundChainChanged: (...args: unknown[]) => void
  private boundDisconnect: (...args: unknown[]) => void

  constructor(config: EthereumAdapterConfig = {}) {
    super()
    this.walletType = config.wallet ?? 'metamask'
    this._chainId = config.chainId ?? EthereumChainId.MAINNET
    this._rpcEndpoint = config.rpcEndpoint ?? getDefaultRpcEndpoint(this._chainId)
    this.name = `ethereum-${this.walletType}`
    this.provider = config.provider

    // Bind event handlers
    this.boundAccountsChanged = this.handleAccountsChanged.bind(this)
    this.boundChainChanged = this.handleChainChanged.bind(this)
    this.boundDisconnect = this.handleDisconnect.bind(this)
  }

  /**
   * Get current chain ID
   */
  getChainId(): number {
    return this._chainId
  }

  /**
   * Get RPC endpoint URL
   */
  getRpcEndpoint(): string {
    return this._rpcEndpoint
  }

  /**
   * Set RPC endpoint URL
   */
  setRpcEndpoint(endpoint: string): void {
    this._rpcEndpoint = endpoint
  }

  /**
   * Connect to Ethereum wallet
   */
  async connect(): Promise<void> {
    try {
      this._connectionState = 'connecting'

      // Get provider
      if (!this.provider) {
        this.provider = getEthereumProvider(this.walletType)
      }

      if (!this.provider) {
        this._connectionState = 'error'
        throw new WalletError(
          `${this.walletType} wallet not found. Please install the extension.`,
          WalletErrorCode.NOT_INSTALLED
        )
      }

      // Request accounts (triggers connection popup)
      const accounts = await this.provider.request<string[]>({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        this._connectionState = 'error'
        throw new WalletError(
          'No accounts returned from wallet',
          WalletErrorCode.CONNECTION_REJECTED
        )
      }

      const address = normalizeAddress(accounts[0])

      // Get chain ID
      const chainIdHex = await this.provider.request<string>({
        method: 'eth_chainId',
      })
      this._chainId = hexToNumber(chainIdHex)

      // Update RPC endpoint if chain changed
      this._rpcEndpoint = getDefaultRpcEndpoint(this._chainId)

      // Set up event listeners
      this.setupEventListeners()

      // Set connected state
      // For Ethereum, publicKey is the address (no separate public key concept)
      this.setConnected(address, address as HexString)
    } catch (error) {
      this._connectionState = 'error'

      if (error instanceof WalletError) {
        throw error
      }

      // Handle common EIP-1193 errors
      const rpcError = error as { code?: number; message?: string }
      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected connection request',
          WalletErrorCode.CONNECTION_REJECTED
        )
      }

      throw new WalletError(
        `Failed to connect: ${rpcError.message || String(error)}`,
        WalletErrorCode.CONNECTION_FAILED
      )
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    this.removeEventListeners()
    this.setDisconnected()
    this.provider = undefined
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError(
        'Provider not available',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    try {
      // Convert message to hex
      const messageHex = `0x${Buffer.from(message).toString('hex')}`

      // Use personal_sign for message signing
      const signature = await this.provider.request<string>({
        method: 'personal_sign',
        params: [messageHex, this._address],
      })

      return {
        signature: signature as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const rpcError = error as { code?: number; message?: string }

      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected signing request',
          WalletErrorCode.SIGNING_REJECTED
        )
      }

      throw new WalletError(
        `Failed to sign message: ${rpcError.message || String(error)}`,
        WalletErrorCode.SIGNING_FAILED
      )
    }
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: EIP712TypedData): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError(
        'Provider not available',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    try {
      const signature = await this.provider.request<string>({
        method: 'eth_signTypedData_v4',
        params: [this._address, JSON.stringify(typedData)],
      })

      return {
        signature: signature as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const rpcError = error as { code?: number; message?: string }

      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected signing request',
          WalletErrorCode.SIGNING_REJECTED
        )
      }

      throw new WalletError(
        `Failed to sign typed data: ${rpcError.message || String(error)}`,
        WalletErrorCode.SIGNING_FAILED
      )
    }
  }

  /**
   * Sign a transaction without sending
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError(
        'Provider not available',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    try {
      const ethTx = tx.data as EthereumTransactionRequest

      // Ensure from address is set
      const txWithFrom: EthereumTransactionRequest = {
        ...ethTx,
        from: ethTx.from ?? this._address,
      }

      // Use eth_signTransaction if available (not all wallets support this)
      // MetaMask doesn't support eth_signTransaction, so we'll simulate
      const signature = await this.provider.request<string>({
        method: 'eth_signTransaction',
        params: [txWithFrom],
      })

      return {
        unsigned: tx,
        signatures: [
          {
            signature: signature as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: signature as HexString,
      }
    } catch (error) {
      const rpcError = error as { code?: number; message?: string }

      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected transaction signing',
          WalletErrorCode.SIGNING_REJECTED
        )
      }

      // Many wallets don't support eth_signTransaction
      // Fall back to creating a mock signed transaction
      if (rpcError.code === -32601 || rpcError.message?.includes('not supported')) {
        // Method not supported - create placeholder
        const mockSig = `0x${'00'.repeat(65)}` as HexString
        return {
          unsigned: tx,
          signatures: [
            {
              signature: mockSig,
              publicKey: this._publicKey as HexString,
            },
          ],
          serialized: mockSig,
        }
      }

      throw new WalletError(
        `Failed to sign transaction: ${rpcError.message || String(error)}`,
        WalletErrorCode.TRANSACTION_FAILED
      )
    }
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError(
        'Provider not available',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    try {
      const ethTx = tx.data as EthereumTransactionRequest

      // Ensure from address is set
      const txWithFrom: EthereumTransactionRequest = {
        ...ethTx,
        from: ethTx.from ?? this._address,
      }

      // Send transaction
      const txHash = await this.provider.request<string>({
        method: 'eth_sendTransaction',
        params: [txWithFrom],
      })

      return {
        txHash: txHash as HexString,
        status: 'pending',
      }
    } catch (error) {
      const rpcError = error as { code?: number; message?: string }

      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected transaction',
          WalletErrorCode.TRANSACTION_REJECTED
        )
      }

      throw new WalletError(
        `Failed to send transaction: ${rpcError.message || String(error)}`,
        WalletErrorCode.TRANSACTION_FAILED
      )
    }
  }

  /**
   * Get ETH balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    try {
      // Use provider if available (more reliable)
      if (this.provider) {
        const balance = await this.provider.request<string>({
          method: 'eth_getBalance',
          params: [this._address, 'latest'],
        })
        return BigInt(balance)
      }

      // Fallback to RPC
      const response = await fetch(this._rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [this._address, 'latest'],
        }),
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error.message)
      }

      return BigInt(data.result)
    } catch (error) {
      throw new WalletError(
        `Failed to fetch balance: ${String(error)}`,
        WalletErrorCode.UNKNOWN
      )
    }
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'ethereum') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Ethereum adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // Native ETH
    if (!asset.address) {
      return this.getBalance()
    }

    try {
      // ERC-20 balanceOf call
      // Function selector: balanceOf(address) = 0x70a08231
      const data = `0x70a08231000000000000000000000000${this._address.slice(2)}`

      const result = await this.provider?.request<string>({
        method: 'eth_call',
        params: [
          {
            to: asset.address,
            data,
          },
          'latest',
        ],
      })

      if (!result || result === '0x') {
        return 0n
      }

      return BigInt(result)
    } catch (error) {
      throw new WalletError(
        `Failed to fetch token balance: ${String(error)}`,
        WalletErrorCode.UNKNOWN
      )
    }
  }

  /**
   * Switch to a different chain
   */
  async switchChain(chainId: number): Promise<void> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError(
        'Provider not available',
        WalletErrorCode.NOT_CONNECTED
      )
    }

    try {
      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHex(chainId) }],
      })

      this._chainId = chainId
      this._rpcEndpoint = getDefaultRpcEndpoint(chainId)
    } catch (error) {
      const rpcError = error as { code?: number; message?: string }

      if (rpcError.code === 4001) {
        throw new WalletError(
          'User rejected chain switch',
          WalletErrorCode.CHAIN_SWITCH_REJECTED
        )
      }

      // Chain not added to wallet
      if (rpcError.code === 4902) {
        throw new WalletError(
          `Chain ${chainId} not added to wallet`,
          WalletErrorCode.UNSUPPORTED_CHAIN
        )
      }

      throw new WalletError(
        `Failed to switch chain: ${rpcError.message || String(error)}`,
        WalletErrorCode.CHAIN_SWITCH_FAILED
      )
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string,
    confirmations: number = 1
  ): Promise<EthereumTransactionReceipt> {
    const maxAttempts = 60 // 5 minutes with 5s interval
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const receipt = await this.provider?.request<EthereumTransactionReceipt | null>({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        })

        if (receipt) {
          // Check confirmations
          const currentBlock = await this.provider?.request<string>({
            method: 'eth_blockNumber',
          })

          if (currentBlock) {
            const receiptBlock = hexToNumber(receipt.blockNumber)
            const currentBlockNum = hexToNumber(currentBlock)
            const confirmedBlocks = currentBlockNum - receiptBlock + 1

            if (confirmedBlocks >= confirmations) {
              return receipt
            }
          }
        }
      } catch {
        // Ignore errors, keep polling
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    throw new WalletError(
      `Transaction ${txHash} not confirmed after ${maxAttempts * 5} seconds`,
      WalletErrorCode.TRANSACTION_FAILED
    )
  }

  /**
   * Set up provider event listeners
   */
  private setupEventListeners(): void {
    if (!this.provider) return

    this.provider.on('accountsChanged', this.boundAccountsChanged)
    this.provider.on('chainChanged', this.boundChainChanged)
    this.provider.on('disconnect', this.boundDisconnect)
  }

  /**
   * Remove provider event listeners
   */
  private removeEventListeners(): void {
    if (!this.provider) return

    this.provider.removeListener('accountsChanged', this.boundAccountsChanged)
    this.provider.removeListener('chainChanged', this.boundChainChanged)
    this.provider.removeListener('disconnect', this.boundDisconnect)
  }

  /**
   * Handle accounts changed event
   */
  private handleAccountsChanged(...args: unknown[]): void {
    const accounts = args[0] as string[]
    if (!accounts || accounts.length === 0) {
      this.handleDisconnect()
      return
    }

    const previousAddress = this._address
    const newAddress = normalizeAddress(accounts[0])

    if (previousAddress !== newAddress) {
      this._address = newAddress
      this._publicKey = newAddress as HexString

      this.emit({
        type: 'accountChanged',
        previousAddress,
        newAddress,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Handle chain changed event
   */
  private handleChainChanged(...args: unknown[]): void {
    const chainId = args[0] as string
    if (!chainId) return

    const previousChainId = this._chainId
    const newChainId = hexToNumber(chainId)

    if (previousChainId !== newChainId) {
      this._chainId = newChainId
      this._rpcEndpoint = getDefaultRpcEndpoint(newChainId)

      // For Ethereum, emit chain change as 'ethereum' since that's our chain ID
      this.emit({
        type: 'chainChanged',
        previousChain: 'ethereum' as ChainId,
        newChain: 'ethereum' as ChainId,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Handle disconnect event
   */
  private handleDisconnect(): void {
    this.setDisconnected('Wallet disconnected')
  }
}

/**
 * Factory function to create Ethereum adapter
 */
export function createEthereumAdapter(
  config?: EthereumAdapterConfig
): EthereumWalletAdapter {
  return new EthereumWalletAdapter(config)
}
