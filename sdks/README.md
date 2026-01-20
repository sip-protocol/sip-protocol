# SIP Protocol Multi-Language SDKs

This directory contains SIP Protocol SDKs for multiple programming languages.

## Available SDKs

| Language | Package | Status | Registry |
|----------|---------|--------|----------|
| TypeScript | `@sip-protocol/sdk` | Production | [npm](https://www.npmjs.com/package/@sip-protocol/sdk) |
| Python | `sip-protocol` | Beta | [PyPI](https://pypi.org/project/sip-protocol/) |
| Rust | `sip-protocol` | Beta | [crates.io](https://crates.io/crates/sip-protocol) |
| Go | `sip-protocol` | Beta | [pkg.go.dev](https://pkg.go.dev/github.com/sip-protocol/sip-protocol/sdks/go) |

## API Consistency

All SDKs provide the same core functionality with idiomatic APIs for each language:

### Stealth Addresses (EIP-5564)

```python
# Python
meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
stealth, _ = generate_stealth_address(meta)
```

```rust
// Rust
let (meta, spending_priv, viewing_priv) = generate_stealth_meta_address("ethereum");
let (stealth, _) = generate_stealth_address(&meta)?;
```

```go
// Go
meta, spendingPriv, viewingPriv, _ := sip.GenerateStealthMetaAddress("ethereum")
stealth, _, _ := sip.GenerateStealthAddress(meta)
```

### Pedersen Commitments

```python
# Python
commitment, blinding = commit(100)
valid = verify_opening(commitment, 100, blinding)
```

```rust
// Rust
let (commitment, blinding) = commit(100)?;
let valid = verify_opening(&commitment, 100, &blinding)?;
```

```go
// Go
commitment, blinding, _ := sip.Commit(100)
valid, _ := sip.VerifyOpening(commitment, 100, blinding)
```

### Viewing Keys

```python
# Python
vk = generate_viewing_key("audit")
payload = encrypt_for_viewing_key(vk.key, b"secret")
plaintext = decrypt_with_viewing_key(vk.key, payload)
```

```rust
// Rust
let vk = generate_viewing_key(Some("audit"));
let payload = encrypt_for_viewing_key(&vk.key, b"secret")?;
let plaintext = decrypt_with_viewing_key(&vk.key, &payload)?;
```

```go
// Go
vk, _ := sip.GenerateViewingKey("audit")
payload, _ := sip.EncryptForViewingKey(vk.Key, []byte("secret"))
plaintext, _ := sip.DecryptWithViewingKey(vk.Key, payload)
```

## Features

All SDKs implement:

- **Stealth Addresses** (EIP-5564): Generate unlinkable one-time addresses
- **Pedersen Commitments**: Hide amounts with homomorphic properties
- **Viewing Keys**: Selective disclosure for compliance
- **Privacy Levels**: Transparent, Shielded, Compliant
- **Meta-Address Encoding**: `sip:<chain>:<spending>:<viewing>`
- **Ethereum Address Derivation**: EIP-55 checksummed addresses

## Cryptographic Libraries

| Language | Elliptic Curves | Encryption |
|----------|-----------------|------------|
| TypeScript | @noble/curves | @noble/ciphers |
| Python | coincurve, py_ecc | pycryptodome |
| Rust | k256 | chacha20poly1305 |
| Go | dcrd/dcrec/secp256k1 | golang.org/x/crypto |

All implementations use secp256k1 for stealth addresses and XChaCha20-Poly1305 for encryption.

## Development

### Python

```bash
cd sdks/python
pip install -e ".[dev]"
pytest
```

### Rust

```bash
cd sdks/rust
cargo test
```

### Go

```bash
cd sdks/go
go test ./...
```

## License

MIT License - see [LICENSE](../LICENSE) for details.
