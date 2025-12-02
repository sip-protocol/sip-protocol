# Zcash Testnet Setup Guide

This guide walks you through setting up a zcashd testnet node for development with SIP Protocol.

## Overview

SIP Protocol's `ZcashRPCClient` connects to zcashd via JSON-RPC. For development, we recommend using testnet to avoid risking real funds.

**Testnet Benefits:**
- Free TAZ (testnet ZEC) from faucets
- Same functionality as mainnet
- Safe environment for testing shielded transactions

## Prerequisites

- macOS, Linux, or Windows (WSL2)
- 10GB+ free disk space (for blockchain data)
- Basic terminal knowledge

## Installation

### macOS (Homebrew)

```bash
# Install zcashd
brew install zcash

# Verify installation
zcashd --version
```

### Linux (Ubuntu/Debian)

```bash
# Add Zcash repository
sudo apt-get install apt-transport-https wget gnupg
wget -qO - https://apt.z.cash/zcash.asc | gpg --import
gpg --export 3FE63B67F85EA808DE9B880E6DEF3BAF272766C0 | sudo apt-key add -

echo "deb [arch=amd64] https://apt.z.cash/ buster main" | sudo tee /etc/apt/sources.list.d/zcash.list

# Install
sudo apt-get update && sudo apt-get install zcash

# Fetch parameters (required, ~1.7GB download)
zcash-fetch-params
```

### Docker (Alternative)

```bash
# Pull official image
docker pull electriccoinco/zcashd

# Run testnet node
docker run -d \
  --name zcashd-testnet \
  -p 18232:18232 \
  -v zcash-data:/root/.zcash \
  electriccoinco/zcashd \
  -testnet \
  -rpcuser=siprpc \
  -rpcpassword=sippassword \
  -rpcallowip=0.0.0.0/0
```

## Configuration

### 1. Create Config Directory

```bash
# Linux/macOS
mkdir -p ~/.zcash

# Windows (WSL2)
mkdir -p /mnt/c/Users/YourUser/AppData/Roaming/Zcash
```

### 2. Create Configuration File

Create `~/.zcash/zcash.conf`:

```ini
# ─── Network ─────────────────────────────────────────────────────────────────
testnet=1

# ─── RPC Configuration ───────────────────────────────────────────────────────
# Enable RPC server
server=1

# RPC credentials (CHANGE THESE!)
rpcuser=siprpc
rpcpassword=your-secure-password-here

# Allow connections from localhost
rpcallowip=127.0.0.1

# Testnet RPC port (default: 18232)
rpcport=18232

# ─── Wallet ──────────────────────────────────────────────────────────────────
# Enable wallet functionality
disablewallet=0

# ─── Performance (optional) ──────────────────────────────────────────────────
# Reduce memory usage
dbcache=256

# Limit connections
maxconnections=16
```

### 3. Fetch Zcash Parameters

Required on first run (downloads ~1.7GB of cryptographic parameters):

```bash
zcash-fetch-params
```

## Running zcashd

### Start the Node

```bash
# Start in foreground (see logs)
zcashd -testnet

# Or start as daemon
zcashd -testnet -daemon

# Check if running
zcash-cli -testnet getblockchaininfo
```

### Monitor Sync Progress

```bash
# Watch sync progress
watch -n 5 'zcash-cli -testnet getblockchaininfo | grep -E "(blocks|verificationprogress)"'
```

Initial sync takes 1-4 hours depending on your connection.

### Stop the Node

```bash
zcash-cli -testnet stop
```

## Getting Testnet TAZ

### Faucet Options

1. **Zcash Testnet Faucet** (Official)
   - URL: https://faucet.zecpages.com/testnet
   - Requires unified address

2. **Community Faucets**
   - Check Zcash Discord for active faucets

### Generate Address for Faucet

```bash
# Create a new account
zcash-cli -testnet z_getnewaccount

# Get unified address for account 0
zcash-cli -testnet z_getaddressforaccount 0

# Copy the "address" field and paste into faucet
```

