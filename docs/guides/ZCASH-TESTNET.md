# Zcash Testnet Setup Guide

Complete guide to running a zcashd testnet node for SIP Protocol development.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running zcashd](#running-zcashd)
5. [Getting Testnet TAZ](#getting-testnet-taz)
6. [Verifying Shielded Operations](#verifying-shielded-operations)
7. [SIP Protocol Integration](#sip-protocol-integration)
8. [Troubleshooting](#troubleshooting)

## Overview

The Zcash testnet allows you to test shielded transactions without using real ZEC. Testnet coins (TAZ) are free and have no monetary value.

**Network Details:**
- Network: `testnet`
- Default RPC port: `18232`
- Block time: ~75 seconds
- Currency: TAZ (testnet ZEC)

## Installation

### macOS (Homebrew)

```bash
# Add Zcash tap
brew tap zcash/zcash

# Install zcashd
brew install zcashd

# Verify installation
zcashd --version
```

### Linux (Debian/Ubuntu)

```bash
# Add Zcash repository
wget -qO - https://apt.z.cash/zcash.asc | sudo gpg --dearmor -o /usr/share/keyrings/zcash-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/zcash-archive-keyring.gpg] https://apt.z.cash/ bookworm main" | sudo tee /etc/apt/sources.list.d/zcash.list

# Install
sudo apt update
sudo apt install zcash

# Fetch parameters (required on first run)
zcash-fetch-params
```

### Linux (Binary)

```bash
# Download latest release
wget https://z.cash/downloads/zcash-5.8.0-linux64-debian-bullseye.tar.gz

# Extract
tar -xvf zcash-5.8.0-linux64-debian-bullseye.tar.gz
cd zcash-5.8.0/bin

# Fetch parameters (required on first run)
./zcash-fetch-params
```

### Docker

```bash
# Pull official image
docker pull electriccoinco/zcashd

# Run testnet
docker run -d \
  --name zcashd-testnet \
  -p 18232:18232 \
  -v zcash-data:/root/.zcash \
  electriccoinco/zcashd \
  -testnet
```

## Configuration

### Create Configuration File

Create `~/.zcash/zcash.conf`:

```ini
# ═══════════════════════════════════════════════════════════════════
# Zcash Testnet Configuration for SIP Protocol
# ═══════════════════════════════════════════════════════════════════

# Network
testnet=1

# RPC Server
server=1
rpcuser=sip_testnet_user
rpcpassword=your_secure_password_here

# RPC Binding (localhost only for security)
rpcbind=127.0.0.1
rpcallowip=127.0.0.1

# Performance
dbcache=512
maxconnections=40

# Logging
debug=rpc
printtoconsole=1

# Wallet
keypool=100
```

### Security Notes

1. **Never use simple passwords** - Generate a secure password:
   ```bash
   openssl rand -hex 32
   ```

2. **Never expose RPC to internet** - Keep `rpcbind=127.0.0.1`

3. **Use different credentials per environment** - Don't reuse mainnet credentials

### Environment Variables

Add to your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
# Zcash Testnet credentials
export ZCASH_RPC_USER="sip_testnet_user"
export ZCASH_RPC_PASS="your_secure_password_here"
export ZCASH_RPC_HOST="127.0.0.1"
export ZCASH_RPC_PORT="18232"
export ZCASH_TESTNET="true"
```

Reload:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Running zcashd

### Start Testnet Node

```bash
# Foreground (with logs)
zcashd -testnet

# Background (daemon mode)
zcashd -testnet -daemon

# With specific config
zcashd -testnet -conf=/path/to/zcash.conf
```

### Check Status

```bash
# Get blockchain info
zcash-cli -testnet getblockchaininfo

# Get network info
zcash-cli -testnet getnetworkinfo

# Check sync progress
zcash-cli -testnet getblockchaininfo | jq '.verificationprogress'
```

### Wait for Sync

Initial sync can take several hours. Monitor progress:

```bash
# Watch sync progress
watch -n 10 'zcash-cli -testnet getblockchaininfo | jq ".blocks, .verificationprogress"'
```

### Stop Node

```bash
zcash-cli -testnet stop
```

## Getting Testnet TAZ

### Faucets

1. **ZecPages Faucet** (recommended):
   - https://faucet.zecpages.com/
   - Select "Testnet"
   - Enter your testnet address

2. **Community Faucets**:
   - Ask in Zcash Discord #testnet channel
   - https://discord.gg/zcash

### Get Your Address

```bash
# Create account and get unified address
zcash-cli -testnet z_getnewaccount
# Returns: { "account": 0 }

zcash-cli -testnet z_getaddressforaccount 0
# Returns: { "account": 0, "address": "utest1..." }
```

### Check Balance

```bash
# Account balance
zcash-cli -testnet z_getbalanceforaccount 0

# Wallet total
zcash-cli -testnet z_gettotalbalance
```

## Verifying Shielded Operations

### Create Shielded Address

```bash
# Get unified address with Orchard support
zcash-cli -testnet z_getaddressforaccount 0 '["orchard", "sapling"]'
```

### Send Shielded Transaction

```bash
# Send to another shielded address
zcash-cli -testnet z_sendmany "utest1your_address..." \
  '[{"address": "utest1recipient...", "amount": 0.1, "memo": "Test payment"}]' \
  1 null "FullPrivacy"
```

### Check Operation Status

```bash
# List operations
zcash-cli -testnet z_listoperationids

# Check specific operation
zcash-cli -testnet z_getoperationstatus '["opid-xxx"]'

# Get result (removes from queue)
zcash-cli -testnet z_getoperationresult '["opid-xxx"]'
```

### List Unspent Notes

```bash
# All unspent shielded notes
zcash-cli -testnet z_listunspent
```

### Export Viewing Key

```bash
# Export viewing key for an address
zcash-cli -testnet z_exportviewingkey "utest1your_address..."
```

## SIP Protocol Integration

### Run the Example

```bash
# From sip-protocol repository
cd /path/to/sip-protocol

# Install dependencies
pnpm install

# Run Zcash connection example
ZCASH_RPC_USER=sip_testnet_user \
ZCASH_RPC_PASS=your_password \
npx ts-node examples/zcash-connection/index.ts
```

### Integration Code

```typescript
import { ZcashRPCClient, ZcashShieldedService, PrivacyLevel } from '@sip-protocol/sdk'

// Low-level client
const client = new ZcashRPCClient({
  username: process.env.ZCASH_RPC_USER!,
  password: process.env.ZCASH_RPC_PASS!,
  testnet: true,
})

// Verify connection
const info = await client.getBlockchainInfo()
console.log(`Connected to ${info.chain} at block ${info.blocks}`)

// High-level service
const service = new ZcashShieldedService({
  rpcConfig: {
    username: process.env.ZCASH_RPC_USER!,
    password: process.env.ZCASH_RPC_PASS!,
    testnet: true,
  },
})

await service.initialize()

// Get balance
const balance = await service.getBalance()
console.log(`Balance: ${balance.confirmed} ZEC`)

// Send shielded (when you have TAZ)
const result = await service.sendShielded({
  to: recipientAddress,
  amount: 0.1,
  memo: 'SIP Protocol test',
  privacyLevel: PrivacyLevel.SHIELDED,
})
console.log(`TX: ${result.txid}`)
```

### Run Integration Tests

```bash
# Run optional Zcash integration tests
ZCASH_RPC_USER=user ZCASH_RPC_PASS=pass \
ZCASH_INTEGRATION=true \
pnpm test -- tests/integration/zcash.integration.test.ts --run
```

## Troubleshooting

### Cannot Connect (ECONNREFUSED)

```
Error: connect ECONNREFUSED 127.0.0.1:18232
```

**Solutions:**
1. Check if zcashd is running: `ps aux | grep zcashd`
2. Start zcashd: `zcashd -testnet -daemon`
3. Check port: `lsof -i :18232`

### Authentication Failed (401)

```
Error: 401 Unauthorized
```

**Solutions:**
1. Verify credentials match zcash.conf
2. Check environment variables: `echo $ZCASH_RPC_USER`
3. Restart zcashd after config changes

### Wallet Locked

```
Error: Error: Please enter the wallet passphrase with walletpassphrase first.
```

**Solutions:**
```bash
# Unlock wallet for 60 seconds
zcash-cli -testnet walletpassphrase "your_passphrase" 60
```

### Node Not Synced

```
Error: Block height too low
```

**Solutions:**
1. Wait for initial sync to complete
2. Check sync progress:
   ```bash
   zcash-cli -testnet getblockchaininfo | jq '.verificationprogress'
   ```

### Insufficient Funds

```
Error: Insufficient funds
```

**Solutions:**
1. Get TAZ from faucet
2. Wait for confirmations (1-10 minutes)
3. Check balance: `zcash-cli -testnet z_gettotalbalance`

### Slow Sync

**Solutions:**
1. Increase `dbcache` in zcash.conf
2. Ensure sufficient disk space (100GB+ recommended)
3. Check network connectivity

### macOS Gatekeeper Issues

```
"zcashd" cannot be opened because the developer cannot be verified.
```

**Solutions:**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /path/to/zcashd
```

## Useful Commands Reference

```bash
# ═══════════════════════════════════════════════════════════════════
# Zcash CLI Quick Reference
# ═══════════════════════════════════════════════════════════════════

# Network
zcash-cli -testnet getblockchaininfo
zcash-cli -testnet getnetworkinfo
zcash-cli -testnet getpeerinfo

# Wallet
zcash-cli -testnet z_getnewaccount
zcash-cli -testnet z_getaddressforaccount 0
zcash-cli -testnet z_listaddresses
zcash-cli -testnet z_getbalanceforaccount 0
zcash-cli -testnet z_gettotalbalance

# Transactions
zcash-cli -testnet z_sendmany "from_addr" '[{"address":"to_addr","amount":0.1}]'
zcash-cli -testnet z_listoperationids
zcash-cli -testnet z_getoperationstatus '["opid-xxx"]'
zcash-cli -testnet z_listunspent

# Keys
zcash-cli -testnet z_exportviewingkey "address"
zcash-cli -testnet z_importviewingkey "key"

# Node management
zcash-cli -testnet stop
zcash-cli -testnet help
```

## Related Resources

- [Zcash Documentation](https://zcash.readthedocs.io/)
- [Zcash RPC Reference](https://zcash.github.io/rpc/)
- [ZIP-317 Fees](https://zips.z.cash/zip-0317)
- [Zcash Discord](https://discord.gg/zcash)
- [SIP Protocol SDK](https://github.com/sip-protocol/sip-protocol)
