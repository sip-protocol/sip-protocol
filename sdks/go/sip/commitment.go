package sip

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"math/big"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
)

// Domain separation tag for H generation
const hDomain = "SIP-PEDERSEN-GENERATOR-H-v1"

var (
	// curveOrder is the secp256k1 curve order
	curveOrder = secp256k1.S256().N

	// generatorG is the base generator
	generatorG = secp256k1.Generator()

	// generatorH is the independent generator (NUMS)
	generatorH *secp256k1.JacobianPoint
)

func init() {
	// Generate H using NUMS method
	generatorH = generateH()
}

// generateH generates the independent generator H using NUMS method.
func generateH() *secp256k1.JacobianPoint {
	for counter := 0; counter < 256; counter++ {
		// Create candidate x-coordinate
		input := fmt.Sprintf("%s:%d", hDomain, counter)
		hash := sha256.Sum256([]byte(input))

		// Try to create a point from this x-coordinate (with even y)
		pointBytes := make([]byte, 33)
		pointBytes[0] = 0x02 // Compressed, even y
		copy(pointBytes[1:], hash[:])

		pubKey, err := secp256k1.ParsePubKey(pointBytes)
		if err == nil {
			var result secp256k1.JacobianPoint
			pubKey.AsJacobian(&result)
			return &result
		}
	}

	panic("failed to generate H point - this should never happen")
}

// Commit creates a Pedersen commitment to a value.
//
// C = v*G + r*H
//
// Where:
//   - v = value (the amount being committed)
//   - r = blinding factor (random, keeps value hidden)
//   - G = base generator
//   - H = independent generator (NUMS)
func Commit(value uint64) (HexString, HexString, error) {
	// Generate random blinding factor
	blinding := make([]byte, 32)
	_, err := rand.Read(blinding)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate blinding: %w", err)
	}

	return CommitWithBlinding(value, blinding)
}

// CommitWithBlinding creates a Pedersen commitment with a specific blinding factor.
func CommitWithBlinding(value uint64, blinding []byte) (HexString, HexString, error) {
	if len(blinding) != 32 {
		return "", "", errors.New("blinding must be 32 bytes")
	}

	// Convert to scalars
	vScalar := new(secp256k1.ModNScalar)
	vScalar.SetInt(uint32(value))

	rScalar := new(secp256k1.ModNScalar)
	rScalar.SetByteSlice(blinding)

	if rScalar.IsZero() {
		return "", "", errors.New("zero blinding scalar - investigate RNG")
	}

	// C = v*G + r*H
	var vG, rH, commitment secp256k1.JacobianPoint

	if value == 0 {
		// Only blinding contributes: C = r*H
		secp256k1.ScalarMultNonConst(rScalar, generatorH, &commitment)
	} else {
		// v*G
		secp256k1.ScalarBaseMultNonConst(vScalar, &vG)
		// r*H
		secp256k1.ScalarMultNonConst(rScalar, generatorH, &rH)
		// C = v*G + r*H
		secp256k1.AddNonConst(&vG, &rH, &commitment)
	}

	commitment.ToAffine()
	pubKey := secp256k1.NewPublicKey(&commitment.X, &commitment.Y)
	commitmentBytes := pubKey.SerializeCompressed()

	return BytesToHex(commitmentBytes), BytesToHex(blinding), nil
}

// VerifyOpening verifies that a commitment opens to a specific value.
//
// Recomputes C' = v*G + r*H and checks if C' == C
func VerifyOpening(commitment HexString, value uint64, blinding HexString) (bool, error) {
	commitmentBytes, err := HexToBytes(commitment)
	if err != nil {
		return false, fmt.Errorf("invalid commitment: %w", err)
	}

	blindingBytes, err := HexToBytes(blinding)
	if err != nil {
		return false, fmt.Errorf("invalid blinding: %w", err)
	}

	// Parse commitment point
	cPubKey, err := secp256k1.ParsePubKey(commitmentBytes)
	if err != nil {
		return false, fmt.Errorf("invalid commitment point: %w", err)
	}

	// Recompute expected commitment
	vScalar := new(secp256k1.ModNScalar)
	vScalar.SetInt(uint32(value))

	rScalar := new(secp256k1.ModNScalar)
	rScalar.SetByteSlice(blindingBytes)

	var expected secp256k1.JacobianPoint
	if value == 0 {
		secp256k1.ScalarMultNonConst(rScalar, generatorH, &expected)
	} else {
		var vG, rH secp256k1.JacobianPoint
		secp256k1.ScalarBaseMultNonConst(vScalar, &vG)
		secp256k1.ScalarMultNonConst(rScalar, generatorH, &rH)
		secp256k1.AddNonConst(&vG, &rH, &expected)
	}

	expected.ToAffine()
	expectedPubKey := secp256k1.NewPublicKey(&expected.X, &expected.Y)

	return cPubKey.IsEqual(expectedPubKey), nil
}

// CommitZero creates a commitment to zero with a specific blinding factor.
//
// C = 0*G + r*H = r*H
func CommitZero(blinding []byte) (HexString, HexString, error) {
	return CommitWithBlinding(0, blinding)
}

