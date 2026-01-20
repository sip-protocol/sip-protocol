# SIP Protocol Go SDK

The privacy standard for Web3. Stealth addresses, Pedersen commitments, and viewing keys for compliant privacy.

## Installation

```bash
go get github.com/sip-protocol/sip-protocol/sdks/go
```

## Quick Start

```go
package main

import (
    "fmt"
    "github.com/sip-protocol/sip-protocol/sdks/go/sip"
)

func main() {
    // Generate stealth address keypair
    meta, spendingPriv, viewingPriv, _ := sip.GenerateStealthMetaAddress("ethereum")
    fmt.Printf("Spending key: %s\n", meta.SpendingKey)
    fmt.Printf("Viewing key: %s\n", meta.ViewingKey)

    // Generate one-time stealth address for payment
    stealth, sharedSecret, _ := sip.GenerateStealthAddress(meta)
    fmt.Printf("Stealth address: %s\n", stealth.Address)

    // Recipient derives private key to spend
    recovery, _ := sip.DeriveStealthPrivateKey(stealth, spendingPriv, viewingPriv)
    fmt.Printf("Derived private key: %s\n", recovery.PrivateKey)
}
```

## Features

### Stealth Addresses (EIP-5564)

Generate unlinkable one-time addresses for private payments:

```go
import "github.com/sip-protocol/sip-protocol/sdks/go/sip"

// Recipient publishes their meta-address
meta, spendingPriv, viewingPriv, _ := sip.GenerateStealthMetaAddress("ethereum")

// Sender generates one-time stealth address
stealth, _, _ := sip.GenerateStealthAddress(meta)

// Convert to Ethereum address
ethAddress, _ := sip.PublicKeyToEthAddress(stealth.Address)
fmt.Printf("Send ETH to: %s\n", ethAddress)

// Recipient scans for their payments
isMine, _ := sip.CheckStealthAddress(stealth, spendingPriv, viewingPriv)
```

### Pedersen Commitments

Hide amounts with homomorphic commitments:

```go
import "github.com/sip-protocol/sip-protocol/sdks/go/sip"

// Create commitment to 100 tokens
c1, b1, _ := sip.Commit(100)

// Create commitment to 50 tokens
c2, b2, _ := sip.Commit(50)

// Add commitments homomorphically
cSum, _ := sip.AddCommitments(c1, c2)
bSum, _ := sip.AddBlindings(b1, b2)

// Verify the sum
valid, _ := sip.VerifyOpening(cSum, 150, bSum)
// valid == true
```

### Viewing Keys

Selective disclosure for compliance:

```go
import "github.com/sip-protocol/sip-protocol/sdks/go/sip"

// Generate viewing key for auditor
vk, _ := sip.GenerateViewingKey("tax-audit-2024")

// Encrypt transaction details
payload, _ := sip.EncryptForViewingKey(vk.Key, []byte("Transaction: 100 USDC to 0x..."))

// Auditor decrypts with viewing key
plaintext, _ := sip.DecryptWithViewingKey(vk.Key, payload)
```

## Privacy Levels

```go
import "github.com/sip-protocol/sip-protocol/sdks/go/sip"

// PrivacyTransparent - No privacy, all data public
// PrivacyShielded - Full privacy, sender/amount/recipient hidden
// PrivacyCompliant - Privacy with viewing key for auditors
```

## API Reference

### Stealth Addresses

- `GenerateStealthMetaAddress(chain)` - Generate keypair
- `GenerateStealthAddress(metaAddress)` - Generate one-time address
- `DeriveStealthPrivateKey(stealth, spendingPriv, viewingPriv)` - Recover private key
- `CheckStealthAddress(stealth, spendingPriv, viewingPriv)` - Check ownership
- `PublicKeyToEthAddress(publicKey)` - Convert to ETH address
- `EncodeStealthMetaAddress(meta)` - Encode to SIP format
- `DecodeStealthMetaAddress(encoded)` - Decode from SIP format

### Pedersen Commitments

- `Commit(value)` - Create commitment
- `VerifyOpening(commitment, value, blinding)` - Verify commitment
- `AddCommitments(c1, c2)` - Homomorphic addition
- `SubtractCommitments(c1, c2)` - Homomorphic subtraction
- `AddBlindings(b1, b2)` - Add blinding factors
- `SubtractBlindings(b1, b2)` - Subtract blinding factors
- `GenerateBlinding()` - Generate random blinding

### Viewing Keys

- `GenerateViewingKey(label)` - Generate viewing key
- `DeriveViewingKeyHash(viewingKey)` - Get key hash
- `EncryptForViewingKey(viewingKey, plaintext)` - Encrypt data
- `DecryptWithViewingKey(viewingKey, payload)` - Decrypt data

## Development

```bash
# Run tests
go test ./...

# Run benchmarks
go test -bench=. ./...

# Build
go build ./...
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [Website](https://sip-protocol.org)
- [Documentation](https://docs.sip-protocol.org)
- [GitHub](https://github.com/sip-protocol/sip-protocol)
- [TypeScript SDK](https://www.npmjs.com/package/@sip-protocol/sdk)
- [Python SDK](https://pypi.org/project/sip-protocol/)
- [Rust SDK](https://crates.io/crates/sip-protocol)
