//! Chain-Specific Optimizations for SIP Protocol Rust SDK.
//!
//! Provides optimized configurations for different blockchains:
//! - Solana: Compute unit budgeting, priority fees
//! - Ethereum/EVM: Gas estimation, L2 optimizations
//! - Cross-chain cost comparison

use std::collections::HashMap;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Chain family for optimization selection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ChainFamily {
    Solana,
    Evm,
    Near,
    Bitcoin,
    Cosmos,
}

/// Optimization profile (cross-chain)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OptimizationProfile {
    /// Lowest fees, may be slower
    Economy,
    /// Balanced cost/speed
    Standard,
    /// Higher fees, faster confirmation
    Fast,
    /// Maximum priority
    Urgent,
}

impl Default for OptimizationProfile {
    fn default() -> Self {
        Self::Standard
    }
}

/// Chain characteristics for optimization decisions
#[derive(Debug, Clone)]
pub struct ChainCharacteristics {
    /// Chain family
    pub family: ChainFamily,
    /// Average block time in seconds
    pub block_time: f64,
    /// Whether chain has EIP-1559 style gas
    pub has_eip1559: bool,
    /// Whether chain is L2/rollup
    pub is_l2: bool,
    /// Relative cost tier (1=cheapest, 5=most expensive)
    pub cost_tier: u8,
    /// Native token symbol
    pub native_token: String,
}

/// Solana compute budget configuration
#[derive(Debug, Clone)]
pub struct SolanaComputeBudget {
    /// Compute units to request
    pub units: u32,
    /// Priority fee in microlamports per CU
    pub microlamports_per_cu: u64,
    /// Total priority fee in lamports
    pub total_priority_fee_lamports: u64,
}

/// EVM gas configuration
#[derive(Debug, Clone)]
pub struct EvmGasConfig {
    /// Gas limit
    pub gas_limit: u64,
    /// Max fee per gas (wei)
    pub max_fee_per_gas: u128,
    /// Max priority fee per gas (wei)
    pub max_priority_fee_per_gas: u128,
}

/// Unified optimization result
#[derive(Debug, Clone)]
pub struct OptimizationResult {
    /// Chain being optimized for
    pub chain: String,
    /// Chain family
    pub family: ChainFamily,
    /// Solana-specific config (if Solana)
    pub solana: Option<SolanaComputeBudget>,
    /// EVM-specific config (if EVM)
    pub evm: Option<EvmGasConfig>,
    /// Recommendations
    pub recommendations: Vec<String>,
}

// ─── Constants ────────────────────────────────────────────────────────────────

/// Default Solana compute units
pub const SOLANA_DEFAULT_CU: u32 = 200_000;

/// Maximum Solana compute units
pub const SOLANA_MAX_CU: u32 = 1_400_000;

/// Default Solana priority fee (microlamports per CU)
pub const SOLANA_DEFAULT_PRIORITY_FEE: u64 = 1_000;

/// EVM base gas price (30 gwei in wei)
pub const EVM_BASE_GAS_PRICE: u128 = 30_000_000_000;

/// One gwei in wei
pub const ONE_GWEI: u128 = 1_000_000_000;

// ─── Chain Detection ──────────────────────────────────────────────────────────

/// Detect chain family from chain identifier
pub fn detect_chain_family(chain_id: &str) -> ChainFamily {
    let normalized = chain_id.to_lowercase();

    if normalized.contains("solana") {
        ChainFamily::Solana
    } else if normalized.contains("near") {
        ChainFamily::Near
    } else if normalized.contains("bitcoin") || normalized.contains("btc") {
        ChainFamily::Bitcoin
    } else if normalized.contains("cosmos") || normalized.contains("osmosis") {
        ChainFamily::Cosmos
    } else {
        // Default to EVM (most common)
        ChainFamily::Evm
    }
}

/// Get chain characteristics
pub fn get_chain_characteristics(chain_id: &str) -> ChainCharacteristics {
    let family = detect_chain_family(chain_id);
    let normalized = chain_id.to_lowercase();

    match normalized.as_str() {
        "solana" | "solana-mainnet" | "solana-devnet" => ChainCharacteristics {
            family: ChainFamily::Solana,
            block_time: 0.4,
            has_eip1559: false,
            is_l2: false,
            cost_tier: 1,
            native_token: "SOL".to_string(),
        },
        "ethereum" | "mainnet" => ChainCharacteristics {
            family: ChainFamily::Evm,
            block_time: 12.0,
            has_eip1559: true,
            is_l2: false,
            cost_tier: 5,
            native_token: "ETH".to_string(),
        },
        "arbitrum" => ChainCharacteristics {
            family: ChainFamily::Evm,
            block_time: 0.25,
            has_eip1559: true,
            is_l2: true,
            cost_tier: 2,
            native_token: "ETH".to_string(),
        },
        "optimism" | "base" => ChainCharacteristics {
            family: ChainFamily::Evm,
            block_time: 2.0,
            has_eip1559: true,
            is_l2: true,
            cost_tier: 2,
            native_token: "ETH".to_string(),
        },
        "bsc" | "bnb" => ChainCharacteristics {
            family: ChainFamily::Evm,
            block_time: 3.0,
            has_eip1559: false,
            is_l2: false,
            cost_tier: 1,
            native_token: "BNB".to_string(),
        },
        "polygon" => ChainCharacteristics {
            family: ChainFamily::Evm,
            block_time: 2.0,
            has_eip1559: true,
            is_l2: true,
            cost_tier: 2,
            native_token: "MATIC".to_string(),
        },
        "near" | "near-mainnet" => ChainCharacteristics {
            family: ChainFamily::Near,
            block_time: 1.0,
            has_eip1559: false,
            is_l2: false,
            cost_tier: 1,
            native_token: "NEAR".to_string(),
        },
        _ => ChainCharacteristics {
            family,
            block_time: 12.0,
            has_eip1559: true,
            is_l2: false,
            cost_tier: 3,
            native_token: "ETH".to_string(),
        },
    }
}

