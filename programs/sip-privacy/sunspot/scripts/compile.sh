#!/bin/bash
# Compile Noir circuits to Sunspot CCS format

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUNSPOT_DIR="$(dirname "$SCRIPT_DIR")"
CIRCUITS_DIR="${CIRCUITS_DIR:-$HOME/local-dev/circuits}"

echo "=== Compiling Noir Circuits ==="

# Check dependencies
command -v nargo >/dev/null 2>&1 || { echo "nargo not found. Install with: noirup"; exit 1; }
command -v sunspot >/dev/null 2>&1 || { echo "sunspot not found. See README.md"; exit 1; }

# Circuits to compile
CIRCUITS=("funding_proof" "validity_proof" "fulfillment_proof")

for circuit in "${CIRCUITS[@]}"; do
    echo ""
    echo "--- Compiling $circuit ---"

    CIRCUIT_DIR="$CIRCUITS_DIR/$circuit"

    if [ ! -d "$CIRCUIT_DIR" ]; then
        echo "Warning: $CIRCUIT_DIR not found, skipping"
        continue
    fi

    cd "$CIRCUIT_DIR"

    # Compile Noir to ACIR
    echo "Compiling Noir..."
    nargo compile

    # Convert ACIR to CCS
    echo "Converting to CCS..."
    sunspot compile \
        --input "target/$circuit.json" \
        --output "$SUNSPOT_DIR/keys/$circuit.ccs"

    echo "✓ $circuit compiled"
done

echo ""
echo "=== Compilation Complete ==="
echo "CCS files in: $SUNSPOT_DIR/keys/"
ls -la "$SUNSPOT_DIR/keys/"*.ccs 2>/dev/null || echo "No CCS files generated"
