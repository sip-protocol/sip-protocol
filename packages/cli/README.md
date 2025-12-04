# @sip-protocol/cli

Command-line tool for Shielded Intents Protocol (SIP) operations.

## Installation

```bash
npm install -g @sip-protocol/cli
```

Or use directly with npx:

```bash
npx @sip-protocol/cli --help
```

## Commands

### Initialize Configuration

```bash
sip init [options]

Options:
  -n, --network <network>  Network (mainnet|testnet) (default: "testnet")
  -p, --privacy <level>    Default privacy level (default: "transparent")
  --reset                  Reset configuration to defaults
```

### Generate Stealth Meta-Address

```bash
sip keygen [options]

Options:
  -c, --chain <chain>        Target chain (ethereum, solana, near) (default: "ethereum")
  --spending-key <key>       Spending private key (hex)
  --viewing-key <key>        Viewing private key (hex)
```

### Create Pedersen Commitment

```bash
sip commit <amount> [options]

Arguments:
  amount                    Amount to commit

Options:
  -b, --blinding <factor>   Blinding factor (hex, optional)
  --verify                  Verify the commitment after creation
```

### Generate ZK Proof

```bash
# Funding proof
sip prove funding [options]

Options:
  -b, --balance <amount>    Current balance (required)
  -m, --minimum <amount>    Minimum required (required)
  -c, --commitment <hex>    Balance commitment

# Validity proof
sip prove validity [options]

Options:
  -i, --intent <hash>       Intent hash (required)
  -s, --sender <address>    Sender address (required)
  -c, --commitment <hex>    Amount commitment
```

### Verify ZK Proof

```bash
sip verify <proof> [options]

Arguments:
  proof                     Proof to verify (hex string)

Options:
  -t, --type <type>         Proof type (funding|validity|fulfillment) (default: "funding")
  -p, --public-inputs <json> Public inputs (JSON array)
```

### Get Swap Quote

```bash
sip quote <from-chain> <to-chain> <amount> [options]

Arguments:
  from-chain                Source chain (e.g., ethereum, solana)
  to-chain                  Destination chain
  amount                    Amount to swap

Options:
  -t, --token <symbol>      Token symbol (default: native token)
  -p, --privacy <level>     Privacy level (transparent|shielded|compliant)
```

### Execute Swap

```bash
sip swap <from-chain> <to-chain> <amount> [options]

Arguments:
  from-chain                Source chain (e.g., ethereum, solana)
  to-chain                  Destination chain
  amount                    Amount to swap

Options:
  -t, --token <symbol>      Token symbol (default: native token)
  -p, --privacy <level>     Privacy level (transparent|shielded|compliant)
  -r, --recipient <address> Recipient address (optional)
  --solver <id>             Specific solver to use
```

### Scan for Stealth Payments

```bash
sip scan [options]

Options:
  -c, --chain <chain>       Chain to scan (ethereum, solana, near) (required)
  -s, --spending-key <key>  Your spending private key (hex) (required)
  -v, --viewing-key <key>   Your viewing private key (hex) (required)
  -a, --addresses <addresses...> Specific addresses to check
```

## Examples

```bash
# Initialize with testnet
sip init --network testnet --privacy shielded

# Generate stealth keys for Ethereum
sip keygen --chain ethereum

# Create commitment
sip commit 1000000000000000000 --verify

# Generate funding proof
sip prove funding --balance 5000000 --minimum 1000000

# Get quote for ETH to SOL swap
sip quote ethereum solana 1000000000000000000 --privacy shielded

# Execute swap
sip swap ethereum solana 1000000000000000000 --privacy shielded

# Scan for stealth payments
sip scan --chain ethereum -s 0xYOUR_SPENDING_KEY -v 0xYOUR_VIEWING_KEY -a 0xADDRESS1 0xADDRESS2
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test locally
node bin/sip.js --help

# Link globally for testing
npm link
sip --help
```

## License

MIT