// ─── Solana Optimization ──────────────────────────────────────────────────────

/// Calculate Solana compute budget
///
/// # Arguments
///
/// * `estimated_cu` - Estimated compute units needed
/// * `profile` - Optimization profile
/// * `current_median_fee` - Current median priority fee (optional)
///
/// # Returns
///
/// Compute budget configuration
pub fn calculate_solana_budget(
    estimated_cu: u32,
    profile: OptimizationProfile,
    current_median_fee: Option<u64>,
) -> SolanaComputeBudget {
    // Add 20% buffer
    let units = std::cmp::min((estimated_cu as f64 * 1.2) as u32, SOLANA_MAX_CU);

    // Profile multipliers
    let multiplier = match profile {
        OptimizationProfile::Economy => 0.5,
        OptimizationProfile::Standard => 1.0,
        OptimizationProfile::Fast => 2.0,
        OptimizationProfile::Urgent => 5.0,
    };

    let base_fee = current_median_fee.unwrap_or(SOLANA_DEFAULT_PRIORITY_FEE);
    let microlamports_per_cu = std::cmp::max((base_fee as f64 * multiplier) as u64, 100);

    let total_priority_fee_lamports = (units as u64 * microlamports_per_cu) / 1_000_000;

    SolanaComputeBudget {
        units,
        microlamports_per_cu,
        total_priority_fee_lamports,
    }
}

/// Estimate compute units for privacy transaction
pub fn estimate_solana_privacy_cu(
    transfer_count: u32,
    creates_atas: bool,
    includes_memo: bool,
) -> u32 {
    let mut cu = 5_000; // Base overhead
    cu += 300; // Compute budget instructions

    // Per transfer
    let per_transfer = if creates_atas { 35_000 } else { 10_000 };
    cu += per_transfer * transfer_count;

    // Memo
    if includes_memo {
        cu += 500;
    }

    // Key derivation
    cu += 2_000;

    cu
}

// ─── EVM Optimization ─────────────────────────────────────────────────────────

/// Calculate EVM gas configuration
///
/// # Arguments
///
/// * `estimated_gas` - Estimated gas needed
/// * `profile` - Optimization profile
/// * `base_fee` - Current base fee (wei)
///
/// # Returns
///
/// Gas configuration
pub fn calculate_evm_gas(
    estimated_gas: u64,
    profile: OptimizationProfile,
    base_fee: Option<u128>,
) -> EvmGasConfig {
    let base = base_fee.unwrap_or(EVM_BASE_GAS_PRICE);

    // Profile multipliers for priority fee
    let priority_multiplier = match profile {
        OptimizationProfile::Economy => 0.8,
        OptimizationProfile::Standard => 1.0,
        OptimizationProfile::Fast => 1.5,
        OptimizationProfile::Urgent => 2.5,
    };

    let base_priority = 2 * ONE_GWEI; // 2 gwei base
    let max_priority_fee_per_gas = (base_priority as f64 * priority_multiplier) as u128;
    let max_fee_per_gas = base * 2 + max_priority_fee_per_gas;

    // 20% buffer on gas limit
    let gas_limit = (estimated_gas as f64 * 1.2) as u64;

    EvmGasConfig {
        gas_limit,
        max_fee_per_gas,
        max_priority_fee_per_gas,
    }
}

/// Estimate gas for EVM privacy transaction
pub fn estimate_evm_privacy_gas(
    transfer_count: u32,
    includes_approval: bool,
    includes_announcement: bool,
) -> u64 {
    let mut gas: u64 = 21_000; // Base tx

    // ERC-20 transfers
    gas += 65_000 * transfer_count as u64;

    // Approval
    if includes_approval {
        gas += 46_000;
    }

    // Announcement
    if includes_announcement {
        gas += 80_000;
    }

    gas
}

// ─── Unified Optimization ─────────────────────────────────────────────────────

