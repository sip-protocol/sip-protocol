/**
 * 05-metamask-integration.ts
 *
 * Demonstrates MetaMask wallet integration for stealth transfers.
 *
 * This example shows:
 * 1. Connecting to MetaMask via EIP-1193
 * 2. Using SIP's EthereumWalletAdapter
 * 3. Signing stealth transfer transactions
 * 4. Handling wallet events
 *
 * Usage:
 *   npx ts-node examples/ethereum-integration/05-metamask-integration.ts
 *
 * Note: This example shows patterns for browser integration.
 * It won't connect to a real wallet when run in Node.js.
 *
 * @packageDocumentation
 */

import {
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
  createEthereumAdapter,
  type EthereumWalletAdapter,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SIP PROTOCOL: METAMASK INTEGRATION')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: CREATE WALLET ADAPTER
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 1: Create Ethereum wallet adapter')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Browser code to connect MetaMask:

  import { createEthereumAdapter } from '@sip-protocol/sdk'

  // Create adapter for MetaMask
  const wallet = createEthereumAdapter({
    wallet: 'metamask', // or 'coinbase', 'walletconnect', etc.
    chainId: 1,         // Ethereum mainnet
  })

  // Connect to wallet (triggers popup)
  await wallet.connect()

  console.log('Connected:', wallet.address)
  console.log('Chain ID:', wallet.getChainId())
`)

  // Simulate adapter for demo
  const mockAdapter = {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0aB12',
    chainId: 1,
  }

  console.log('Simulated connection:')
  console.log(`  Address:  ${mockAdapter.address}`)
  console.log(`  Chain ID: ${mockAdapter.chainId} (Ethereum Mainnet)`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: SEND TO STEALTH ADDRESS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 2: Send ETH to stealth address')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate recipient's stealth address
  const recipient = generateStealthMetaAddress('ethereum', 'Recipient')
  const { stealthAddress } = generateStealthAddress(recipient.metaAddress)
  const ethStealthAddress = publicKeyToEthAddress(stealthAddress.address)

  console.log(`
Using the wallet adapter to send ETH:

  import {
    generateStealthAddress,
    publicKeyToEthAddress,
  } from '@sip-protocol/sdk'

  // Recipient's meta-address (from ENS, profile, etc.)
  const recipientMetaAddress = parseStealthMetaAddress(recipientInput)

  // Generate stealth address
  const { stealthAddress } = generateStealthAddress(recipientMetaAddress)
  const ethAddress = publicKeyToEthAddress(stealthAddress.address)

  // Send using wallet adapter
  const receipt = await wallet.signAndSendTransaction({
    data: {
      to: ethAddress,
      value: '0x' + (0.1e18).toString(16), // 0.1 ETH
    },
  })

  console.log('Transaction sent:', receipt.txHash)
`)

  console.log(`Stealth Address: ${ethStealthAddress}`)
  console.log('')

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SIGN MESSAGE FOR VIEWING KEY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 3: Sign message for viewing key derivation')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Deriving viewing key from signature (optional advanced pattern):

  // Message to sign for deterministic key derivation
  const message = 'SIP Protocol: Derive viewing key for address ' + wallet.address

  // Sign with wallet
  const { signature } = await wallet.signMessage(
    new TextEncoder().encode(message)
  )

  // Derive viewing key from signature (deterministic)
  const viewingKey = keccak256(signature)

  console.log('Derived viewing key:', viewingKey)

Note: This pattern allows recovering viewing key from wallet signature.
More common: store viewing key securely after initial generation.
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: HANDLE WALLET EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 4: Handle wallet events')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Setting up event listeners:

  // Account changed (user switched accounts in MetaMask)
  wallet.on('accountChanged', (event) => {
    console.log('Account changed:', event.previousAddress, '->', event.newAddress)
    // Re-initialize app state for new account
  })

  // Chain changed (user switched networks)
  wallet.on('chainChanged', (event) => {
    console.log('Chain changed:', event.previousChain, '->', event.newChain)
    // May need to reload page or reinitialize
  })

  // Disconnected
  wallet.on('disconnected', (event) => {
    console.log('Wallet disconnected:', event.error || 'user initiated')
    // Clean up state, show connect button
  })
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: SWITCH CHAIN
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 5: Switch to different network')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Switching to Arbitrum:

  try {
    await wallet.switchChain(42161) // Arbitrum One
    console.log('Switched to Arbitrum')
  } catch (error) {
    if (error.code === 'UNSUPPORTED_CHAIN') {
      // Chain not added to wallet, prompt user to add it
      console.log('Please add Arbitrum to your wallet')
    }
  }

Supported chain IDs:
  - Ethereum Mainnet: 1
  - Ethereum Sepolia: 11155111
  - Polygon: 137
  - Arbitrum One: 42161
  - Optimism: 10
  - Base: 8453
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: FULL REACT COMPONENT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 6: Full React component example')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
import { useState, useCallback, useEffect } from 'react'
import {
  createEthereumAdapter,
  generateStealthMetaAddress,
  generateStealthAddress,
  publicKeyToEthAddress,
} from '@sip-protocol/sdk'

function StealthTransfer() {
  const [wallet, setWallet] = useState(null)
  const [recipientInput, setRecipientInput] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('disconnected')
  const [txHash, setTxHash] = useState(null)

  // Connect wallet
  const connect = useCallback(async () => {
    try {
      setStatus('connecting')
      const adapter = createEthereumAdapter({ wallet: 'metamask' })
      await adapter.connect()
      setWallet(adapter)
      setStatus('connected')
    } catch (error) {
      setStatus('error')
      console.error('Failed to connect:', error)
    }
  }, [])

  // Send to stealth address
  const sendPrivate = useCallback(async () => {
    if (!wallet || !recipientInput || !amount) return

    try {
      setStatus('sending')

      // Parse recipient's meta-address
      const recipientMeta = parseStealthMetaAddress(recipientInput)

      // Generate one-time stealth address
      const { stealthAddress } = generateStealthAddress(recipientMeta)
      const ethAddress = publicKeyToEthAddress(stealthAddress.address)

      // Send transaction
      const receipt = await wallet.signAndSendTransaction({
        data: {
          to: ethAddress,
          value: '0x' + BigInt(parseFloat(amount) * 1e18).toString(16),
        },
      })

      setTxHash(receipt.txHash)
      setStatus('sent')

      // Emit announcement (in production)
      // await emitAnnouncement(stealthAddress, receipt.txHash)

    } catch (error) {
      setStatus('error')
      console.error('Transfer failed:', error)
    }
  }, [wallet, recipientInput, amount])

  // Set up wallet events
  useEffect(() => {
    if (!wallet) return

    const handleDisconnect = () => {
      setWallet(null)
      setStatus('disconnected')
    }

    wallet.on('disconnected', handleDisconnect)
    return () => wallet.off('disconnected', handleDisconnect)
  }, [wallet])

  return (
    <div>
      <h2>Private Transfer</h2>

      {status === 'disconnected' && (
        <button onClick={connect}>Connect MetaMask</button>
      )}

      {status === 'connected' && (
        <>
          <p>Connected: {wallet.address}</p>

          <input
            placeholder="Recipient stealth meta-address"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
          />

          <input
            placeholder="Amount (ETH)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button onClick={sendPrivate}>Send Privately</button>
        </>
      )}

      {status === 'sent' && txHash && (
        <p>
          Sent! <a href={\`https://etherscan.io/tx/\${txHash}\`}>View on Etherscan</a>
        </p>
      )}
    </div>
  )
}
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: OTHER WALLET TYPES
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('STEP 7: Support for other wallets')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log(`
Supported wallet types:

  // MetaMask
  const metamask = createEthereumAdapter({ wallet: 'metamask' })

  // Coinbase Wallet
  const coinbase = createEthereumAdapter({ wallet: 'coinbase' })

  // WalletConnect (for mobile wallets)
  const walletConnect = createEthereumAdapter({
    wallet: 'walletconnect',
    // WalletConnect requires additional config
  })

  // Injected (any EIP-1193 provider)
  const injected = createEthereumAdapter({
    wallet: 'injected',
    provider: window.ethereum, // Or any EIP-1193 provider
  })

  // Custom RPC (for programmatic use)
  const custom = createEthereumAdapter({
    wallet: 'metamask',
    rpcEndpoint: 'https://eth.llamarpc.com',
  })
`)

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('MetaMask integration:')
  console.log('  ✓ EIP-1193 standard support')
  console.log('  ✓ Account/chain change events')
  console.log('  ✓ Transaction signing')
  console.log('  ✓ Message signing (EIP-191)')
  console.log('  ✓ Typed data signing (EIP-712)')
  console.log('')
  console.log('Supported wallets:')
  console.log('  - MetaMask')
  console.log('  - Coinbase Wallet')
  console.log('  - WalletConnect')
  console.log('  - Any EIP-1193 provider')
  console.log('')
  console.log('Next steps:')
  console.log('  1. See 06-viewing-key-disclosure.ts for compliance')
  console.log('  2. See @sip-protocol/react for React hooks')
  console.log('')
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