// AddCommitments adds two commitments homomorphically.
//
// C1 + C2 = (v1*G + r1*H) + (v2*G + r2*H) = (v1+v2)*G + (r1+r2)*H
func AddCommitments(c1, c2 HexString) (HexString, error) {
	c1Bytes, err := HexToBytes(c1)
	if err != nil {
		return "", fmt.Errorf("invalid c1: %w", err)
	}

	c2Bytes, err := HexToBytes(c2)
	if err != nil {
		return "", fmt.Errorf("invalid c2: %w", err)
	}

	pubKey1, err := secp256k1.ParsePubKey(c1Bytes)
	if err != nil {
		return "", fmt.Errorf("invalid commitment c1: %w", err)
	}

	pubKey2, err := secp256k1.ParsePubKey(c2Bytes)
	if err != nil {
		return "", fmt.Errorf("invalid commitment c2: %w", err)
	}

	var point1, point2, sum secp256k1.JacobianPoint
	pubKey1.AsJacobian(&point1)
	pubKey2.AsJacobian(&point2)

	secp256k1.AddNonConst(&point1, &point2, &sum)
	sum.ToAffine()

	resultPubKey := secp256k1.NewPublicKey(&sum.X, &sum.Y)
	return BytesToHex(resultPubKey.SerializeCompressed()), nil
}

// SubtractCommitments subtracts two commitments homomorphically.
//
// C1 - C2 = (v1-v2)*G + (r1-r2)*H
func SubtractCommitments(c1, c2 HexString) (HexString, error) {
	c1Bytes, err := HexToBytes(c1)
	if err != nil {
		return "", fmt.Errorf("invalid c1: %w", err)
	}

	c2Bytes, err := HexToBytes(c2)
	if err != nil {
		return "", fmt.Errorf("invalid c2: %w", err)
	}

	pubKey1, err := secp256k1.ParsePubKey(c1Bytes)
	if err != nil {
		return "", fmt.Errorf("invalid commitment c1: %w", err)
	}

	pubKey2, err := secp256k1.ParsePubKey(c2Bytes)
	if err != nil {
		return "", fmt.Errorf("invalid commitment c2: %w", err)
	}

	var point1, point2, negPoint2, diff secp256k1.JacobianPoint
	pubKey1.AsJacobian(&point1)
	pubKey2.AsJacobian(&point2)

	// Negate point2
	negPoint2 = point2
	negPoint2.Y.Negate(1)
	negPoint2.Y.Normalize()

	secp256k1.AddNonConst(&point1, &negPoint2, &diff)
	diff.ToAffine()

	resultPubKey := secp256k1.NewPublicKey(&diff.X, &diff.Y)
	return BytesToHex(resultPubKey.SerializeCompressed()), nil
}

// AddBlindings adds blinding factors (for use with homomorphic addition).
func AddBlindings(b1, b2 HexString) (HexString, error) {
	b1Bytes, err := HexToBytes(b1)
	if err != nil {
		return "", fmt.Errorf("invalid b1: %w", err)
	}

	b2Bytes, err := HexToBytes(b2)
	if err != nil {
		return "", fmt.Errorf("invalid b2: %w", err)
	}

	s1 := new(secp256k1.ModNScalar)
	s1.SetByteSlice(b1Bytes)

	s2 := new(secp256k1.ModNScalar)
	s2.SetByteSlice(b2Bytes)

	sum := s1.Add(s2)
	return BytesToHex(sum.Bytes()[:]), nil
}

// SubtractBlindings subtracts blinding factors (for use with homomorphic subtraction).
func SubtractBlindings(b1, b2 HexString) (HexString, error) {
	b1Bytes, err := HexToBytes(b1)
	if err != nil {
		return "", fmt.Errorf("invalid b1: %w", err)
	}

	b2Bytes, err := HexToBytes(b2)
	if err != nil {
		return "", fmt.Errorf("invalid b2: %w", err)
	}

	s1 := new(secp256k1.ModNScalar)
	s1.SetByteSlice(b1Bytes)

	s2 := new(secp256k1.ModNScalar)
	s2.SetByteSlice(b2Bytes)

	s2.Negate()
	diff := s1.Add(s2)
	return BytesToHex(diff.Bytes()[:]), nil
}

// GenerateBlinding generates a random blinding factor.
func GenerateBlinding() (HexString, error) {
	bytes := make([]byte, 32)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate blinding: %w", err)
	}
	return BytesToHex(bytes), nil
}

// GetGenerators returns the generators for ZK proof integration.
func GetGenerators() Generators {
	gPoint := secp256k1.Generator()
	var gJac secp256k1.JacobianPoint
	gPoint.AsJacobian(&gJac)

	return Generators{
		Gx: BytesToHex(gJac.X.Bytes()[:]),
		Gy: BytesToHex(gJac.Y.Bytes()[:]),
		Hx: BytesToHex(generatorH.X.Bytes()[:]),
		Hy: BytesToHex(generatorH.Y.Bytes()[:]),
	}
}
