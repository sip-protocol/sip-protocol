/**
 * Wallet Integration Example
 *
 * Demonstrates connecting to various wallets and signing transactions.
 * Uses mock adapters for demonstration - see README for browser-based examples.
 *
 * Flow:
 * 1. Create wallet adapter (Solana, Ethereum, or Hardware)
 * 2. Connect to wallet
 * 3. Get address and sign messages
 * 4. Execute shielded transactions
 *
 * Usage:
 *   npx ts-node examples/wallet-integration/index.ts
 */

import {
  // Mock wallet adapters (for testing/examples)
  createMockSolanaAdapter,
  createMockEthereumAdapter,
  createMockLedgerAdapter,
  // Wallet utilities
  WalletError,
  WalletErrorCode,
  // Stealth addresses
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  generateStealthAddress,
  generateEd25519StealthAddress,
  publicKeyToEthAddress,
  ed25519PublicKeyToSolanaAddress,
  // Types
  type HexString,
} from '@sip-protocol/sdk'

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Wallet Integration Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('This example uses mock wallets for demonstration.')
  console.log('See README.md for real wallet integration examples.')
  console.log('')

  // Run all wallet examples
  await demonstrateSolanaWallet()
  await demonstrateEthereumWallet()
  await demonstrateHardwareWallet()

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('All wallet demonstrations complete!')
  console.log('')
}

// ─── Solana Wallet Example ────────────────────────────────────────────────────

async function demonstrateSolanaWallet() {
  console.log('SOLANA WALLET (Mock Phantom)')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create mock Solana adapter
  const wallet = createMockSolanaAdapter({
    address: 'So11111111111111111111111111111111111111112',
    autoConnect: false,
  })

  console.log('1. Creating wallet adapter...')
  console.log(`   Provider: Phantom (mock)`)
  console.log(`   Chain: solana`)
  console.log('')

  // Connect
  console.log('2. Connecting to wallet...')
  try {
    await wallet.connect()
    console.log('   ✓ Connected successfully')
  } catch (error) {
    handleWalletError(error)
    return
  }

  // Get address
  const address = await wallet.getAddress()
  const publicKey = await wallet.getPublicKey()
  console.log(`   Address: ${truncate(address, 12)}`)
  console.log(`   Public Key: ${truncate(publicKey, 10)}`)
  console.log('')

  // Sign message
  console.log('3. Signing message...')
  const message = new TextEncoder().encode('SIP Protocol: Verify wallet ownership')

  try {
    const signature = await wallet.signMessage(message)
    console.log(`   ✓ Message signed`)
    console.log(`   Signature: ${truncate(signature.value, 16)}`)
  } catch (error) {
    handleWalletError(error)
  }
  console.log('')

  // Generate stealth address for receiving
  console.log('4. Generating stealth address for private receive...')
  const { metaAddress } = generateEd25519StealthMetaAddress('solana', 'My Wallet')
  const { stealthAddress } = generateEd25519StealthAddress(metaAddress)
  const solanaAddress = ed25519PublicKeyToSolanaAddress(stealthAddress.address)

  console.log(`   Meta-Address Spending Key: ${truncate(metaAddress.spendingKey, 8)}`)
  console.log(`   Stealth Solana Address: ${truncate(solanaAddress, 12)}`)
  console.log('')

  // Disconnect
  console.log('5. Disconnecting...')
  await wallet.disconnect()
  console.log(`   ✓ Disconnected`)
  console.log('')
}

// ─── Ethereum Wallet Example ──────────────────────────────────────────────────

async function demonstrateEthereumWallet() {
  console.log('ETHEREUM WALLET (Mock MetaMask)')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create mock Ethereum adapter
  const wallet = createMockEthereumAdapter({
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
    autoConnect: false,
  })

  console.log('1. Creating wallet adapter...')
  console.log(`   Provider: MetaMask (mock)`)
  console.log(`   Chain ID: 1 (Ethereum Mainnet)`)
  console.log('')

  // Connect
  console.log('2. Connecting to wallet...')
  try {
    await wallet.connect()
    console.log('   ✓ Connected successfully')
  } catch (error) {
    handleWalletError(error)
    return
  }

  // Get address
  const address = await wallet.getAddress()
  const publicKey = await wallet.getPublicKey()
  console.log(`   Address: ${address}`)
  console.log(`   Public Key: ${truncate(publicKey, 10)}`)
  console.log('')

  // Sign message
  console.log('3. Signing message (personal_sign)...')
  const message = new TextEncoder().encode('SIP Protocol: Verify wallet ownership')

  try {
    const signature = await wallet.signMessage(message)
    console.log(`   ✓ Message signed`)
    console.log(`   Signature: ${truncate(signature.value, 16)}`)
  } catch (error) {
    handleWalletError(error)
  }
  console.log('')

  // Generate stealth address for receiving
  console.log('4. Generating stealth address for private receive...')
  const { metaAddress } = generateStealthMetaAddress('ethereum', 'My ETH Wallet')
  const { stealthAddress } = generateStealthAddress(metaAddress)
  const ethAddress = publicKeyToEthAddress(stealthAddress.address)

  console.log(`   Meta-Address Spending Key: ${truncate(metaAddress.spendingKey, 8)}`)
  console.log(`   Stealth ETH Address: ${ethAddress}`)
  console.log('')

  // Simulate chain switch
  console.log('5. Switching to Polygon...')
  // In real implementation, would call wallet.switchChain(137)
  console.log('   ✓ Switched to chain 137 (Polygon)')
  console.log('')

  // Disconnect
  console.log('6. Disconnecting...')
  await wallet.disconnect()
  console.log(`   ✓ Disconnected`)
  console.log('')
}

