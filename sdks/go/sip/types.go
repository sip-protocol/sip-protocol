// Package sip provides the SIP Protocol SDK for Go.
//
// The privacy standard for Web3. Stealth addresses, Pedersen commitments,
// and viewing keys for compliant privacy.
package sip

// HexString is a hex string with 0x prefix (e.g., "0x1234abcd")
type HexString = string

// ChainID is a chain identifier (e.g., "ethereum", "solana", "near")
type ChainID = string

// Hash is a 32-byte hash as hex string with 0x prefix
type Hash = string

// StealthMetaAddress contains public keys for generating one-time addresses.
type StealthMetaAddress struct {
	// SpendingKey is a compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
	SpendingKey HexString `json:"spending_key"`
	// ViewingKey is a compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
	ViewingKey HexString `json:"viewing_key"`
	// Chain is the blockchain this address is for
	Chain ChainID `json:"chain"`
	// Label is an optional human-readable label
	Label string `json:"label,omitempty"`
}

// StealthAddress is a one-time stealth address derived from a meta-address.
type StealthAddress struct {
	// Address is the stealth address (compressed public key)
	Address HexString `json:"address"`
	// EphemeralPublicKey is the sender's ephemeral public key
	EphemeralPublicKey HexString `json:"ephemeral_public_key"`
	// ViewTag is the first byte of shared secret hash for efficient scanning
	ViewTag uint8 `json:"view_tag"`
}

// StealthAddressRecovery contains recovery data for spending from a stealth address.
type StealthAddressRecovery struct {
	// StealthAddress is the stealth address being recovered
	StealthAddress HexString `json:"stealth_address"`
	// EphemeralPublicKey is the ephemeral key used to generate the address
	EphemeralPublicKey HexString `json:"ephemeral_public_key"`
	// PrivateKey is the derived private key for spending
	PrivateKey HexString `json:"private_key"`
}

// PedersenCommitment is a Pedersen commitment with its blinding factor.
//
// C = v*G + r*H where:
//   - v = value (hidden)
//   - r = blinding factor (random)
//   - G, H = independent generators
type PedersenCommitment struct {
	// Commitment is the commitment point (compressed, 33 bytes)
	Commitment HexString `json:"commitment"`
	// Blinding is the blinding factor (32 bytes, secret)
	Blinding HexString `json:"blinding"`
}

// ViewingKey is a viewing key for selective disclosure.
type ViewingKey struct {
	// Key is the viewing key (32 bytes)
	Key HexString `json:"key"`
	// KeyHash is the SHA-256 hash of the key for indexing
	KeyHash HexString `json:"key_hash"`
	// CreatedAt is the Unix timestamp of key creation (milliseconds)
	CreatedAt int64 `json:"created_at"`
	// Label is an optional human-readable label
	Label string `json:"label,omitempty"`
}

// PrivacyLevel represents privacy levels for SIP transactions.
type PrivacyLevel string

const (
	// PrivacyTransparent - No privacy, all data public
	PrivacyTransparent PrivacyLevel = "transparent"
	// PrivacyShielded - Full privacy, sender/amount/recipient hidden
	PrivacyShielded PrivacyLevel = "shielded"
	// PrivacyCompliant - Privacy with viewing key for auditors
	PrivacyCompliant PrivacyLevel = "compliant"
)

// EncryptedPayload contains encrypted data with nonce for decryption.
type EncryptedPayload struct {
	// Ciphertext is the encrypted data (hex)
	Ciphertext HexString `json:"ciphertext"`
	// Nonce is the nonce/IV used for encryption (hex)
	Nonce HexString `json:"nonce"`
}

// Generators contains the G and H points for ZK proof integration.
type Generators struct {
	Gx HexString `json:"gx"`
	Gy HexString `json:"gy"`
	Hx HexString `json:"hx"`
	Hy HexString `json:"hy"`
}
