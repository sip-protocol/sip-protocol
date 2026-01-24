#!/bin/bash
# Build and deploy Solana verifier program

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUNSPOT_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SUNSPOT_DIR/keys"
VERIFIER_DIR="$SUNSPOT_DIR/verifier"

usage() {
    echo "Usage: $0 <circuit_name> [--deploy]"
    echo ""
    echo "Options:"
    echo "  --deploy    Deploy to Solana after building"
    echo ""
    echo "Example:"
    echo "  $0 funding_proof          # Build only"
    echo "  $0 funding_proof --deploy # Build and deploy to devnet"
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

CIRCUIT=$1
DEPLOY=false

if [ "$2" == "--deploy" ]; then
    DEPLOY=true
fi

if [ ! -f "$KEYS_DIR/$CIRCUIT.vk" ]; then
    echo "Error: $CIRCUIT.vk not found. Run setup.sh first."
    exit 1
fi

echo "=== Building Verifier Program ==="
echo "Circuit: $CIRCUIT"

# Build verifier .so
sunspot deploy \
    --vk "$KEYS_DIR/$CIRCUIT.vk" \
    --output "$VERIFIER_DIR/${CIRCUIT}_verifier.so"

echo "✓ Verifier built: $VERIFIER_DIR/${CIRCUIT}_verifier.so"
ls -lh "$VERIFIER_DIR/${CIRCUIT}_verifier.so"

if [ "$DEPLOY" = true ]; then
    echo ""
    echo "=== Deploying to Solana ==="

    # Generate keypair for program ID if not exists
    KEYPAIR="$VERIFIER_DIR/${CIRCUIT}_verifier-keypair.json"
    if [ ! -f "$KEYPAIR" ]; then
        echo "Generating program keypair..."
        solana-keygen new --no-bip39-passphrase -o "$KEYPAIR"
    fi

    PROGRAM_ID=$(solana-keygen pubkey "$KEYPAIR")
    echo "Program ID: $PROGRAM_ID"

    solana program deploy \
        "$VERIFIER_DIR/${CIRCUIT}_verifier.so" \
        --program-id "$KEYPAIR" \
        --url devnet

    echo ""
    echo "✓ Deployed: $PROGRAM_ID"
    echo ""
    echo "Add to your program:"
    echo "  pub const ${CIRCUIT^^}_VERIFIER: Pubkey = pubkey!(\"$PROGRAM_ID\");"
fi