// ─── Hardware Wallet Example ──────────────────────────────────────────────────

async function demonstrateHardwareWallet() {
  console.log('HARDWARE WALLET (Mock Ledger)')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create mock Ledger adapter
  const wallet = createMockLedgerAdapter({
    model: 'Nano X',
    chain: 'ethereum',
    autoApprove: true, // Auto-approve for testing
  })

  console.log('1. Creating wallet adapter...')
  console.log(`   Device: Ledger Nano X (mock)`)
  console.log(`   Transport: WebUSB`)
  console.log(`   Derivation: m/44'/60'/0'/0/0`)
  console.log('')

  // Connect
  console.log('2. Connecting to Ledger...')
  console.log('   (In real usage: "Please connect your Ledger and open the Ethereum app")')
  try {
    await wallet.connect()
    console.log('   ✓ Connected successfully')
  } catch (error) {
    handleWalletError(error)
    return
  }

  // Get address
  const address = await wallet.getAddress()
  console.log(`   Address: ${address}`)
  console.log('')

  // Sign message
  console.log('3. Signing message...')
  console.log('   (In real usage: "Please verify and sign on your Ledger")')
  const message = new TextEncoder().encode('SIP Protocol: Verify ownership')

  try {
    const signature = await wallet.signMessage(message)
    console.log(`   ✓ Message signed on device`)
    console.log(`   Signature: ${truncate(signature.value, 16)}`)
  } catch (error) {
    handleWalletError(error)
  }
  console.log('')

  // Sign transaction
  console.log('4. Signing transaction...')
  console.log('   (In real usage: "Review transaction on your Ledger")')

  const tx = {
    to: '0xabcdef1234567890abcdef1234567890abcdef12' as HexString,
    value: 1000000000000000000n, // 1 ETH
    data: '0x' as HexString,
    gasLimit: 21000n,
    maxFeePerGas: 30000000000n,
    maxPriorityFeePerGas: 1500000000n,
    nonce: 0,
    chainId: 1,
  }

  try {
    const signedTx = await wallet.signTransaction(tx)
    console.log(`   ✓ Transaction signed`)
    console.log(`   Signed TX: ${truncate(signedTx.raw, 20)}`)
  } catch (error) {
    handleWalletError(error)
  }
  console.log('')

  // Get multiple accounts
  console.log('5. Getting derived accounts...')
  console.log('   Account 0: 0x1234...5678 (current)')
  console.log('   Account 1: 0xabcd...ef01')
  console.log('   Account 2: 0x9876...5432')
  console.log('')

  // Disconnect
  console.log('6. Disconnecting...')
  await wallet.disconnect()
  console.log(`   ✓ Disconnected`)
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(value: string, chars: number = 8): string {
  if (value.length <= chars * 2 + 4) return value
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`
}

function handleWalletError(error: unknown) {
  if (error instanceof WalletError) {
    switch (error.code) {
      case WalletErrorCode.NOT_INSTALLED:
        console.log('   ✗ Wallet not installed')
        break
      case WalletErrorCode.USER_REJECTED:
        console.log('   ✗ User rejected the request')
        break
      case WalletErrorCode.NOT_CONNECTED:
        console.log('   ✗ Wallet not connected')
        break
      case WalletErrorCode.CHAIN_NOT_SUPPORTED:
        console.log('   ✗ Chain not supported by wallet')
        break
      default:
        console.log(`   ✗ Wallet error: ${error.message}`)
    }
  } else {
    console.log(`   ✗ Error: ${(error as Error).message}`)
  }
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
