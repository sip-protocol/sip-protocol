# SIP Protocol Secrets

This directory contains decrypted keypairs for Anchor program deployment.
Files here are gitignored for security.

## Required Keys

- `authority.json` - Program deployment authority
  - Address: S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd
  - Source: ~/.claude/sip-protocol/keys/solana/authority.json.age

- `program-id.json` - Program ID keypair
  - Address: S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
  - Source: ~/.claude/sip-protocol/keys/solana/program-id.json.age

- `treasury.json` - Treasury keypair (optional)
  - Address: S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q
  - Source: ~/.claude/sip-protocol/keys/solana/treasury.json.age

## Decryption

```bash
cd ~/.claude/sip-protocol/keys

# Authority
./sip-keys.sh decrypt solana/authority.json.age
mv /tmp/sip-key-decrypted.json /Users/rz/local-dev/sip-protocol/secrets/authority.json

# Program ID
./sip-keys.sh decrypt solana/program-id.json.age
mv /tmp/sip-key-decrypted.json /Users/rz/local-dev/sip-protocol/secrets/program-id.json
```

## Deploy to Devnet

```bash
cd /Users/rz/local-dev/sip-protocol/programs/sip-privacy

solana program deploy \
  target/deploy/sip_privacy.so \
  --program-id ../../../secrets/program-id.json \
  --keypair ../../../secrets/authority.json \
  --url devnet
```

## Cleanup

After deployment, remove decrypted keys:
```bash
rm -f /Users/rz/local-dev/sip-protocol/secrets/*.json
```
