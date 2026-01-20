"""
SIP Protocol SDK for Python

The privacy standard for Web3. Stealth addresses, Pedersen commitments,
and viewing keys for compliant privacy.

Example:
    >>> from sip_protocol import generate_stealth_meta_address, commit
    >>>
    >>> # Generate stealth address keypair
    >>> meta, spending_priv, viewing_priv = generate_stealth_meta_address("ethereum")
    >>>
    >>> # Create a Pedersen commitment
    >>> commitment, blinding = commit(1000)
"""

__version__ = "0.1.0"

from .crypto import (
    hash_sha256,
    generate_random_bytes,
    generate_intent_id,
)

from .commitment import (
    commit,
    verify_opening,
    commit_zero,
    add_commitments,
    subtract_commitments,
    add_blindings,
    subtract_blindings,
    generate_blinding,
    get_generators,
)

from .stealth import (
    generate_stealth_meta_address,
    generate_stealth_address,
    derive_stealth_private_key,
    check_stealth_address,
    public_key_to_eth_address,
    encode_stealth_meta_address,
    decode_stealth_meta_address,
)

from .privacy import (
    generate_viewing_key,
    derive_viewing_key_hash,
    encrypt_for_viewing_key,
    decrypt_with_viewing_key,
    PrivacyLevel,
)

from .types import (
    HexString,
    StealthMetaAddress,
    StealthAddress,
    StealthAddressRecovery,
    PedersenCommitment,
    ViewingKey,
)

from .optimizations import (
    ChainFamily,
    OptimizationProfile,
    ChainCharacteristics,
    SolanaComputeBudget,
    EvmGasConfig,
    OptimizationResult,
    detect_chain_family,
    get_chain_characteristics,
    calculate_solana_budget,
    estimate_solana_privacy_cu,
    calculate_evm_gas,
    estimate_evm_privacy_gas,
    select_optimal_config,
    compare_chain_costs,
    recommend_cheapest_chain,
)

__all__ = [
    # Version
    "__version__",
    # Crypto
    "hash_sha256",
    "generate_random_bytes",
    "generate_intent_id",
    # Commitment
    "commit",
    "verify_opening",
    "commit_zero",
    "add_commitments",
    "subtract_commitments",
    "add_blindings",
    "subtract_blindings",
    "generate_blinding",
    "get_generators",
    # Stealth
    "generate_stealth_meta_address",
    "generate_stealth_address",
    "derive_stealth_private_key",
    "check_stealth_address",
    "public_key_to_eth_address",
    "encode_stealth_meta_address",
    "decode_stealth_meta_address",
    # Privacy
    "generate_viewing_key",
    "derive_viewing_key_hash",
    "encrypt_for_viewing_key",
    "decrypt_with_viewing_key",
    "PrivacyLevel",
    # Types
    "HexString",
    "StealthMetaAddress",
    "StealthAddress",
    "StealthAddressRecovery",
    "PedersenCommitment",
    "ViewingKey",
    # Optimizations
    "ChainFamily",
    "OptimizationProfile",
    "ChainCharacteristics",
    "SolanaComputeBudget",
    "EvmGasConfig",
    "OptimizationResult",
    "detect_chain_family",
    "get_chain_characteristics",
    "calculate_solana_budget",
    "estimate_solana_privacy_cu",
    "calculate_evm_gas",
    "estimate_evm_privacy_gas",
    "select_optimal_config",
    "compare_chain_costs",
    "recommend_cheapest_chain",
]
