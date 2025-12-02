/**
 * Zcash RPC Connection Example
 *
 * Demonstrates connecting to a zcashd node and performing basic operations.
 *
 * Prerequisites:
 * 1. Running zcashd node (testnet or mainnet)
 * 2. RPC credentials configured
 *
 * Usage:
 *   ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass npx ts-node examples/zcash-connection.ts
 *
 * See docs/guides/ZCASH-TESTNET.md for full setup instructions.
 */

import { ZcashRPCClient } from '@sip-protocol/sdk'

async function main() {
  // ─── Validate Credentials ─────────────────────────────────────────────────────
  const username = process.env.ZCASH_RPC_USER
  const password = process.env.ZCASH_RPC_PASS

  if (!username || !password) {
    console.error('Error: ZCASH_RPC_USER and ZCASH_RPC_PASS environment variables required')
    console.error('')
    console.error('Usage:')
    console.error('  ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass npx ts-node examples/zcash-connection.ts')
    process.exit(1)
  }

  // ─── Configuration ────────────────────────────────────────────────────────────
  const config = {
    host: process.env.ZCASH_RPC_HOST || '127.0.0.1',
    port: parseInt(process.env.ZCASH_RPC_PORT || '18232', 10),
    username,
    password,
    testnet: process.env.ZCASH_TESTNET !== 'false', // Default to testnet for safety
    timeout: 30000,
    retries: 3,
  }

  console.log('Zcash RPC Connection Example')
  console.log('════════════════════════════════════════════════════════════════')
  console.log(`Connecting to ${config.host}:${config.port} (${config.testnet ? 'testnet' : 'mainnet'})...`)
  console.log('')

  // ─── Create Client ────────────────────────────────────────────────────────────
  const client = new ZcashRPCClient(config)

  try {
    // ─── 1. Check Connection ────────────────────────────────────────────────────
    console.log('1. Checking connection...')
    const blockCount = await client.getBlockCount()
    console.log(`   ✓ Connected! Current block height: ${blockCount}`)

    // ─── 2. Get Blockchain Info ─────────────────────────────────────────────────
    console.log('')
    console.log('2. Getting blockchain info...')
    const info = await client.getBlockchainInfo()
    console.log(`   ✓ Chain: ${info.chain}`)
    console.log(`   ✓ Blocks: ${info.blocks}`)
    console.log(`   ✓ Difficulty: ${info.difficulty}`)
    console.log(`   ✓ Verification Progress: ${(info.verificationprogress * 100).toFixed(2)}%`)

    // ─── 3. List Existing Addresses ────────────────────────────────────────────
    console.log('')
    console.log('3. Listing addresses...')
    const addresses = await client.listAddresses()
    console.log(`   ✓ Found ${addresses.length} existing address(es)`)

    // ─── 4. Get or Create Account ───────────────────────────────────────────────
    console.log('')
    console.log('4. Getting address for account 0...')
    const accountId = 0

    // Try to get address for account 0, create if needed
    try {
      const addressInfo = await client.getAddressForAccount(accountId)
      console.log(`   ✓ Using account: ${accountId}`)
      console.log(`   ✓ Address: ${addressInfo.address.slice(0, 40)}...`)
    } catch {
      // Account might not exist, create it
      console.log('   Creating new account...')
      const newAccount = await client.createAccount()
      console.log(`   ✓ Created account: ${newAccount.account}`)
    }

    // ─── 5. Check Balance ────────────────────────────────────────────────────────
    console.log('')
    console.log('5. Checking balance...')
    const balance = await client.getAccountBalance(accountId)
    const totalZat = (balance.pools.transparent?.valueZat || 0) +
                     (balance.pools.sapling?.valueZat || 0) +
                     (balance.pools.orchard?.valueZat || 0)
    const totalZec = totalZat / 100_000_000

    console.log(`   ✓ Transparent: ${(balance.pools.transparent?.valueZat || 0) / 100_000_000} ZEC`)
    console.log(`   ✓ Sapling: ${(balance.pools.sapling?.valueZat || 0) / 100_000_000} ZEC`)
    console.log(`   ✓ Orchard: ${(balance.pools.orchard?.valueZat || 0) / 100_000_000} ZEC`)
    console.log(`   ✓ Total: ${totalZec} ZEC`)

    // ─── Summary ────────────────────────────────────────────────────────────────
    console.log('')
    console.log('════════════════════════════════════════════════════════════════')
    console.log('Connection successful! Your zcashd node is ready for SIP Protocol.')
    console.log('')
    console.log('Next steps:')
    console.log('  • Get testnet TAZ from a faucet (if on testnet)')
    console.log('  • Try a shielded transaction with client.sendShielded()')
    console.log('  • Integrate with SIP Protocol for cross-chain privacy')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('Connection failed!')
    console.error('')

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('Error: Cannot connect to zcashd. Is it running?')
        console.error('')
        console.error('Start zcashd with:')
        console.error('  zcashd -testnet -rpcuser=user -rpcpassword=pass')
      } else if (error.message.includes('401')) {
        console.error('Error: Authentication failed. Check RPC credentials.')
      } else {
        console.error(`Error: ${error.message}`)
      }
    }

    process.exit(1)
  }
}

main()
