package sip

import (
	"bytes"
	"strings"
	"testing"
)

func TestCrypto(t *testing.T) {
	t.Run("HashSHA256", func(t *testing.T) {
		hash := HashSHA256([]byte("hello"))
		if !strings.HasPrefix(hash, "0x") {
			t.Error("Hash should start with 0x")
		}
		if len(hash) != 66 {
			t.Errorf("Hash should be 66 chars, got %d", len(hash))
		}
	})

	t.Run("GenerateRandomBytes", func(t *testing.T) {
		r1, err := GenerateRandomBytes(32)
		if err != nil {
			t.Fatalf("Failed to generate random bytes: %v", err)
		}

		r2, _ := GenerateRandomBytes(32)
		if r1 == r2 {
			t.Error("Random bytes should be unique")
		}
	})

	t.Run("GenerateIntentID", func(t *testing.T) {
		id, err := GenerateIntentID()
		if err != nil {
			t.Fatalf("Failed to generate intent ID: %v", err)
		}

		if !strings.HasPrefix(id, "sip-") {
			t.Error("Intent ID should start with sip-")
		}
		if len(id) != 36 {
			t.Errorf("Intent ID should be 36 chars, got %d", len(id))
		}
	})
}

func TestCommitment(t *testing.T) {
	t.Run("CommitAndVerify", func(t *testing.T) {
		commitment, blinding, err := Commit(100)
		if err != nil {
			t.Fatalf("Failed to commit: %v", err)
		}

		if !strings.HasPrefix(commitment, "0x") {
			t.Error("Commitment should start with 0x")
		}

		valid, err := VerifyOpening(commitment, 100, blinding)
		if err != nil {
			t.Fatalf("Failed to verify: %v", err)
		}
		if !valid {
			t.Error("Commitment should verify for correct value")
		}

		invalid, _ := VerifyOpening(commitment, 101, blinding)
		if invalid {
			t.Error("Commitment should not verify for wrong value")
		}
	})

	t.Run("HomomorphicAddition", func(t *testing.T) {
		c1, b1, _ := Commit(100)
		c2, b2, _ := Commit(50)

		cSum, err := AddCommitments(c1, c2)
		if err != nil {
			t.Fatalf("Failed to add commitments: %v", err)
		}

		bSum, err := AddBlindings(b1, b2)
		if err != nil {
			t.Fatalf("Failed to add blindings: %v", err)
		}

		valid, _ := VerifyOpening(cSum, 150, bSum)
		if !valid {
			t.Error("Sum should verify to 150")
		}
	})
}

func TestStealth(t *testing.T) {
	t.Run("GenerateMetaAddress", func(t *testing.T) {
		meta, spendingPriv, viewingPriv, err := GenerateStealthMetaAddress("ethereum")
		if err != nil {
			t.Fatalf("Failed to generate meta address: %v", err)
		}

		if meta.Chain != "ethereum" {
			t.Errorf("Chain should be ethereum, got %s", meta.Chain)
		}
		if !strings.HasPrefix(meta.SpendingKey, "0x") {
			t.Error("Spending key should start with 0x")
		}
		if !strings.HasPrefix(spendingPriv, "0x") {
			t.Error("Spending private key should start with 0x")
		}
		if !strings.HasPrefix(viewingPriv, "0x") {
			t.Error("Viewing private key should start with 0x")
		}
	})

	t.Run("GenerateAndCheckStealthAddress", func(t *testing.T) {
		meta, spendingPriv, viewingPriv, _ := GenerateStealthMetaAddress("ethereum")
		stealth, _, err := GenerateStealthAddress(meta)
		if err != nil {
			t.Fatalf("Failed to generate stealth address: %v", err)
		}

		if !strings.HasPrefix(stealth.Address, "0x") {
			t.Error("Stealth address should start with 0x")
		}

		isMine, err := CheckStealthAddress(stealth, spendingPriv, viewingPriv)
		if err != nil {
			t.Fatalf("Failed to check stealth address: %v", err)
		}
		if !isMine {
			t.Error("Should recognize own stealth address")
		}
	})

	t.Run("DeriveStealthPrivateKey", func(t *testing.T) {
		meta, spendingPriv, viewingPriv, _ := GenerateStealthMetaAddress("ethereum")
		stealth, _, _ := GenerateStealthAddress(meta)

		recovery, err := DeriveStealthPrivateKey(stealth, spendingPriv, viewingPriv)
		if err != nil {
			t.Fatalf("Failed to derive private key: %v", err)
		}

		if recovery.StealthAddress != stealth.Address {
			t.Error("Stealth address mismatch")
		}
		if !strings.HasPrefix(recovery.PrivateKey, "0x") {
			t.Error("Private key should start with 0x")
		}
	})

	t.Run("EncodeDecodeMetaAddress", func(t *testing.T) {
		meta, _, _, _ := GenerateStealthMetaAddress("ethereum")

		encoded := EncodeStealthMetaAddress(meta)
		if !strings.HasPrefix(encoded, "sip:ethereum:") {
			t.Error("Encoded should start with sip:ethereum:")
		}

		decoded, err := DecodeStealthMetaAddress(encoded)
		if err != nil {
			t.Fatalf("Failed to decode: %v", err)
		}

		if decoded.Chain != meta.Chain {
			t.Error("Chain mismatch")
		}
		if decoded.SpendingKey != meta.SpendingKey {
			t.Error("Spending key mismatch")
		}
	})
}

func TestPrivacy(t *testing.T) {
	t.Run("GenerateViewingKey", func(t *testing.T) {
		vk, err := GenerateViewingKey("test-label")
		if err != nil {
			t.Fatalf("Failed to generate viewing key: %v", err)
		}

		if !strings.HasPrefix(vk.Key, "0x") {
			t.Error("Key should start with 0x")
		}
		if vk.Label != "test-label" {
			t.Error("Label mismatch")
		}
	})

	t.Run("DeriveViewingKeyHash", func(t *testing.T) {
		vk, _ := GenerateViewingKey("")
		hash, err := DeriveViewingKeyHash(vk.Key)
		if err != nil {
			t.Fatalf("Failed to derive hash: %v", err)
		}

		if hash != vk.KeyHash {
			t.Error("Hash should match")
		}
	})

	t.Run("EncryptDecrypt", func(t *testing.T) {
		vk, _ := GenerateViewingKey("")
		plaintext := []byte("Hello, SIP Protocol!")

		payload, err := EncryptForViewingKey(vk.Key, plaintext)
		if err != nil {
			t.Fatalf("Failed to encrypt: %v", err)
		}

		if !strings.HasPrefix(payload.Ciphertext, "0x") {
			t.Error("Ciphertext should start with 0x")
		}

		decrypted, err := DecryptWithViewingKey(vk.Key, payload)
		if err != nil {
			t.Fatalf("Failed to decrypt: %v", err)
		}

		if !bytes.Equal(decrypted, plaintext) {
			t.Error("Decrypted should match plaintext")
		}
	})
}

func TestPrivacyLevel(t *testing.T) {
	if PrivacyTransparent != "transparent" {
		t.Error("PrivacyTransparent should be 'transparent'")
	}
	if PrivacyShielded != "shielded" {
		t.Error("PrivacyShielded should be 'shielded'")
	}
	if PrivacyCompliant != "compliant" {
		t.Error("PrivacyCompliant should be 'compliant'")
	}
}
