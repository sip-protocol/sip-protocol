package sip

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"

	"github.com/decred/dcrd/dcrec/secp256k1/v4"
	"golang.org/x/crypto/sha3"
)

// GenerateStealthMetaAddress generates a new stealth meta-address keypair.
//
// Returns (meta_address, spending_private_key, viewing_private_key).
func GenerateStealthMetaAddress(chain ChainID) (*StealthMetaAddress, HexString, HexString, error) {
	// Generate random private keys
	spendingPriv, err := secp256k1.GeneratePrivateKey()
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate spending key: %w", err)
	}

	viewingPriv, err := secp256k1.GeneratePrivateKey()
	if err != nil {
		return nil, "", "", fmt.Errorf("failed to generate viewing key: %w", err)
	}

	// Derive public keys (compressed)
	spendingPub := spendingPriv.PubKey().SerializeCompressed()
	viewingPub := viewingPriv.PubKey().SerializeCompressed()

	meta := &StealthMetaAddress{
		SpendingKey: BytesToHex(spendingPub),
		ViewingKey:  BytesToHex(viewingPub),
		Chain:       chain,
	}

	return meta, BytesToHex(spendingPriv.Serialize()), BytesToHex(viewingPriv.Serialize()), nil
}

// GenerateStealthAddress generates a one-time stealth address for a recipient.
//
// Protocol:
// 1. Sender generates ephemeral keypair (r, R = r*G)
// 2. Compute shared secret: S = r * P_spend
// 3. Compute stealth address: A = Q_view + hash(S)*G
// 4. View tag = first byte of hash(S) for efficient scanning
func GenerateStealthAddress(recipientMeta *StealthMetaAddress) (*StealthAddress, HexString, error) {
	// Generate ephemeral keypair
	ephemeralPriv, err := secp256k1.GeneratePrivateKey()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate ephemeral key: %w", err)
	}
	ephemeralPub := ephemeralPriv.PubKey()

	// Parse recipient's keys
	spendingKeyBytes, err := HexToBytes(recipientMeta.SpendingKey)
	if err != nil {
		return nil, "", fmt.Errorf("invalid spending key: %w", err)
	}

	viewingKeyBytes, err := HexToBytes(recipientMeta.ViewingKey)
	if err != nil {
		return nil, "", fmt.Errorf("invalid viewing key: %w", err)
	}

	spendingPub, err := secp256k1.ParsePubKey(spendingKeyBytes)
	if err != nil {
		return nil, "", fmt.Errorf("invalid spending public key: %w", err)
	}

	viewingPub, err := secp256k1.ParsePubKey(viewingKeyBytes)
	if err != nil {
		return nil, "", fmt.Errorf("invalid viewing public key: %w", err)
	}

	// Compute shared secret: S = r * P_spend
	var spendingJac, sharedSecretJac secp256k1.JacobianPoint
	spendingPub.AsJacobian(&spendingJac)
	secp256k1.ScalarMultNonConst(&ephemeralPriv.Key, &spendingJac, &sharedSecretJac)
	sharedSecretJac.ToAffine()
	sharedSecretPub := secp256k1.NewPublicKey(&sharedSecretJac.X, &sharedSecretJac.Y)
	sharedSecretBytes := sharedSecretPub.SerializeCompressed()

	// Hash the shared secret
	sharedSecretHash := sha256.Sum256(sharedSecretBytes)

	// Compute stealth address: A = Q_view + hash(S)*G
	hashScalar := new(secp256k1.ModNScalar)
	hashScalar.SetByteSlice(sharedSecretHash[:])

	var hashTimesG secp256k1.JacobianPoint
	secp256k1.ScalarBaseMultNonConst(hashScalar, &hashTimesG)

	var viewingJac, stealthJac secp256k1.JacobianPoint
	viewingPub.AsJacobian(&viewingJac)
	secp256k1.AddNonConst(&viewingJac, &hashTimesG, &stealthJac)
	stealthJac.ToAffine()

	stealthPub := secp256k1.NewPublicKey(&stealthJac.X, &stealthJac.Y)
	stealthAddressBytes := stealthPub.SerializeCompressed()

	// View tag (first byte of hash for efficient scanning)
	viewTag := sharedSecretHash[0]

	stealth := &StealthAddress{
		Address:            BytesToHex(stealthAddressBytes),
		EphemeralPublicKey: BytesToHex(ephemeralPub.SerializeCompressed()),
		ViewTag:            viewTag,
	}

	return stealth, BytesToHex(sharedSecretHash[:]), nil
}

