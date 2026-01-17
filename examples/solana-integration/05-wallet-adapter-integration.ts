/**
 * 05-wallet-adapter-integration.ts
 *
 * Demonstrates integrating SIP Protocol with Solana wallet adapters.
 *
 * This example shows:
 * 1. Setting up wallet adapter connection
 * 2. Using wallet for signing stealth transfers
 * 3. Handling different wallet types (Phantom, Solflare, etc.)
 * 4. Error handling and user feedback
 *
 * Usage:
 *   npx ts-node examples/solana-integration/05-wallet-adapter-integration.ts
 *
 * Note: This example is designed for reference. In a real app, you'd use
 * the React hooks from @sip-protocol/react with @solana/wallet-adapter-react.
 *
 * @packageDocumentation
 */

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js'
import {
  generateStealthMetaAddress,
  decodeStealthMetaAddress,
  createSolanaAdapter,
  type WalletAdapter,
  type StealthMetaAddress,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const CLUSTER = process.env.CLUSTER || 'devnet'
const RPC_URL = process.env.RPC_URL || `https://api.${CLUSTER}.solana.com`

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: WALLET ADAPTER INTEGRATION (SOLANA)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Cluster: ${CLUSTER}`)
  console.log(`RPC:     ${RPC_URL}`)
  console.log('')

  const connection = new Connection(RPC_URL, 'confirmed')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: WALLET ADAPTER OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Wallet adapter overview')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
SIP Protocol provides adapters for common Solana wallets:

┌─────────────────────────────────────────────────────────────────────────────┐
│  SUPPORTED WALLETS                                                          │
│                                                                             │
│  Browser Extensions:                                                        │
│    - Phantom                                                                │
│    - Solflare                                                               │
│    - Backpack                                                               │
│    - Glow                                                                   │
│                                                                             │
│  Mobile:                                                                    │
│    - Phantom Mobile                                                         │
│    - Solflare Mobile                                                        │
│                                                                             │
│  Hardware:                                                                  │
│    - Ledger (via Solflare)                                                  │
│                                                                             │
│  WalletConnect:                                                             │
│    - Any WalletConnect-compatible wallet                                    │
└─────────────────────────────────────────────────────────────────────────────┘
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: ADAPTER CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Create wallet adapter')
  console.log('─────────────────────────────────────────────────────────────────')

  // In a browser environment, you'd detect available wallets
  console.log('Browser environment wallet detection:')
  console.log(`
  // Check for Phantom
  if (window.solana?.isPhantom) {
    const adapter = createSolanaAdapter({ providerName: 'Phantom' })
    await adapter.connect()
  }

  // Check for Solflare
  if (window.solflare?.isSolflare) {
    const adapter = createSolanaAdapter({ providerName: 'Solflare' })
    await adapter.connect()
  }

  // Use wallet-adapter-react for multi-wallet support
  // See @solana/wallet-adapter-react documentation
`)

  // For this demo, we'll create a mock adapter
  console.log('Creating mock adapter for demonstration...')
  console.log('')

  const mockKeypair = Keypair.generate()
  const mockAdapter = createMockWalletAdapter(mockKeypair)

  console.log(`Mock wallet address: ${mockAdapter.publicKey?.toBase58()}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: WALLET ADAPTER INTERFACE
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Wallet adapter interface')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
WalletAdapter interface:

interface WalletAdapter {
  // Connection state
  connected: boolean
  publicKey: PublicKey | null

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>

  // Signing
  signTransaction(tx: Transaction): Promise<Transaction>
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>
  signMessage(message: Uint8Array): Promise<Uint8Array>

  // Events
  on(event: 'connect' | 'disconnect' | 'error', callback): void
}
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: INTEGRATE WITH SIP
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Integrate wallet with SIP transfers')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('Using wallet adapter for stealth transfers:')
  console.log('')

  // Generate recipient address
  const recipient = generateStealthMetaAddress('solana', 'Recipient')

  console.log(`
  // Example: Send private transfer using wallet adapter

  import { sendPrivateSPLTransfer } from '@sip-protocol/sdk'

  const result = await sendPrivateSPLTransfer({
    connection,
    sender: wallet.publicKey,
    senderTokenAccount: getAssociatedTokenAddressSync(mint, wallet.publicKey),
    recipientMetaAddress: recipientMetaAddress,
    mint: USDC_MINT,
    amount: 10_000_000n,  // 10 USDC
    signTransaction: async (tx) => {
      // Wallet adapter handles signing
      return await wallet.signTransaction(tx)
    },
  })

  console.log('Sent to stealth address:', result.stealthAddress)
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: REACT HOOKS USAGE
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: React hooks integration')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
For React applications, use @sip-protocol/react:

  import { useStealthTransfer, useStealthAddress } from '@sip-protocol/react'
  import { useWallet, useConnection } from '@solana/wallet-adapter-react'

  function PrivatePayment() {
    const { connection } = useConnection()
    const { publicKey, signTransaction } = useWallet()

    // Generate stealth address
    const { metaAddress, generate } = useStealthAddress()

    // Send private transfer
    const { transfer, isLoading, error } = useStealthTransfer({
      connection,
      sender: publicKey,
      signTransaction,
    })

    const handleSend = async () => {
      const result = await transfer({
        recipientMetaAddress: recipientMeta,
        mint: USDC_MINT,
        senderTokenAccount: myATA,
        amount: 10_000_000n,
      })

      console.log('Sent!', result.explorerUrl)
    }

    return (
      <button onClick={handleSend} disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send Private Payment'}
      </button>
    )
  }
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Error handling')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Common wallet errors and handling:

  try {
    await wallet.connect()
  } catch (error) {
    if (error.message.includes('User rejected')) {
      // User declined connection request
      showToast('Please approve the wallet connection')
    } else if (error.message.includes('Wallet not found')) {
      // Wallet extension not installed
      showToast('Please install Phantom or Solflare')
    } else if (error.message.includes('Already connected')) {
      // Already connected, safe to proceed
    } else {
      // Unexpected error
      console.error('Wallet error:', error)
      showToast('Failed to connect wallet')
    }
  }

Transaction errors:

  try {
    await transfer(params)
  } catch (error) {
    if (error.message.includes('Insufficient')) {
      showToast('Insufficient balance for transfer')
    } else if (error.message.includes('User rejected')) {
      showToast('Transaction cancelled')
    } else if (error.message.includes('rate limit')) {
      // Retry with backoff
      await sleep(1000)
      await transfer(params)
    }
  }
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('Integration checklist:')
  console.log('  ✓ Install @solana/wallet-adapter-react')
  console.log('  ✓ Install @sip-protocol/react')
  console.log('  ✓ Wrap app with ConnectionProvider + WalletProvider')
  console.log('  ✓ Use useWallet() for wallet state')
  console.log('  ✓ Use useStealthTransfer() for private payments')
  console.log('  ✓ Use useScanPayments() for receiving')
  console.log('')
  console.log('Resources:')
  console.log('  - @solana/wallet-adapter-react docs')
  console.log('  - examples/react-hooks/ for complete examples')
  console.log('  - @sip-protocol/react API reference')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Create a mock wallet adapter for demonstration
 */
function createMockWalletAdapter(keypair: Keypair): WalletAdapter & { publicKey: PublicKey } {
  return {
    connected: true,
    publicKey: keypair.publicKey,
    chain: 'solana',

    connect: async () => {
      console.log('  [Mock] Wallet connected')
    },

    disconnect: async () => {
      console.log('  [Mock] Wallet disconnected')
    },

    signTransaction: async (tx: Transaction) => {
      tx.sign(keypair)
      console.log('  [Mock] Transaction signed')
      return tx
    },

    signMessage: async (message: Uint8Array) => {
      // In production, this would use nacl.sign.detached
      console.log('  [Mock] Message signed')
      return new Uint8Array(64) // Mock signature
    },
  }
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
