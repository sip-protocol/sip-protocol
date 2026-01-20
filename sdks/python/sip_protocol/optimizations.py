"""
Chain-Specific Optimizations for SIP Protocol Python SDK.

Provides optimized configurations for different blockchains:
- Solana: Compute unit budgeting, priority fees
- Ethereum/EVM: Gas estimation, L2 optimizations
- Cross-chain cost comparison
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, List, Tuple, Dict


class ChainFamily(Enum):
    """Chain family for optimization selection."""
    SOLANA = "solana"
    EVM = "evm"
    NEAR = "near"
    BITCOIN = "bitcoin"
    COSMOS = "cosmos"


class OptimizationProfile(Enum):
    """Optimization profile (cross-chain)."""
    ECONOMY = "economy"     # Lowest fees, may be slower
    STANDARD = "standard"   # Balanced cost/speed
    FAST = "fast"          # Higher fees, faster confirmation
    URGENT = "urgent"      # Maximum priority


@dataclass
class ChainCharacteristics:
    """Chain characteristics for optimization decisions."""
    family: ChainFamily
    block_time: float  # seconds
    has_eip1559: bool
    is_l2: bool
    cost_tier: int  # 1=cheapest, 5=most expensive
    native_token: str


@dataclass
class SolanaComputeBudget:
    """Solana compute budget configuration."""
    units: int
    microlamports_per_cu: int
    total_priority_fee_lamports: int


@dataclass
class EvmGasConfig:
    """EVM gas configuration."""
    gas_limit: int
    max_fee_per_gas: int  # wei
    max_priority_fee_per_gas: int  # wei


@dataclass
class OptimizationResult:
    """Unified optimization result."""
    chain: str
    family: ChainFamily
    solana: Optional[SolanaComputeBudget] = None
    evm: Optional[EvmGasConfig] = None
    recommendations: Optional[List[str]] = None

    def __post_init__(self):
        if self.recommendations is None:
            self.recommendations = []


# ─── Constants ────────────────────────────────────────────────────────────────

SOLANA_DEFAULT_CU = 200_000
SOLANA_MAX_CU = 1_400_000
SOLANA_DEFAULT_PRIORITY_FEE = 1_000  # microlamports per CU

EVM_BASE_GAS_PRICE = 30_000_000_000  # 30 gwei in wei
ONE_GWEI = 1_000_000_000


# ─── Chain Database ────────────────────────────────────────────────────────────

CHAIN_CHARACTERISTICS: Dict[str, ChainCharacteristics] = {
    "solana": ChainCharacteristics(
        family=ChainFamily.SOLANA,
        block_time=0.4,
        has_eip1559=False,
        is_l2=False,
        cost_tier=1,
        native_token="SOL",
    ),
    "ethereum": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=12.0,
        has_eip1559=True,
        is_l2=False,
        cost_tier=5,
        native_token="ETH",
    ),
    "arbitrum": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=0.25,
        has_eip1559=True,
        is_l2=True,
        cost_tier=2,
        native_token="ETH",
    ),
    "optimism": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=2.0,
        has_eip1559=True,
        is_l2=True,
        cost_tier=2,
        native_token="ETH",
    ),
    "base": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=2.0,
        has_eip1559=True,
        is_l2=True,
        cost_tier=2,
        native_token="ETH",
    ),
    "polygon": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=2.0,
        has_eip1559=True,
        is_l2=True,
        cost_tier=2,
        native_token="MATIC",
    ),
    "bsc": ChainCharacteristics(
        family=ChainFamily.EVM,
        block_time=3.0,
        has_eip1559=False,
        is_l2=False,
        cost_tier=1,
        native_token="BNB",
    ),
    "near": ChainCharacteristics(
        family=ChainFamily.NEAR,
        block_time=1.0,
        has_eip1559=False,
        is_l2=False,
        cost_tier=1,
        native_token="NEAR",
    ),
}


def detect_chain_family(chain_id: str) -> ChainFamily:
    """Detect chain family from chain identifier."""
    normalized = chain_id.lower()

    if "solana" in normalized:
        return ChainFamily.SOLANA
    elif "near" in normalized:
        return ChainFamily.NEAR
    elif "bitcoin" in normalized or "btc" in normalized:
        return ChainFamily.BITCOIN
    elif "cosmos" in normalized or "osmosis" in normalized:
        return ChainFamily.COSMOS
    else:
        return ChainFamily.EVM  # Default


def get_chain_characteristics(chain_id: str) -> ChainCharacteristics:
    """Get chain characteristics."""
    lower_id = chain_id.lower()

    # Try direct lookup
    if lower_id in CHAIN_CHARACTERISTICS:
        return CHAIN_CHARACTERISTICS[lower_id]

    # Try base name
    base = lower_id.split("-")[0]
    if base in CHAIN_CHARACTERISTICS:
        return CHAIN_CHARACTERISTICS[base]

    # Default
    return ChainCharacteristics(
        family=detect_chain_family(chain_id),
        block_time=12.0,
        has_eip1559=True,
        is_l2=False,
        cost_tier=3,
        native_token="ETH",
    )


# ─── Solana Optimization ──────────────────────────────────────────────────────


def calculate_solana_budget(
    estimated_cu: int,
    profile: OptimizationProfile = OptimizationProfile.STANDARD,
    current_median_fee: Optional[int] = None,
) -> SolanaComputeBudget:
    """Calculate Solana compute budget configuration."""
    # Add 20% buffer
    units = min(int(estimated_cu * 1.2), SOLANA_MAX_CU)

    # Profile multipliers
    multipliers = {
        OptimizationProfile.ECONOMY: 0.5,
        OptimizationProfile.STANDARD: 1.0,
        OptimizationProfile.FAST: 2.0,
        OptimizationProfile.URGENT: 5.0,
    }
    multiplier = multipliers[profile]

    base_fee = current_median_fee or SOLANA_DEFAULT_PRIORITY_FEE
    microlamports_per_cu = max(int(base_fee * multiplier), 100)

    total_priority_fee_lamports = (units * microlamports_per_cu) // 1_000_000

    return SolanaComputeBudget(
        units=units,
        microlamports_per_cu=microlamports_per_cu,
        total_priority_fee_lamports=total_priority_fee_lamports,
    )


def estimate_solana_privacy_cu(
    transfer_count: int,
    creates_atas: bool = False,
    includes_memo: bool = True,
) -> int:
    """Estimate compute units for Solana privacy transaction."""
    cu = 5_000  # Base overhead
    cu += 300  # Compute budget instructions

    # Per transfer
    per_transfer = 35_000 if creates_atas else 10_000
    cu += per_transfer * transfer_count

    # Memo
    if includes_memo:
        cu += 500

    # Key derivation
    cu += 2_000

    return cu


# ─── EVM Optimization ─────────────────────────────────────────────────────────


def calculate_evm_gas(
    estimated_gas: int,
    profile: OptimizationProfile = OptimizationProfile.STANDARD,
    base_fee: Optional[int] = None,
) -> EvmGasConfig:
    """Calculate EVM gas configuration."""
    base = base_fee or EVM_BASE_GAS_PRICE

    # Profile multipliers
    multipliers = {
        OptimizationProfile.ECONOMY: 0.8,
        OptimizationProfile.STANDARD: 1.0,
        OptimizationProfile.FAST: 1.5,
        OptimizationProfile.URGENT: 2.5,
    }
    multiplier = multipliers[profile]

    base_priority = 2 * ONE_GWEI  # 2 gwei
    max_priority_fee_per_gas = int(base_priority * multiplier)
    max_fee_per_gas = base * 2 + max_priority_fee_per_gas

    # 20% buffer
    gas_limit = int(estimated_gas * 1.2)

    return EvmGasConfig(
        gas_limit=gas_limit,
        max_fee_per_gas=max_fee_per_gas,
        max_priority_fee_per_gas=max_priority_fee_per_gas,
    )


def estimate_evm_privacy_gas(
    transfer_count: int,
    includes_approval: bool = False,
    includes_announcement: bool = True,
) -> int:
    """Estimate gas for EVM privacy transaction."""
    gas = 21_000  # Base tx

    # ERC-20 transfers
    gas += 65_000 * transfer_count

    # Approval
    if includes_approval:
        gas += 46_000

    # Announcement
    if includes_announcement:
        gas += 80_000

    return gas


# ─── Unified Optimization ─────────────────────────────────────────────────────


def select_optimal_config(
    chain_id: str,
    profile: OptimizationProfile = OptimizationProfile.STANDARD,
    complexity: str = "medium",
) -> OptimizationResult:
    """
    Select optimal configuration based on chain.

    Args:
        chain_id: Target chain identifier
        profile: Optimization profile
        complexity: Transaction complexity ("simple", "medium", "complex")

    Returns:
        Unified optimization result
    """
    characteristics = get_chain_characteristics(chain_id)
    recommendations = []

    solana_config = None
    evm_config = None

    if characteristics.family == ChainFamily.SOLANA:
        cu_map = {"simple": 50_000, "medium": 150_000, "complex": 300_000}
        estimated_cu = cu_map.get(complexity, 150_000)
        solana_config = calculate_solana_budget(estimated_cu, profile)

        recommendations.append(
            "Solana: Use versioned transactions for complex operations"
        )
        if characteristics.cost_tier == 1:
            recommendations.append(
                "Solana: Very low cost - prioritize speed over savings"
            )

    elif characteristics.family == ChainFamily.EVM:
        gas_map = {"simple": 50_000, "medium": 150_000, "complex": 500_000}
        estimated_gas = gas_map.get(complexity, 150_000)
        evm_config = calculate_evm_gas(estimated_gas, profile)

        if characteristics.is_l2:
            recommendations.append(
                "L2: Lower fees, optimize calldata for L1 data costs"
            )

        if chain_id.lower() == "bsc":
            recommendations.append("BSC: Very low gas costs - use standard profile")

    else:
        recommendations.append(f"Chain {chain_id} not fully optimized yet")

    if characteristics.cost_tier >= 4:
        recommendations.append(
            f"High cost chain (tier {characteristics.cost_tier}) - consider L2 alternatives"
        )

    return OptimizationResult(
        chain=chain_id,
        family=characteristics.family,
        solana=solana_config,
        evm=evm_config,
        recommendations=recommendations,
    )


# ─── Cost Comparison ──────────────────────────────────────────────────────────


def compare_chain_costs(
    chains: List[str],
) -> List[Tuple[str, int, str]]:
    """
    Compare costs across chains.

    Returns:
        List of (chain, cost_tier, recommendation) sorted by cost
    """
    results = []
    for chain in chains:
        chars = get_chain_characteristics(chain)
        recommendations = {
            1: "Excellent - very low costs",
            2: "Good - affordable for frequent use",
            3: "Moderate - suitable for medium value txs",
            4: "Expensive - use for high value only",
            5: "Very expensive - consider alternatives",
        }
        rec = recommendations.get(chars.cost_tier, "Unknown")
        results.append((chain, chars.cost_tier, rec))

    return sorted(results, key=lambda x: x[1])


def recommend_cheapest_chain(
    chains: List[str],
    max_block_time: Optional[float] = None,
) -> Optional[str]:
    """Recommend cheapest viable chain."""
    viable = [
        chain
        for chain in chains
        if max_block_time is None
        or get_chain_characteristics(chain).block_time <= max_block_time
    ]

    if not viable:
        return None

    return min(
        viable,
        key=lambda c: get_chain_characteristics(c).cost_tier,
    )