// DeriveStealthPrivateKey derives the private key for a stealth address.
//
// Protocol:
// 1. Compute shared secret: S = p_spend * R_ephemeral
// 2. Derive stealth private key: q_view + hash(S) mod n
func DeriveStealthPrivateKey(stealth *StealthAddress, spendingPrivKey, viewingPrivKey HexString) (*StealthAddressRecovery, error) {
	spendingPrivBytes, err := HexToBytes(spendingPrivKey)
	if err != nil {
		return nil, fmt.Errorf("invalid spending private key: %w", err)
	}

	viewingPrivBytes, err := HexToBytes(viewingPrivKey)
	if err != nil {
		return nil, fmt.Errorf("invalid viewing private key: %w", err)
	}

	ephemeralPubBytes, err := HexToBytes(stealth.EphemeralPublicKey)
	if err != nil {
		return nil, fmt.Errorf("invalid ephemeral public key: %w", err)
	}

	spendingPriv := secp256k1.PrivKeyFromBytes(spendingPrivBytes)
	ephemeralPub, err := secp256k1.ParsePubKey(ephemeralPubBytes)
	if err != nil {
		return nil, fmt.Errorf("invalid ephemeral key: %w", err)
	}

	// Compute shared secret: S = p_spend * R_ephemeral
	var ephemeralJac, sharedSecretJac secp256k1.JacobianPoint
	ephemeralPub.AsJacobian(&ephemeralJac)
	secp256k1.ScalarMultNonConst(&spendingPriv.Key, &ephemeralJac, &sharedSecretJac)
	sharedSecretJac.ToAffine()
	sharedSecretPub := secp256k1.NewPublicKey(&sharedSecretJac.X, &sharedSecretJac.Y)
	sharedSecretBytes := sharedSecretPub.SerializeCompressed()

	// Hash the shared secret
	sharedSecretHash := sha256.Sum256(sharedSecretBytes)

	// Derive stealth private key: q_view + hash(S) mod n
	viewingScalar := new(secp256k1.ModNScalar)
	viewingScalar.SetByteSlice(viewingPrivBytes)

	hashScalar := new(secp256k1.ModNScalar)
	hashScalar.SetByteSlice(sharedSecretHash[:])

	stealthScalar := viewingScalar.Add(hashScalar)

	return &StealthAddressRecovery{
		StealthAddress:     stealth.Address,
		EphemeralPublicKey: stealth.EphemeralPublicKey,
		PrivateKey:         BytesToHex(stealthScalar.Bytes()[:]),
	}, nil
}

// CheckStealthAddress checks if a stealth address belongs to this recipient.
//
// Uses view tag for efficient filtering, then does full verification.
func CheckStealthAddress(stealth *StealthAddress, spendingPrivKey, viewingPrivKey HexString) (bool, error) {
	spendingPrivBytes, err := HexToBytes(spendingPrivKey)
	if err != nil {
		return false, fmt.Errorf("invalid spending private key: %w", err)
	}

	viewingPrivBytes, err := HexToBytes(viewingPrivKey)
	if err != nil {
		return false, fmt.Errorf("invalid viewing private key: %w", err)
	}

	ephemeralPubBytes, err := HexToBytes(stealth.EphemeralPublicKey)
	if err != nil {
		return false, fmt.Errorf("invalid ephemeral public key: %w", err)
	}

	providedAddressBytes, err := HexToBytes(stealth.Address)
	if err != nil {
		return false, fmt.Errorf("invalid stealth address: %w", err)
	}

	spendingPriv := secp256k1.PrivKeyFromBytes(spendingPrivBytes)
	ephemeralPub, err := secp256k1.ParsePubKey(ephemeralPubBytes)
	if err != nil {
		return false, fmt.Errorf("invalid ephemeral key: %w", err)
	}

	// Compute shared secret
	var ephemeralJac, sharedSecretJac secp256k1.JacobianPoint
	ephemeralPub.AsJacobian(&ephemeralJac)
	secp256k1.ScalarMultNonConst(&spendingPriv.Key, &ephemeralJac, &sharedSecretJac)
	sharedSecretJac.ToAffine()
	sharedSecretPub := secp256k1.NewPublicKey(&sharedSecretJac.X, &sharedSecretJac.Y)
	sharedSecretBytes := sharedSecretPub.SerializeCompressed()

	// Hash the shared secret
	sharedSecretHash := sha256.Sum256(sharedSecretBytes)

	// Quick view tag check
	if sharedSecretHash[0] != stealth.ViewTag {
		return false, nil
	}

	// Full verification: derive expected stealth address
	viewingScalar := new(secp256k1.ModNScalar)
	viewingScalar.SetByteSlice(viewingPrivBytes)

	hashScalar := new(secp256k1.ModNScalar)
	hashScalar.SetByteSlice(sharedSecretHash[:])

	stealthScalar := viewingScalar.Add(hashScalar)

	// Compute expected public key
	var expectedJac secp256k1.JacobianPoint
	secp256k1.ScalarBaseMultNonConst(stealthScalar, &expectedJac)
	expectedJac.ToAffine()
	expectedPub := secp256k1.NewPublicKey(&expectedJac.X, &expectedJac.Y)
	expectedBytes := expectedPub.SerializeCompressed()

	// Compare
	providedPub, err := secp256k1.ParsePubKey(providedAddressBytes)
	if err != nil {
		return false, nil
	}

	return expectedPub.IsEqual(providedPub), nil
}

