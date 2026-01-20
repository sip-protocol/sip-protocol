# SIP Protocol Rust SDK

The privacy standard for Web3. Stealth addresses, Pedersen commitments, and viewing keys for compliant privacy.

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
sip-protocol = "0.1"
```

## Quick Start

```rust
use sip_protocol::{
    generate_stealth_meta_address,
    generate_stealth_address,
    derive_stealth_private_key,
    commit,
    verify_opening,
    generate_viewing_key,
    encrypt_for_viewing_key,
    decrypt_with_viewing_key,
    PrivacyLevel,
};

fn main() {
    // Generate stealth address keypair
    let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");
    println!("Spending key: {}", meta.spending_key);
    println!("Viewing key: {}", meta.viewing_key);

    // Generate one-time stealth address for payment
    let (stealth, shared_secret) = generate_stealth_address(&meta).unwrap();
    println!("Stealth address: {}", stealth.address);

    // Recipient derives private key to spend
    let recovery = derive_stealth_private_key(&stealth, &spending_priv, &viewing_priv).unwrap();
    println!("Derived private key: {}", recovery.private_key);
}
```

## Features

### Stealth Addresses (EIP-5564)

Generate unlinkable one-time addresses for private payments:

```rust
use sip_protocol::{
    generate_stealth_meta_address,
    generate_stealth_address,
    check_stealth_address,
    public_key_to_eth_address,
};

// Recipient publishes their meta-address
let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");

// Sender generates one-time stealth address
let (stealth, _) = generate_stealth_address(&meta).unwrap();

// Convert to Ethereum address
let eth_address = public_key_to_eth_address(&stealth.address).unwrap();
println!("Send ETH to: {}", eth_address);

// Recipient scans for their payments
let is_mine = check_stealth_address(&stealth, &spending_priv, &viewing_priv).unwrap();
```

### Pedersen Commitments

Hide amounts with homomorphic commitments:

```rust
use sip_protocol::{
    commit,
    verify_opening,
    add_commitments,
    add_blindings,
};

// Create commitment to 100 tokens
let (c1, b1) = commit(100).unwrap();

// Create commitment to 50 tokens
let (c2, b2) = commit(50).unwrap();

// Add commitments homomorphically
let c_sum = add_commitments(&c1, &c2).unwrap();
let b_sum = add_blindings(&b1, &b2).unwrap();

// Verify the sum
assert!(verify_opening(&c_sum, 150, &b_sum).unwrap());
```

### Viewing Keys

Selective disclosure for compliance:

```rust
use sip_protocol::{
    generate_viewing_key,
    encrypt_for_viewing_key,
    decrypt_with_viewing_key,
};

// Generate viewing key for auditor
let vk = generate_viewing_key(Some("tax-audit-2024"));

// Encrypt transaction details
let payload = encrypt_for_viewing_key(&vk.key, b"Transaction: 100 USDC to 0x...").unwrap();

// Auditor decrypts with viewing key
let plaintext = decrypt_with_viewing_key(&vk.key, &payload).unwrap();
```

## Privacy Levels

```rust
use sip_protocol::PrivacyLevel;

// Transparent - No privacy, all data public
// Shielded - Full privacy, sender/amount/recipient hidden
// Compliant - Privacy with viewing key for auditors
```

## WASM Support

Enable WASM compilation with the `wasm` feature:

```toml
[dependencies]
sip-protocol = { version = "0.1", features = ["wasm"] }
```

## API Reference

### Stealth Addresses

- `generate_stealth_meta_address(chain)` - Generate keypair
- `generate_stealth_address(meta_address)` - Generate one-time address
- `derive_stealth_private_key(stealth, spending_priv, viewing_priv)` - Recover private key
- `check_stealth_address(stealth, spending_priv, viewing_priv)` - Check ownership
- `public_key_to_eth_address(public_key)` - Convert to ETH address
- `encode_stealth_meta_address(meta)` - Encode to SIP format
- `decode_stealth_meta_address(encoded)` - Decode from SIP format

### Pedersen Commitments

- `commit(value)` - Create commitment
- `verify_opening(commitment, value, blinding)` - Verify commitment
- `add_commitments(c1, c2)` - Homomorphic addition
- `subtract_commitments(c1, c2)` - Homomorphic subtraction
- `add_blindings(b1, b2)` - Add blinding factors
- `subtract_blindings(b1, b2)` - Subtract blinding factors
- `generate_blinding()` - Generate random blinding

### Viewing Keys

- `generate_viewing_key(label)` - Generate viewing key
- `derive_viewing_key_hash(viewing_key)` - Get key hash
- `encrypt_for_viewing_key(viewing_key, plaintext)` - Encrypt data
- `decrypt_with_viewing_key(viewing_key, payload)` - Decrypt data

## Development

```bash
# Build
cargo build

# Run tests
cargo test

# Build for release
cargo build --release

# Build for WASM
cargo build --target wasm32-unknown-unknown --features wasm
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [Website](https://sip-protocol.org)
- [Documentation](https://docs.sip-protocol.org)
- [GitHub](https://github.com/sip-protocol/sip-protocol)
- [TypeScript SDK](https://www.npmjs.com/package/@sip-protocol/sdk)
- [Python SDK](https://pypi.org/project/sip-protocol/)
