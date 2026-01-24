#!/bin/bash
# Generate a proof for a circuit with given inputs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUNSPOT_DIR="$(dirname "$SCRIPT_DIR")"
KEYS_DIR="$SUNSPOT_DIR/keys"
PROOFS_DIR="$SUNSPOT_DIR/proofs"

usage() {
    echo "Usage: $0 <circuit_name> <prover_toml>"
    echo ""
    echo "Example:"
    echo "  $0 funding_proof ./inputs/funding_proof.toml"
    exit 1
}

if [ $# -lt 2 ]; then
    usage
fi

CIRCUIT=$1
WITNESS=$2

if [ ! -f "$KEYS_DIR/$CIRCUIT.ccs" ]; then
    echo "Error: $CIRCUIT.ccs not found. Run compile.sh first."
    exit 1
fi

if [ ! -f "$KEYS_DIR/$CIRCUIT.pk" ]; then
    echo "Error: $CIRCUIT.pk not found. Run setup.sh first."
    exit 1
fi

if [ ! -f "$WITNESS" ]; then
    echo "Error: Witness file $WITNESS not found."
    exit 1
fi

echo "=== Generating Proof ==="
echo "Circuit: $CIRCUIT"
echo "Witness: $WITNESS"

sunspot prove \
    --ccs "$KEYS_DIR/$CIRCUIT.ccs" \
    --pk "$KEYS_DIR/$CIRCUIT.pk" \
    --witness "$WITNESS" \
    --proof "$PROOFS_DIR/$CIRCUIT.proof"

echo ""
echo "✓ Proof generated: $PROOFS_DIR/$CIRCUIT.proof"
ls -lh "$PROOFS_DIR/$CIRCUIT.proof"