// PublicKeyToEthAddress converts a secp256k1 public key to an Ethereum address.
//
// Algorithm (EIP-55):
// 1. Decompress the public key to uncompressed form (65 bytes)
// 2. Remove the 0x04 prefix (take last 64 bytes)
// 3. keccak256 hash of the 64 bytes
// 4. Take the last 20 bytes as the address
// 5. Apply EIP-55 checksum
func PublicKeyToEthAddress(publicKey HexString) (HexString, error) {
	keyBytes, err := HexToBytes(publicKey)
	if err != nil {
		return "", fmt.Errorf("invalid public key: %w", err)
	}

	pubKey, err := secp256k1.ParsePubKey(keyBytes)
	if err != nil {
		return "", fmt.Errorf("invalid public key: %w", err)
	}

	// Get uncompressed public key (65 bytes starting with 0x04)
	uncompressed := pubKey.SerializeUncompressed()

	// Remove 0x04 prefix and keccak256 hash
	pubKeyWithoutPrefix := uncompressed[1:]
	hasher := sha3.NewLegacyKeccak256()
	hasher.Write(pubKeyWithoutPrefix)
	hash := hasher.Sum(nil)

	// Take last 20 bytes
	addressBytes := hash[12:]
	addressHex := fmt.Sprintf("%x", addressBytes)

	// Apply EIP-55 checksum
	checksumHasher := sha3.NewLegacyKeccak256()
	checksumHasher.Write([]byte(addressHex))
	checksumHash := checksumHasher.Sum(nil)

	var checksummed strings.Builder
	for i, c := range addressHex {
		if c >= '0' && c <= '9' {
			checksummed.WriteByte(byte(c))
		} else {
			nibble := (checksumHash[i/2] >> (4 * (1 - uint(i%2)))) & 0x0f
			if nibble >= 8 {
				checksummed.WriteByte(byte(c - 32)) // Uppercase
			} else {
				checksummed.WriteByte(byte(c))
			}
		}
	}

	return "0x" + checksummed.String(), nil
}

// EncodeStealthMetaAddress encodes a stealth meta-address to SIP format.
//
// Format: sip:<chain>:<spending_key>:<viewing_key>
func EncodeStealthMetaAddress(meta *StealthMetaAddress) string {
	return fmt.Sprintf("sip:%s:%s:%s", meta.Chain, meta.SpendingKey, meta.ViewingKey)
}

// DecodeStealthMetaAddress decodes a SIP-encoded stealth meta-address.
func DecodeStealthMetaAddress(encoded string) (*StealthMetaAddress, error) {
	parts := strings.Split(encoded, ":")
	if len(parts) != 4 || parts[0] != "sip" {
		return nil, errors.New("invalid stealth meta-address format")
	}

	return &StealthMetaAddress{
		Chain:       parts[1],
		SpendingKey: parts[2],
		ViewingKey:  parts[3],
	}, nil
}
