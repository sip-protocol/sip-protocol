package sip

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// HashSHA256 computes SHA-256 hash of data.
//
// Returns 32-byte hash as hex string with 0x prefix.
func HashSHA256(data []byte) Hash {
	hash := sha256.Sum256(data)
	return "0x" + hex.EncodeToString(hash[:])
}

// GenerateRandomBytes generates cryptographically secure random bytes.
//
// Uses the platform's secure random source.
func GenerateRandomBytes(length int) (HexString, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return "0x" + hex.EncodeToString(bytes), nil
}

// GenerateIntentID generates a unique intent identifier.
//
// Creates a cryptographically random intent ID with the `sip-` prefix.
// IDs are globally unique with negligible collision probability (128-bit).
func GenerateIntentID() (string, error) {
	bytes := make([]byte, 16)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate intent ID: %w", err)
	}
	return "sip-" + hex.EncodeToString(bytes), nil
}

// HexToBytes converts hex string to bytes.
//
// Accepts hex string with or without 0x prefix.
func HexToBytes(hexStr string) ([]byte, error) {
	if len(hexStr) >= 2 && hexStr[:2] == "0x" {
		hexStr = hexStr[2:]
	}
	return hex.DecodeString(hexStr)
}

// BytesToHex converts bytes to hex string with 0x prefix.
func BytesToHex(data []byte) HexString {
	return "0x" + hex.EncodeToString(data)
}
