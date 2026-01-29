# SIP Protocol Secrets

This directory contains decrypted keypairs for Anchor program deployment.
Files here are gitignored for security.

## Required Keys

- `authority.json` - Program deployment authority
  - Address: S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd
  - Source: ~/.claude/sip-protocol/keys/solana/authority.json.age

- `sip-native-program-id.json` - SIP Privacy Program ID keypair
  - Address: S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
  - Source: ~/.claude/sip-protocol/keys/solana/sip-native-program-id.json.age

- `arcium-program-id.json` - SIP Arcium Transfer Program ID keypair
  - Address: S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9
  - Source: ~/.claude/sip-protocol/keys/solana/arcium-program-id.json.age

- `treasury.json` - Treasury keypair (optional)
  - Address: S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q
  - Source: ~/.claude/sip-protocol/keys/solana/treasury.json.age

## Decryption

```bash
cd ~/.claude/sip-protocol/keys

# Authority
./sip-keys.sh decrypt solana/authority.json.age
mv /tmp/sip-key-decrypted.json /Users/rz/local-dev/sip-protocol/secrets/authority.json

# SIP Native Program ID
./sip-keys.sh decrypt solana/sip-native-program-id.json.age
mv /tmp/sip-key-decrypted.json /Users/rz/local-dev/sip-protocol/secrets/sip-native-program-id.json

# Arcium Program ID
./sip-keys.sh decrypt solana/arcium-program-id.json.age
mv /tmp/sip-key-decrypted.json /Users/rz/local-dev/sip-protocol/secrets/arcium-program-id.json
```

## Deploy to Devnet

```bash
# SIP Native (Privacy)
cd /Users/rz/local-dev/sip-protocol/programs/sip-privacy
solana program deploy target/deploy/sip_privacy.so \
  --program-id ../../../secrets/sip-native-program-id.json \
  --keypair ../../../secrets/authority.json --url devnet

# SIP Arcium Transfer
cd /Users/rz/local-dev/sip-mobile/programs/sip_arcium_transfer
solana program deploy target/deploy/sip_arcium_transfer.so \
  --program-id ~/local-dev/sip-protocol/secrets/arcium-program-id.json \
  --keypair ~/local-dev/sip-protocol/secrets/authority.json --url devnet
```

## Cleanup

After deployment, remove decrypted keys:
```bash
rm -f /Users/rz/local-dev/sip-protocol/secrets/*.json
```
