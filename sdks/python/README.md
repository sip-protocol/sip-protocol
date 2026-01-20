# SIP Protocol Python SDK

The privacy standard for Web3. Stealth addresses, Pedersen commitments, and viewing keys for compliant privacy.

## Installation

```bash
pip install sip-protocol
```

## Quick Start

```python
from sip_protocol import (
    generate_stealth_meta_address,
    generate_stealth_address,
    derive_stealth_private_key,
    commit,
    verify_opening,
    generate_viewing_key,
    encrypt_for_viewing_key,
    decrypt_with_viewing_key,
    PrivacyLevel,
)

# Generate stealth address keypair
meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
print(f"Spending key: {meta.spending_key}")
print(f"Viewing key: {meta.viewing_key}")

# Generate one-time stealth address for payment
stealth, shared_secret = generate_stealth_address(meta)
print(f"Stealth address: {stealth.address}")

# Recipient derives private key to spend
recovery = derive_stealth_private_key(stealth, spending_priv, viewing_priv)
print(f"Derived private key: {recovery.private_key}")
```

## Features

### Stealth Addresses (EIP-5564)

Generate unlinkable one-time addresses for private payments:

```python
from sip_protocol import (
    generate_stealth_meta_address,
    generate_stealth_address,
    check_stealth_address,
    public_key_to_eth_address,
)

# Recipient publishes their meta-address
meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")

# Sender generates one-time stealth address
stealth, _ = generate_stealth_address(meta)

# Convert to Ethereum address
eth_address = public_key_to_eth_address(stealth.address)
print(f"Send ETH to: {eth_address}")

# Recipient scans for their payments
is_mine = check_stealth_address(stealth, spending_priv, viewing_priv)
```

### Pedersen Commitments

Hide amounts with homomorphic commitments:

```python
from sip_protocol import (
    commit,
    verify_opening,
    add_commitments,
    add_blindings,
)

# Create commitment to 100 tokens
c1, b1 = commit(100)

# Create commitment to 50 tokens
c2, b2 = commit(50)

# Add commitments homomorphically
c_sum = add_commitments(c1, c2)
b_sum = add_blindings(b1, b2)

# Verify the sum
assert verify_opening(c_sum, 150, b_sum)
```

### Viewing Keys

Selective disclosure for compliance:

```python
from sip_protocol import (
    generate_viewing_key,
    encrypt_for_viewing_key,
    decrypt_with_viewing_key,
)

# Generate viewing key for auditor
vk = generate_viewing_key("tax-audit-2024")

# Encrypt transaction details
payload = encrypt_for_viewing_key(vk.key, b"Transaction: 100 USDC to 0x...")

# Auditor decrypts with viewing key
plaintext = decrypt_with_viewing_key(vk.key, payload)
```

## Privacy Levels

```python
from sip_protocol import PrivacyLevel

# TRANSPARENT - No privacy, all data public
# SHIELDED - Full privacy, sender/amount/recipient hidden
# COMPLIANT - Privacy with viewing key for auditors
```

## API Reference

### Stealth Addresses

- `generate_stealth_meta_address(chain, label?)` - Generate keypair
- `generate_stealth_address(meta_address)` - Generate one-time address
- `derive_stealth_private_key(stealth, spending_priv, viewing_priv)` - Recover private key
- `check_stealth_address(stealth, spending_priv, viewing_priv)` - Check ownership
- `public_key_to_eth_address(public_key)` - Convert to ETH address
- `encode_stealth_meta_address(meta)` - Encode to SIP format
- `decode_stealth_meta_address(encoded)` - Decode from SIP format

### Pedersen Commitments

- `commit(value, blinding?)` - Create commitment
- `verify_opening(commitment, value, blinding)` - Verify commitment
- `add_commitments(c1, c2)` - Homomorphic addition
- `subtract_commitments(c1, c2)` - Homomorphic subtraction
- `add_blindings(b1, b2)` - Add blinding factors
- `subtract_blindings(b1, b2)` - Subtract blinding factors
- `generate_blinding()` - Generate random blinding

### Viewing Keys

- `generate_viewing_key(label?)` - Generate viewing key
- `derive_viewing_key_hash(viewing_key)` - Get key hash
- `encrypt_for_viewing_key(viewing_key, plaintext)` - Encrypt data
- `decrypt_with_viewing_key(viewing_key, payload)` - Decrypt data

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type check
mypy sip_protocol

# Lint
ruff check sip_protocol
```

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [Website](https://sip-protocol.org)
- [Documentation](https://docs.sip-protocol.org)
- [GitHub](https://github.com/sip-protocol/sip-protocol)
- [TypeScript SDK](https://www.npmjs.com/package/@sip-protocol/sdk)
