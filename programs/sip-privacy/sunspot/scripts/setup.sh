#!/bin/bash
# Generate proving and verification keys for circuits

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUNSPOT_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SUNSPOT_DIR/keys"

echo "=== Generating Proving/Verification Keys ==="

command -v sunspot >/dev/null 2>&1 || { echo "sunspot not found. See README.md"; exit 1; }

# Process all CCS files
for ccs in "$KEYS_DIR"/*.ccs; do
    if [ ! -f "$ccs" ]; then
        echo "No CCS files found. Run compile.sh first."
        exit 1
    fi

    circuit=$(basename "$ccs" .ccs)
    echo ""
    echo "--- Setting up $circuit ---"

    # Generate proving key and verification key
    sunspot setup \
        --ccs "$ccs" \
        --pk "$KEYS_DIR/$circuit.pk" \
        --vk "$KEYS_DIR/$circuit.vk"

    echo "✓ $circuit keys generated"
done

echo ""
echo "=== Setup Complete ==="
echo "Keys in: $KEYS_DIR/"
ls -lh "$KEYS_DIR"/*.pk "$KEYS_DIR"/*.vk 2>/dev/null || echo "No keys generated"
