# Zcash Connection Example

Connect to a real zcashd node and perform shielded operations.

## Overview

This example demonstrates:

1. **RPC Client** - Low-level connection to zcashd
2. **Shielded Service** - High-level privacy operations
3. **Address Management** - Unified addresses, diversified addresses
4. **Shielded Transactions** - Send and receive with privacy
5. **Viewing Keys** - Export for compliance/audit

## Prerequisites

You need a running zcashd node. See [ZCASH-TESTNET.md](../../docs/guides/ZCASH-TESTNET.md) for setup instructions.

## Quick Start

```bash
# Set credentials
export ZCASH_RPC_USER=your_rpc_user
export ZCASH_RPC_PASS=your_rpc_password

# Run example (testnet by default)
npx ts-node examples/zcash-connection/index.ts

# Run with mainnet
ZCASH_TESTNET=false npx ts-node examples/zcash-connection/index.ts
```

## Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CONNECT TO ZCASHD                                                         │
│    Verify node is running and synced                                        │
│                                                                              │
│    client = new ZcashRPCClient({ username, password, testnet: true })       │
│    info = await client.getBlockchainInfo()                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. MANAGE ADDRESSES                                                          │
│    Create unified addresses for receiving                                   │
│                                                                              │
│    account = await client.createAccount()                                   │
│    address = await client.getAddressForAccount(account.account)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. CHECK BALANCE                                                             │
│    View balance across all pools                                            │
│                                                                              │
│    balance = await client.getAccountBalance(account)                        │
│    // { transparent: X, sapling: Y, orchard: Z }                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SEND SHIELDED (if balance > 0)                                            │
│    Private transaction with memo                                            │
│                                                                              │
│    opId = await client.sendShielded({                                       │
│      fromAddress, recipients: [{ address, amount, memo }]                   │
│    })                                                                        │
│    result = await client.waitForOperation(opId)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. EXPORT VIEWING KEY (for compliance)                                       │
│    Allow auditors to view transactions without spending                     │
│                                                                              │
│    viewingKey = await client.exportViewingKey(address)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Reference

### ZcashRPCClient (Low-Level)

```typescript
import { ZcashRPCClient } from '@sip-protocol/sdk'

const client = new ZcashRPCClient({
  host: '127.0.0.1',       // Default: 127.0.0.1
  port: 18232,             // Default: 8232 (mainnet), 18232 (testnet)
  username: 'rpcuser',     // Required
  password: 'rpcpass',     // Required
  testnet: true,           // Default: false
  timeout: 30000,          // Default: 30000ms
  retries: 3,              // Default: 3
})

// Connection
await client.getBlockchainInfo()
await client.getNetworkInfo()
await client.getBlockCount()

// Addresses
await client.createAccount()
await client.getAddressForAccount(accountId, ['sapling', 'orchard'])
await client.validateAddress(address)

// Balance
await client.getAccountBalance(accountId)
await client.getTotalBalance()

// Transactions
await client.sendShielded({ fromAddress, recipients, fee, privacyPolicy })
await client.waitForOperation(operationId)
await client.listUnspent()

// Keys
await client.exportViewingKey(address)
await client.importViewingKey(viewingKey)
```

### ZcashShieldedService (High-Level)

```typescript
import { ZcashShieldedService, PrivacyLevel } from '@sip-protocol/sdk'

const service = new ZcashShieldedService({
  rpcConfig: { username, password, testnet: true },
  defaultAccount: 0,
  operationTimeout: 300000,
})

await service.initialize()

// Get address
const address = service.getAddress()
const newAddr = await service.generateNewAddress()

// Balance
const balance = await service.getBalance()
// { confirmed, unconfirmed, pools: { transparent, sapling, orchard } }

// Send with SIP privacy levels
await service.sendShielded({
  to: recipientAddress,
  amount: 1.5,
  memo: 'Payment',
  privacyLevel: PrivacyLevel.SHIELDED,
})

// Compliance export
const { viewingKey, disclaimer } = await service.exportForCompliance()
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ZCASH_RPC_USER` | - | RPC username (required) |
| `ZCASH_RPC_PASS` | - | RPC password (required) |
| `ZCASH_RPC_HOST` | `127.0.0.1` | Node hostname |
| `ZCASH_RPC_PORT` | `18232` | RPC port (18232 testnet, 8232 mainnet) |
| `ZCASH_TESTNET` | `true` | Use testnet (safer for testing) |

## Error Handling

```typescript
import { ZcashRPCError } from '@sip-protocol/sdk'

try {
  await client.sendShielded(...)
} catch (error) {
  if (error instanceof ZcashRPCError) {
    if (error.isInsufficientFunds()) {
      console.log('Not enough ZEC')
    } else if (error.isWalletLocked()) {
      console.log('Unlock wallet with walletpassphrase')
    } else if (error.isInvalidAddress()) {
      console.log('Invalid recipient address')
    }
  }
}
```

## Security Notes

1. **Never commit credentials** - Use environment variables
2. **Use HTTPS in production** - HTTP Basic Auth sends cleartext
3. **Restrict RPC access** - Bind to localhost or use firewall
4. **Backup wallet.dat** - Contains all keys
5. **Use viewing keys for monitoring** - Don't share spending keys

## Fee Estimation (ZIP-317)

```typescript
// The service uses ZIP-317 conventional fees
const fee = service.estimateFee(recipients, inputs)
// fee = marginal_fee * max(grace_actions, logical_actions)
// Default: 0.0001 ZEC for simple transactions
```

## Related

- [ZCASH-TESTNET.md](../../docs/guides/ZCASH-TESTNET.md) - Full testnet setup guide
- [Zcash RPC Reference](https://zcash.github.io/rpc/)
- [ZIP-317 Fee Specification](https://zips.z.cash/zip-0317)