## Verify Setup with SIP Protocol

### 1. Set Environment Variables

```bash
export ZCASH_RPC_HOST=127.0.0.1
export ZCASH_RPC_PORT=18232
export ZCASH_RPC_USER=siprpc
export ZCASH_RPC_PASS=your-secure-password-here
export ZCASH_TESTNET=true
```

### 2. Run Connection Example

```bash
cd /path/to/sip-protocol
npx ts-node examples/zcash-connection.ts
```

Expected output:
```
Zcash RPC Connection Example
════════════════════════════════════════════════════════════════
Connecting to 127.0.0.1:18232 (testnet)...

1. Checking connection...
   ✓ Connected! Current block height: 2654321

2. Getting blockchain info...
   ✓ Chain: test
   ✓ Blocks: 2654321
   ...
```

### 3. Use in Your Code

```typescript
import { ZcashRPCClient } from '@sip-protocol/sdk'

const client = new ZcashRPCClient({
  host: process.env.ZCASH_RPC_HOST || '127.0.0.1',
  port: parseInt(process.env.ZCASH_RPC_PORT || '18232', 10),
  username: process.env.ZCASH_RPC_USER!,
  password: process.env.ZCASH_RPC_PASS!,
  testnet: true,
})

// Check connection
const info = await client.getBlockchainInfo()
console.log(`Connected to Zcash ${info.chain}`)

// Get balance
const balance = await client.getAccountBalance(0)
console.log(`Balance: ${balance.pools.orchard?.valueZat / 1e8} ZEC`)
```

## Common Operations

### Check Balance

```bash
# All pools
zcash-cli -testnet z_getbalanceforaccount 0

# Specific pool
zcash-cli -testnet z_getbalanceforviewingkey "your-viewing-key"
```

### Send Shielded Transaction

```bash
# Send to shielded address
zcash-cli -testnet z_sendmany "your-source-address" '[{"address":"recipient-address","amount":0.1}]'

# Check operation status
zcash-cli -testnet z_getoperationstatus
```

### Using SIP SDK

```typescript
// Send shielded transaction via SDK
const opId = await client.sendShielded({
  fromAddress: sourceAddress,
  recipients: [{ address: recipientAddress, amount: 0.1 }],
})

// Wait for completion
const result = await client.waitForOperation(opId)
console.log(`Transaction: ${result.result?.txid}`)
```

## Troubleshooting

### Connection Refused

```
Error: Cannot connect to zcashd. Is it running?
```

**Solution:** Start zcashd with `zcashd -testnet -daemon`

### Authentication Failed

```
Error: Authentication failed (401)
```

**Solution:** Check `rpcuser` and `rpcpassword` in `~/.zcash/zcash.conf` match your environment variables

### Wallet Not Found

```
Error: Wallet not found
```

**Solution:** Ensure `disablewallet=0` in config and restart zcashd

### Sync Not Complete

```
Error: Loading block index... or Verifying blocks...
```

**Solution:** Wait for initial sync to complete. Check progress with:
```bash
zcash-cli -testnet getblockchaininfo | grep verificationprogress
```

### Insufficient Funds

```
Error: Insufficient funds
```

**Solution:** Get testnet TAZ from a faucet (see above)

## Security Notes

1. **Never use testnet credentials on mainnet**
2. **Keep RPC credentials secure** - don't commit to git
3. **Use `rpcallowip=127.0.0.1`** for local development
4. **For production**, consider:
   - TLS/SSL for RPC
   - Firewall rules
   - Dedicated RPC user with limited permissions

## Resources

- [Zcash Documentation](https://zcash.readthedocs.io/)
- [zcashd RPC Reference](https://zcash.github.io/rpc/)
- [Zcash Discord](https://discord.gg/zcash) - #testnet channel
- [SIP Protocol SDK Docs](https://docs.sip-protocol.org)

## Next Steps

After setup:
1. Run the connection example to verify
2. Get testnet TAZ from a faucet
3. Try shielded transactions via SDK
4. Integrate with SIP Protocol for cross-chain privacy
