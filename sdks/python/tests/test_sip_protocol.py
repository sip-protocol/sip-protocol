"""
SIP Protocol Python SDK Tests

Tests for stealth addresses, Pedersen commitments, and viewing keys.
"""

import pytest


class TestCrypto:
    """Tests for crypto utilities."""

    def test_hash_sha256(self):
        from sip_protocol import hash_sha256

        result = hash_sha256("hello")
        assert result.startswith("0x")
        assert len(result) == 66  # 0x + 64 hex chars

    def test_generate_random_bytes(self):
        from sip_protocol import generate_random_bytes

        result = generate_random_bytes(32)
        assert result.startswith("0x")
        assert len(result) == 66  # 0x + 64 hex chars

        # Should be unique
        result2 = generate_random_bytes(32)
        assert result != result2

    def test_generate_intent_id(self):
        from sip_protocol import generate_intent_id

        result = generate_intent_id()
        assert result.startswith("sip-")
        assert len(result) == 36  # sip- + 32 hex chars


class TestCommitment:
    """Tests for Pedersen commitments."""

    def test_commit_and_verify(self):
        from sip_protocol import commit, verify_opening

        commitment, blinding = commit(100)
        assert commitment.startswith("0x")
        assert blinding.startswith("0x")

        # Should verify correctly
        assert verify_opening(commitment, 100, blinding)

        # Should fail with wrong value
        assert not verify_opening(commitment, 101, blinding)

    def test_homomorphic_addition(self):
        from sip_protocol import commit, add_commitments, add_blindings, verify_opening

        c1, b1 = commit(100)
        c2, b2 = commit(50)

        c_sum = add_commitments(c1, c2)
        b_sum = add_blindings(b1, b2)

        # Sum should verify to 150
        assert verify_opening(c_sum, 150, b_sum)


class TestStealth:
    """Tests for stealth addresses."""

    def test_generate_meta_address(self):
        from sip_protocol import generate_stealth_meta_address

        meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")

        assert meta.chain == "ethereum"
        assert meta.spending_key.startswith("0x")
        assert meta.viewing_key.startswith("0x")
        assert spending_priv.startswith("0x")
        assert viewing_priv.startswith("0x")

    def test_generate_stealth_address(self):
        from sip_protocol import generate_stealth_meta_address, generate_stealth_address

        meta, _, _ = generate_stealth_meta_address("ethereum")
        stealth, shared_secret = generate_stealth_address(meta)

        assert stealth.address.startswith("0x")
        assert stealth.ephemeral_public_key.startswith("0x")
        assert 0 <= stealth.view_tag <= 255

    def test_check_stealth_address(self):
        from sip_protocol import (
            generate_stealth_meta_address,
            generate_stealth_address,
            check_stealth_address,
        )

        meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
        stealth, _ = generate_stealth_address(meta)

        # Should recognize own address
        assert check_stealth_address(stealth, spending_priv, viewing_priv)

    def test_derive_stealth_private_key(self):
        from sip_protocol import (
            generate_stealth_meta_address,
            generate_stealth_address,
            derive_stealth_private_key,
        )

        meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
        stealth, _ = generate_stealth_address(meta)

        recovery = derive_stealth_private_key(stealth, spending_priv, viewing_priv)

        assert recovery.stealth_address == stealth.address
        assert recovery.private_key.startswith("0x")

    def test_encode_decode_meta_address(self):
        from sip_protocol import (
            generate_stealth_meta_address,
            encode_stealth_meta_address,
            decode_stealth_meta_address,
        )

        meta, _, _ = generate_stealth_meta_address("ethereum")

        encoded = encode_stealth_meta_address(meta)
        assert encoded.startswith("sip:ethereum:")

        decoded = decode_stealth_meta_address(encoded)
        assert decoded.chain == meta.chain
        assert decoded.spending_key == meta.spending_key
        assert decoded.viewing_key == meta.viewing_key


class TestPrivacy:
    """Tests for viewing keys and encryption."""

    def test_generate_viewing_key(self):
        from sip_protocol import generate_viewing_key

        vk = generate_viewing_key("test-label")

        assert vk.key.startswith("0x")
        assert vk.key_hash.startswith("0x")
        assert vk.label == "test-label"
        assert vk.created_at > 0

    def test_derive_viewing_key_hash(self):
        from sip_protocol import generate_viewing_key, derive_viewing_key_hash

        vk = generate_viewing_key()
        hash = derive_viewing_key_hash(vk.key)

        assert hash == vk.key_hash

    def test_encrypt_decrypt(self):
        from sip_protocol import (
            generate_viewing_key,
            encrypt_for_viewing_key,
            decrypt_with_viewing_key,
        )

        vk = generate_viewing_key()
        plaintext = b"Hello, SIP Protocol!"

        payload = encrypt_for_viewing_key(vk.key, plaintext)
        assert payload.ciphertext.startswith("0x")
        assert payload.nonce.startswith("0x")

        decrypted = decrypt_with_viewing_key(vk.key, payload)
        assert decrypted == plaintext


class TestPrivacyLevel:
    """Tests for privacy levels."""

    def test_privacy_levels(self):
        from sip_protocol import PrivacyLevel

        assert PrivacyLevel.TRANSPARENT.value == "transparent"
        assert PrivacyLevel.SHIELDED.value == "shielded"
        assert PrivacyLevel.COMPLIANT.value == "compliant"
