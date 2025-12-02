/**
 * Zcash Connection Example
 *
 * Demonstrates connecting to a zcashd node and performing shielded operations.
 *
 * Prerequisites:
 * 1. Running zcashd node (testnet recommended)
 * 2. RPC credentials configured in zcash.conf
 *
 * Usage:
 *   ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass npx ts-node examples/zcash-connection/index.ts
 *
 * See docs/guides/ZCASH-TESTNET.md for full setup instructions.
 */

import {
  ZcashRPCClient,
  ZcashRPCError,
  ZcashShieldedService,
  PrivacyLevel,
} from '@sip-protocol/sdk'

// ─── Configuration ─────────────────────────────────────────────────────────────

function getConfig() {
  const username = process.env.ZCASH_RPC_USER
  const password = process.env.ZCASH_RPC_PASS

  if (!username || !password) {
    console.error('Error: ZCASH_RPC_USER and ZCASH_RPC_PASS environment variables required')
    console.error('')
    console.error('Usage:')
    console.error('  ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass npx ts-node examples/zcash-connection/index.ts')
    console.error('')
    console.error('See docs/guides/ZCASH-TESTNET.md for setup instructions.')
    process.exit(1)
  }

  return {
    host: process.env.ZCASH_RPC_HOST || '127.0.0.1',
    port: parseInt(process.env.ZCASH_RPC_PORT || '18232', 10),
    username,
    password,
    testnet: process.env.ZCASH_TESTNET !== 'false', // Default to testnet for safety
    timeout: 30000,
    retries: 3,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function zatToZec(zat: number | undefined): string {
  return ((zat ?? 0) / 100_000_000).toFixed(8)
}

function truncateAddress(addr: string, chars: number = 20): string {
  if (addr.length <= chars * 2) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

// ─── Part 1: Low-Level RPC Client ──────────────────────────────────────────────

async function demonstrateRPCClient() {
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(' PART 1: ZcashRPCClient (Low-Level API)')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('')

  const config = getConfig()
  const client = new ZcashRPCClient(config)

  console.log(`Connecting to ${config.host}:${config.port} (${config.testnet ? 'testnet' : 'mainnet'})...`)
  console.log('')

  // ─── 1. Connection Check ───────────────────────────────────────────────────
  console.log('1. Checking connection...')
  try {
    const info = await client.getBlockchainInfo()
    console.log(`   ✓ Chain: ${info.chain}`)
    console.log(`   ✓ Blocks: ${info.blocks.toLocaleString()}`)
    console.log(`   ✓ Difficulty: ${info.difficulty.toFixed(2)}`)
    console.log(`   ✓ Sync Progress: ${(info.verificationprogress * 100).toFixed(2)}%`)

    if (info.verificationprogress < 0.99) {
      console.log('')
      console.log('   ⚠️  Node is still syncing. Some operations may fail.')
    }
  } catch (error) {
    handleConnectionError(error)
    throw error
  }

  // ─── 2. Network Info ───────────────────────────────────────────────────────
  console.log('')
  console.log('2. Getting network info...')
  const networkInfo = await client.getNetworkInfo()
  console.log(`   ✓ Version: ${networkInfo.version}`)
  console.log(`   ✓ Subversion: ${networkInfo.subversion}`)
  console.log(`   ✓ Protocol: ${networkInfo.protocolversion}`)
  console.log(`   ✓ Connections: ${networkInfo.connections}`)

  // ─── 3. Address Management ─────────────────────────────────────────────────
  console.log('')
  console.log('3. Managing addresses...')

  let accountId = 0
  let primaryAddress: string

  // List existing addresses
  const existingAddresses = await client.listAddresses()
  console.log(`   ✓ Found ${existingAddresses.length} existing address(es)`)

  // Get or create account address
  try {
    const addressInfo = await client.getAddressForAccount(accountId, ['sapling', 'orchard'])
    primaryAddress = addressInfo.address
    console.log(`   ✓ Account ${accountId} address: ${truncateAddress(primaryAddress)}`)
  } catch {
    // Account doesn't exist, create it
    console.log('   Creating new account...')
    const newAccount = await client.createAccount()
    accountId = newAccount.account
    const addressInfo = await client.getAddressForAccount(accountId, ['sapling', 'orchard'])
    primaryAddress = addressInfo.address
    console.log(`   ✓ Created account ${accountId}: ${truncateAddress(primaryAddress)}`)
  }

  // Validate the address
  const validation = await client.validateAddress(primaryAddress)
  console.log(`   ✓ Address type: ${validation.address_type}`)
  console.log(`   ✓ Is mine: ${validation.ismine ?? 'N/A'}`)

  // ─── 4. Balance Check ──────────────────────────────────────────────────────
  console.log('')
  console.log('4. Checking balance...')
  const balance = await client.getAccountBalance(accountId)
  const transparent = balance.pools.transparent?.valueZat ?? 0
  const sapling = balance.pools.sapling?.valueZat ?? 0
  const orchard = balance.pools.orchard?.valueZat ?? 0
  const total = transparent + sapling + orchard

  console.log(`   ├─ Transparent: ${zatToZec(transparent)} ZEC`)
  console.log(`   ├─ Sapling:     ${zatToZec(sapling)} ZEC`)
  console.log(`   ├─ Orchard:     ${zatToZec(orchard)} ZEC`)
  console.log(`   └─ Total:       ${zatToZec(total)} ZEC`)

  // Get total wallet balance for comparison
  const totalBalance = await client.getTotalBalance()
  console.log('')
  console.log('   Wallet totals:')
  console.log(`   ├─ Transparent: ${totalBalance.transparent} ZEC`)
  console.log(`   ├─ Private:     ${totalBalance.private} ZEC`)
  console.log(`   └─ Total:       ${totalBalance.total} ZEC`)

  // ─── 5. Unspent Notes ──────────────────────────────────────────────────────
  console.log('')
  console.log('5. Listing unspent notes...')
  const notes = await client.listUnspent()
  const spendableNotes = notes.filter((n) => n.spendable)
  console.log(`   ✓ Total notes: ${notes.length}`)
  console.log(`   ✓ Spendable notes: ${spendableNotes.length}`)

  if (notes.length > 0) {
    console.log('')
    console.log('   Recent notes:')
    notes.slice(0, 3).forEach((note, i) => {
      console.log(`   ${i + 1}. ${zatToZec(note.amount * 100_000_000)} ZEC in ${note.pool} (${note.confirmations} conf)`)
    })
  }

  // ─── 6. Viewing Key Export ─────────────────────────────────────────────────
  console.log('')
  console.log('6. Exporting viewing key (for compliance)...')
  try {
    const viewingKey = await client.exportViewingKey(primaryAddress)
    console.log(`   ✓ Viewing key: ${viewingKey.slice(0, 30)}...`)
    console.log('   ℹ️  This key allows monitoring transactions without spending')
  } catch (error) {
    if (error instanceof ZcashRPCError) {
      console.log(`   ⚠️  Could not export viewing key: ${error.message}`)
    }
  }

  // ─── 7. Block Info ─────────────────────────────────────────────────────────
  console.log('')
  console.log('7. Getting recent block...')
  const height = await client.getBlockCount()
  const blockHeader = await client.getBlockHeader(height)
  console.log(`   ✓ Block #${height}`)
  console.log(`   ✓ Hash: ${blockHeader.hash.slice(0, 20)}...`)
  console.log(`   ✓ Time: ${new Date(blockHeader.time * 1000).toISOString()}`)
  console.log(`   ✓ Txs: ${blockHeader.nTx}`)

  // ─── 8. Shielded Send (if balance available) ───────────────────────────────
  if (total > 10000) {
    // > 0.0001 ZEC
    console.log('')
    console.log('8. Shielded send demonstration...')
    console.log('   ⚠️  Skipping actual send - uncomment code to test')

    // Uncomment to test actual shielded send:
    /*
    const recipientAddress = primaryAddress // Self-send for testing
    const sendAmount = 0.0001 // Minimum viable amount

    console.log(`   Sending ${sendAmount} ZEC to self...`)
    const operationId = await client.sendShielded({
      fromAddress: primaryAddress,
      recipients: [{
        address: recipientAddress,
        amount: sendAmount,
        memo: 'SIP Protocol test transaction',
      }],
      minConf: 1,
    })
    console.log(`   ✓ Operation ID: ${operationId}`)
    console.log('   Waiting for confirmation...')

    const result = await client.waitForOperation(operationId, 2000, 120000)
    console.log(`   ✓ Transaction ID: ${result.result?.txid}`)
    */
  } else {
    console.log('')
    console.log('8. Shielded send demonstration...')
    console.log('   ⚠️  Insufficient balance for send test')
    console.log('   ℹ️  Get testnet TAZ from: https://faucet.zecpages.com/')
  }

  return { client, primaryAddress, accountId }
}

// ─── Part 2: High-Level Shielded Service ───────────────────────────────────────

async function demonstrateShieldedService() {
  console.log('')
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(' PART 2: ZcashShieldedService (High-Level API)')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('')

  const config = getConfig()

  const service = new ZcashShieldedService({
    rpcConfig: config,
    defaultAccount: 0,
    defaultMinConf: 1,
    operationPollInterval: 1000,
    operationTimeout: 300000,
  })

  // ─── Initialize Service ────────────────────────────────────────────────────
  console.log('1. Initializing service...')
  await service.initialize()
  console.log('   ✓ Service initialized')
  console.log(`   ✓ Network: ${service.isTestnet() ? 'testnet' : 'mainnet'}`)
  console.log(`   ✓ Account: ${service.currentAccount}`)

  // ─── Get Address ───────────────────────────────────────────────────────────
  console.log('')
  console.log('2. Getting addresses...')
  const address = service.getAddress()
  console.log(`   ✓ Primary: ${truncateAddress(address)}`)

  const newAddress = await service.generateNewAddress()
  console.log(`   ✓ Diversified: ${truncateAddress(newAddress)}`)
  console.log('   ℹ️  Different addresses, same account (unlinkable)')

  // ─── Balance with Privacy Pools ────────────────────────────────────────────
  console.log('')
  console.log('3. Getting balance summary...')
  const balance = await service.getBalance()
  console.log(`   ├─ Confirmed:   ${balance.confirmed.toFixed(8)} ZEC`)
  console.log(`   ├─ Unconfirmed: ${balance.unconfirmed.toFixed(8)} ZEC`)
  console.log(`   ├─ Transparent: ${balance.pools.transparent.toFixed(8)} ZEC`)
  console.log(`   ├─ Sapling:     ${balance.pools.sapling.toFixed(8)} ZEC`)
  console.log(`   ├─ Orchard:     ${balance.pools.orchard.toFixed(8)} ZEC`)
  console.log(`   └─ Spendable Notes: ${balance.spendableNotes}`)

  // ─── Fee Estimation ────────────────────────────────────────────────────────
  console.log('')
  console.log('4. Fee estimation (ZIP-317)...')
  const minFee = service.getMinimumFee()
  const singleRecipientFee = service.estimateFee(1)
  const multiRecipientFee = service.estimateFee(5, 2)
  console.log(`   ├─ Minimum fee:        ${minFee.toFixed(8)} ZEC`)
  console.log(`   ├─ Single recipient:   ${singleRecipientFee.toFixed(8)} ZEC`)
  console.log(`   └─ 5 recipients, 2 in: ${multiRecipientFee.toFixed(8)} ZEC`)

  // ─── Address Validation ────────────────────────────────────────────────────
  console.log('')
  console.log('5. Address validation...')
  const isShielded = await service.isShieldedAddress(address)
  console.log(`   ✓ Is shielded: ${isShielded}`)

  // Validate different address types
  const testAddresses = [
    { type: 'unified', addr: address },
    { type: 'transparent', addr: 't1exampleaddress123456789' }, // Example
  ]

  for (const { type, addr } of testAddresses) {
    try {
      const info = await service.validateAddress(addr)
      console.log(`   ✓ ${type}: ${info.isvalid ? 'valid' : 'invalid'}`)
    } catch {
      console.log(`   ✗ ${type}: validation failed`)
    }
  }

  // ─── Compliance Export ─────────────────────────────────────────────────────
  console.log('')
  console.log('6. Compliance export (viewing key)...')
  try {
    const compliance = await service.exportForCompliance()
    console.log(`   ✓ Privacy level: ${compliance.privacyLevel}`)
    console.log(`   ✓ Viewing key: ${compliance.viewingKey.key.slice(0, 30)}...`)
    console.log(`   ✓ Account: ${compliance.viewingKey.account}`)
    console.log('')
    console.log('   Disclaimer:')
    console.log(`   "${compliance.disclaimer}"`)
  } catch (error) {
    if (error instanceof ZcashRPCError) {
      console.log(`   ⚠️  Could not export: ${error.message}`)
    }
  }

  // ─── Received Notes ────────────────────────────────────────────────────────
  console.log('')
  console.log('7. Checking received notes...')
  const receivedNotes = await service.getReceivedNotes()
  console.log(`   ✓ Total received: ${receivedNotes.length} notes`)

  if (receivedNotes.length > 0) {
    console.log('')
    console.log('   Recent received:')
    receivedNotes.slice(0, 3).forEach((note, i) => {
      console.log(`   ${i + 1}. ${note.amount.toFixed(8)} ZEC in ${note.pool}`)
      console.log(`      Confirmations: ${note.confirmations}, Spendable: ${note.spendable}`)
      if (note.memo) {
        console.log(`      Memo: "${note.memo.slice(0, 50)}${note.memo.length > 50 ? '...' : ''}"`)
      }
    })
  }

  // ─── Pending Operations ────────────────────────────────────────────────────
  console.log('')
  console.log('8. Checking pending operations...')
  const pendingOps = await service.listPendingOperations()
  console.log(`   ✓ Pending operations: ${pendingOps.length}`)

  // ─── Send with Privacy Level (demonstration) ───────────────────────────────
  console.log('')
  console.log('9. Send with SIP Privacy Levels...')
  console.log('')
  console.log('   Available privacy levels:')
  console.log(`   • ${PrivacyLevel.TRANSPARENT} - No privacy (not supported for shielded service)`)
  console.log(`   • ${PrivacyLevel.SHIELDED}    - Full privacy`)
  console.log(`   • ${PrivacyLevel.COMPLIANT}   - Privacy + viewing key for auditors`)
  console.log('')
  console.log('   Example code:')
  console.log('   ```')
  console.log('   await service.sendWithPrivacy(')
  console.log("     recipientAddress,")
  console.log('     1.5,')
  console.log('     PrivacyLevel.SHIELDED,')
  console.log("     'Payment memo'")
  console.log('   )')
  console.log('   ```')

  return service
}

// ─── Error Handling ────────────────────────────────────────────────────────────

function handleConnectionError(error: unknown) {
  console.error('')
  console.error('Connection failed!')
  console.error('')

  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Error: Cannot connect to zcashd. Is it running?')
      console.error('')
      console.error('Start zcashd with:')
      console.error('  zcashd -testnet')
      console.error('')
      console.error('Or check your zcash.conf and ensure:')
      console.error('  server=1')
      console.error('  rpcuser=<your_user>')
      console.error('  rpcpassword=<your_password>')
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.error('Error: Authentication failed. Check RPC credentials.')
      console.error('')
      console.error('Verify environment variables match zcash.conf:')
      console.error('  ZCASH_RPC_USER=<rpcuser from zcash.conf>')
      console.error('  ZCASH_RPC_PASS=<rpcpassword from zcash.conf>')
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('Error: Connection timed out.')
      console.error('')
      console.error('Possible causes:')
      console.error('  • zcashd is still starting up')
      console.error('  • Firewall blocking port')
      console.error('  • Wrong host/port configuration')
    } else {
      console.error(`Error: ${error.message}`)
    }
  }

  console.error('')
  console.error('See docs/guides/ZCASH-TESTNET.md for complete setup instructions.')
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════════════╗')
  console.log('║              SIP Protocol - Zcash Connection Example              ║')
  console.log('╚═══════════════════════════════════════════════════════════════════╝')

  try {
    // Part 1: Low-level RPC client
    await demonstrateRPCClient()

    // Part 2: High-level shielded service
    await demonstrateShieldedService()

    // Summary
    console.log('')
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════════')
    console.log(' SUCCESS!')
    console.log('═══════════════════════════════════════════════════════════════════')
    console.log('')
    console.log('Your zcashd node is ready for SIP Protocol integration.')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Get testnet TAZ: https://faucet.zecpages.com/')
    console.log('  2. Try a shielded transaction')
    console.log('  3. Export viewing keys for compliance')
    console.log('  4. Integrate with SIP Protocol for cross-chain privacy')
    console.log('')
    console.log('Documentation:')
    console.log('  • Setup guide: docs/guides/ZCASH-TESTNET.md')
    console.log('  • Zcash RPC: https://zcash.github.io/rpc/')
    console.log('  • SIP Protocol: https://docs.sip-protocol.org')
    console.log('')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ECONNREFUSED')) {
      // Error not already handled
      console.error('')
      console.error('Unexpected error:', error)
    }
    process.exit(1)
  }
}

main()
