package sip

import (
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/chacha20poly1305"
)

// GenerateViewingKey generates a new viewing key for selective disclosure.
func GenerateViewingKey(label string) (*ViewingKey, error) {
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate viewing key: %w", err)
	}

	keyHash := sha256.Sum256(key)
	createdAt := time.Now().UnixMilli()

	return &ViewingKey{
		Key:       BytesToHex(key),
		KeyHash:   BytesToHex(keyHash[:]),
		CreatedAt: createdAt,
		Label:     label,
	}, nil
}

// DeriveViewingKeyHash derives the hash of a viewing key.
//
// This hash is used for indexing and verification without
// exposing the actual key.
func DeriveViewingKeyHash(viewingKey HexString) (HexString, error) {
	keyBytes, err := HexToBytes(viewingKey)
	if err != nil {
		return "", fmt.Errorf("invalid viewing key: %w", err)
	}

	hash := sha256.Sum256(keyBytes)
	return BytesToHex(hash[:]), nil
}

// EncryptForViewingKey encrypts data for viewing key holders.
//
// Uses XChaCha20-Poly1305 for authenticated encryption.
func EncryptForViewingKey(viewingKey HexString, plaintext []byte) (*EncryptedPayload, error) {
	keyBytes, err := HexToBytes(viewingKey)
	if err != nil {
		return nil, fmt.Errorf("invalid viewing key: %w", err)
	}

	if len(keyBytes) != 32 {
		return nil, errors.New("viewing key must be 32 bytes")
	}

	// Create XChaCha20-Poly1305 cipher
	aead, err := chacha20poly1305.NewX(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Generate random nonce (24 bytes for XChaCha20)
	nonce := make([]byte, chacha20poly1305.NonceSizeX)
	_, err = rand.Read(nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt
	ciphertext := aead.Seal(nil, nonce, plaintext, nil)

	return &EncryptedPayload{
		Ciphertext: BytesToHex(ciphertext),
		Nonce:      BytesToHex(nonce),
	}, nil
}

// DecryptWithViewingKey decrypts data using a viewing key.
func DecryptWithViewingKey(viewingKey HexString, payload *EncryptedPayload) ([]byte, error) {
	keyBytes, err := HexToBytes(viewingKey)
	if err != nil {
		return nil, fmt.Errorf("invalid viewing key: %w", err)
	}

	nonceBytes, err := HexToBytes(payload.Nonce)
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}

	ciphertextBytes, err := HexToBytes(payload.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("invalid ciphertext: %w", err)
	}

	if len(keyBytes) != 32 {
		return nil, errors.New("viewing key must be 32 bytes")
	}

	if len(nonceBytes) != chacha20poly1305.NonceSizeX {
		return nil, errors.New("invalid nonce length")
	}

	// Create XChaCha20-Poly1305 cipher
	aead, err := chacha20poly1305.NewX(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Decrypt
	plaintext, err := aead.Open(nil, nonceBytes, ciphertextBytes, nil)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	return plaintext, nil
}

// ShouldEncrypt determines if encryption should be used for a privacy level.
func ShouldEncrypt(level PrivacyLevel) bool {
	return level == PrivacyShielded || level == PrivacyCompliant
}

// ShouldIncludeViewingKey determines if viewing key should be included for a privacy level.
func ShouldIncludeViewingKey(level PrivacyLevel) bool {
	return level == PrivacyCompliant
}