/// Select optimal configuration based on chain
///
/// # Arguments
///
/// * `chain_id` - Target chain identifier
/// * `profile` - Optimization profile
/// * `complexity` - Transaction complexity ("simple", "medium", "complex")
///
/// # Returns
///
/// Unified optimization result
pub fn select_optimal_config(
    chain_id: &str,
    profile: OptimizationProfile,
    complexity: &str,
) -> OptimizationResult {
    let characteristics = get_chain_characteristics(chain_id);
    let mut recommendations = Vec::new();

    let (solana, evm) = match characteristics.family {
        ChainFamily::Solana => {
            let estimated_cu = match complexity {
                "simple" => 50_000,
                "complex" => 300_000,
                _ => 150_000,
            };
            let budget = calculate_solana_budget(estimated_cu, profile, None);

            recommendations.push("Solana: Use versioned transactions for complex operations".to_string());
            if characteristics.cost_tier == 1 {
                recommendations.push("Solana: Very low cost - prioritize speed over savings".to_string());
            }

            (Some(budget), None)
        }
        ChainFamily::Evm => {
            let estimated_gas = match complexity {
                "simple" => 50_000,
                "complex" => 500_000,
                _ => 150_000,
            };
            let config = calculate_evm_gas(estimated_gas as u64, profile, None);

            if characteristics.is_l2 {
                recommendations.push("L2: Lower fees, optimize calldata for L1 data costs".to_string());
            }

            if chain_id == "bsc" {
                recommendations.push("BSC: Very low gas costs - use standard profile".to_string());
            }

            (None, Some(config))
        }
        _ => {
            recommendations.push(format!("Chain {} not fully optimized yet", chain_id));
            (None, None)
        }
    };

    if characteristics.cost_tier >= 4 {
        recommendations.push(format!(
            "High cost chain (tier {}) - consider L2 alternatives",
            characteristics.cost_tier
        ));
    }

    OptimizationResult {
        chain: chain_id.to_string(),
        family: characteristics.family,
        solana,
        evm,
        recommendations,
    }
}

// ─── Cost Comparison ──────────────────────────────────────────────────────────

/// Compare costs across chains
pub fn compare_chain_costs(chains: &[&str]) -> Vec<(String, u8, String)> {
    let mut results: Vec<_> = chains
        .iter()
        .map(|chain| {
            let chars = get_chain_characteristics(chain);
            let recommendation = match chars.cost_tier {
                1 => "Excellent - very low costs",
                2 => "Good - affordable for frequent use",
                3 => "Moderate - suitable for medium value txs",
                4 => "Expensive - use for high value only",
                _ => "Very expensive - consider alternatives",
            };
            (chain.to_string(), chars.cost_tier, recommendation.to_string())
        })
        .collect();

    results.sort_by_key(|(_, tier, _)| *tier);
    results
}

/// Recommend cheapest viable chain
pub fn recommend_cheapest_chain(
    chains: &[&str],
    max_block_time: Option<f64>,
) -> Option<String> {
    let viable: Vec<_> = chains
        .iter()
        .filter(|chain| {
            let chars = get_chain_characteristics(chain);
            max_block_time.map_or(true, |max| chars.block_time <= max)
        })
        .collect();

    viable
        .into_iter()
        .min_by_key(|chain| get_chain_characteristics(chain).cost_tier)
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_chain_family() {
        assert_eq!(detect_chain_family("solana"), ChainFamily::Solana);
        assert_eq!(detect_chain_family("ethereum"), ChainFamily::Evm);
        assert_eq!(detect_chain_family("arbitrum"), ChainFamily::Evm);
        assert_eq!(detect_chain_family("near"), ChainFamily::Near);
        assert_eq!(detect_chain_family("bitcoin"), ChainFamily::Bitcoin);
    }

    #[test]
    fn test_solana_budget() {
        let budget = calculate_solana_budget(100_000, OptimizationProfile::Standard, None);
        assert_eq!(budget.units, 120_000); // 20% buffer
        assert!(budget.microlamports_per_cu >= 100);
    }

    #[test]
    fn test_evm_gas() {
        let config = calculate_evm_gas(100_000, OptimizationProfile::Standard, None);
        assert_eq!(config.gas_limit, 120_000); // 20% buffer
        assert!(config.max_fee_per_gas > config.max_priority_fee_per_gas);
    }

    #[test]
    fn test_select_optimal_config() {
        let result = select_optimal_config("solana", OptimizationProfile::Standard, "medium");
        assert_eq!(result.family, ChainFamily::Solana);
        assert!(result.solana.is_some());
        assert!(result.evm.is_none());
    }

    #[test]
    fn test_compare_chain_costs() {
        let costs = compare_chain_costs(&["ethereum", "solana", "arbitrum", "bsc"]);
        // Solana and BSC should be cheapest (tier 1)
        assert!(costs[0].1 <= 2);
    }

    #[test]
    fn test_recommend_cheapest() {
        let chains = ["ethereum", "solana", "arbitrum", "bsc"];
        let cheapest = recommend_cheapest_chain(&chains, None);
        assert!(cheapest.is_some());
        // Should be solana or bsc (both tier 1)
        let result = cheapest.unwrap();
        assert!(result == "solana" || result == "bsc");
    }
}
