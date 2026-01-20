// Package sip provides chain-specific optimizations for the SIP Protocol.
package sip

import (
	"strings"
)

// ChainFamily represents the blockchain family.
type ChainFamily string

const (
	ChainFamilySolana  ChainFamily = "solana"
	ChainFamilyEVM     ChainFamily = "evm"
	ChainFamilyNear    ChainFamily = "near"
	ChainFamilyBitcoin ChainFamily = "bitcoin"
	ChainFamilyCosmos  ChainFamily = "cosmos"
)

// OptimizationProfile represents the optimization level.
type OptimizationProfile string

const (
	ProfileEconomy  OptimizationProfile = "economy"  // Lowest fees
	ProfileStandard OptimizationProfile = "standard" // Balanced
	ProfileFast     OptimizationProfile = "fast"     // Higher fees
	ProfileUrgent   OptimizationProfile = "urgent"   // Maximum priority
)

// ChainCharacteristics describes a chain's properties for optimization.
type ChainCharacteristics struct {
	Family      ChainFamily
	BlockTime   float64 // seconds
	HasEIP1559  bool
	IsL2        bool
	CostTier    int // 1=cheapest, 5=most expensive
	NativeToken string
}

// SolanaComputeBudget represents Solana compute budget configuration.
type SolanaComputeBudget struct {
	Units                    uint32
	MicrolamportsPerCU       uint64
	TotalPriorityFeeLamports uint64
}

// EVMGasConfig represents EVM gas configuration.
type EVMGasConfig struct {
	GasLimit             uint64
	MaxFeePerGas         uint64 // wei
	MaxPriorityFeePerGas uint64 // wei
}

// OptimizationResult is the unified optimization result.
type OptimizationResult struct {
	Chain           string
	Family          ChainFamily
	Solana          *SolanaComputeBudget
	EVM             *EVMGasConfig
	Recommendations []string
}

// Constants
const (
	SolanaDefaultCU          uint32 = 200_000
	SolanaMaxCU              uint32 = 1_400_000
	SolanaDefaultPriorityFee uint64 = 1_000

	EVMBaseGasPrice uint64 = 30_000_000_000 // 30 gwei
	OneGwei         uint64 = 1_000_000_000
)

// Chain characteristics database
var chainCharacteristics = map[string]ChainCharacteristics{
	"solana": {
		Family:      ChainFamilySolana,
		BlockTime:   0.4,
		HasEIP1559:  false,
		IsL2:        false,
		CostTier:    1,
		NativeToken: "SOL",
	},
	"ethereum": {
		Family:      ChainFamilyEVM,
		BlockTime:   12.0,
		HasEIP1559:  true,
		IsL2:        false,
		CostTier:    5,
		NativeToken: "ETH",
	},
	"arbitrum": {
		Family:      ChainFamilyEVM,
		BlockTime:   0.25,
		HasEIP1559:  true,
		IsL2:        true,
		CostTier:    2,
		NativeToken: "ETH",
	},
	"optimism": {
		Family:      ChainFamilyEVM,
		BlockTime:   2.0,
		HasEIP1559:  true,
		IsL2:        true,
		CostTier:    2,
		NativeToken: "ETH",
	},
	"base": {
		Family:      ChainFamilyEVM,
		BlockTime:   2.0,
		HasEIP1559:  true,
		IsL2:        true,
		CostTier:    2,
		NativeToken: "ETH",
	},
	"polygon": {
		Family:      ChainFamilyEVM,
		BlockTime:   2.0,
		HasEIP1559:  true,
		IsL2:        true,
		CostTier:    2,
		NativeToken: "MATIC",
	},
	"bsc": {
		Family:      ChainFamilyEVM,
		BlockTime:   3.0,
		HasEIP1559:  false,
		IsL2:        false,
		CostTier:    1,
		NativeToken: "BNB",
	},
	"near": {
		Family:      ChainFamilyNear,
		BlockTime:   1.0,
		HasEIP1559:  false,
		IsL2:        false,
		CostTier:    1,
		NativeToken: "NEAR",
	},
}

// DetectChainFamily detects chain family from chain identifier.
func DetectChainFamily(chainID string) ChainFamily {
	normalized := strings.ToLower(chainID)

	if strings.Contains(normalized, "solana") {
		return ChainFamilySolana
	}
	if strings.Contains(normalized, "near") {
		return ChainFamilyNear
	}
	if strings.Contains(normalized, "bitcoin") || strings.Contains(normalized, "btc") {
		return ChainFamilyBitcoin
	}
	if strings.Contains(normalized, "cosmos") || strings.Contains(normalized, "osmosis") {
		return ChainFamilyCosmos
	}
	return ChainFamilyEVM // Default
}

// GetChainCharacteristics returns characteristics for a chain.
func GetChainCharacteristics(chainID string) ChainCharacteristics {
	normalized := strings.ToLower(chainID)

	if chars, ok := chainCharacteristics[normalized]; ok {
		return chars
	}

	// Try base name
	parts := strings.Split(normalized, "-")
	if len(parts) > 0 {
		if chars, ok := chainCharacteristics[parts[0]]; ok {
			return chars
		}
	}

	// Default
	return ChainCharacteristics{
		Family:      DetectChainFamily(chainID),
		BlockTime:   12.0,
		HasEIP1559:  true,
		IsL2:        false,
		CostTier:    3,
		NativeToken: "ETH",
	}
}

// CalculateSolanaBudget calculates Solana compute budget configuration.
func CalculateSolanaBudget(estimatedCU uint32, profile OptimizationProfile, currentMedianFee *uint64) SolanaComputeBudget {
	// Add 20% buffer
	units := uint32(float64(estimatedCU) * 1.2)
	if units > SolanaMaxCU {
		units = SolanaMaxCU
	}

	// Profile multipliers
	multipliers := map[OptimizationProfile]float64{
		ProfileEconomy:  0.5,
		ProfileStandard: 1.0,
		ProfileFast:     2.0,
		ProfileUrgent:   5.0,
	}
	multiplier := multipliers[profile]

	baseFee := SolanaDefaultPriorityFee
	if currentMedianFee != nil {
		baseFee = *currentMedianFee
	}

	microlamportsPerCU := uint64(float64(baseFee) * multiplier)
	if microlamportsPerCU < 100 {
		microlamportsPerCU = 100
	}

	totalPriorityFeeLamports := (uint64(units) * microlamportsPerCU) / 1_000_000

	return SolanaComputeBudget{
		Units:                    units,
		MicrolamportsPerCU:       microlamportsPerCU,
		TotalPriorityFeeLamports: totalPriorityFeeLamports,
	}
}

// EstimateSolanaPrivacyCU estimates compute units for Solana privacy transaction.
func EstimateSolanaPrivacyCU(transferCount int, createsATAs, includesMemo bool) uint32 {
	cu := uint32(5_000)  // Base overhead
	cu += 300            // Compute budget instructions

	perTransfer := uint32(10_000)
	if createsATAs {
		perTransfer = 35_000
	}
	cu += perTransfer * uint32(transferCount)

	if includesMemo {
		cu += 500
	}

	cu += 2_000 // Key derivation

	return cu
}

// CalculateEVMGas calculates EVM gas configuration.
func CalculateEVMGas(estimatedGas uint64, profile OptimizationProfile, baseFee *uint64) EVMGasConfig {
	base := EVMBaseGasPrice
	if baseFee != nil {
		base = *baseFee
	}

	multipliers := map[OptimizationProfile]float64{
		ProfileEconomy:  0.8,
		ProfileStandard: 1.0,
		ProfileFast:     1.5,
		ProfileUrgent:   2.5,
	}
	multiplier := multipliers[profile]

	basePriority := 2 * OneGwei
	maxPriorityFeePerGas := uint64(float64(basePriority) * multiplier)
	maxFeePerGas := base*2 + maxPriorityFeePerGas

	// 20% buffer
	gasLimit := uint64(float64(estimatedGas) * 1.2)

	return EVMGasConfig{
		GasLimit:             gasLimit,
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
	}
}

// EstimateEVMPrivacyGas estimates gas for EVM privacy transaction.
func EstimateEVMPrivacyGas(transferCount int, includesApproval, includesAnnouncement bool) uint64 {
	gas := uint64(21_000) // Base tx

	gas += 65_000 * uint64(transferCount)

	if includesApproval {
		gas += 46_000
	}

	if includesAnnouncement {
		gas += 80_000
	}

	return gas
}

// SelectOptimalConfig selects optimal configuration based on chain.
func SelectOptimalConfig(chainID string, profile OptimizationProfile, complexity string) OptimizationResult {
	characteristics := GetChainCharacteristics(chainID)
	recommendations := []string{}

	var solanaBudget *SolanaComputeBudget
	var evmConfig *EVMGasConfig

	switch characteristics.Family {
	case ChainFamilySolana:
		cuMap := map[string]uint32{
			"simple":  50_000,
			"medium":  150_000,
			"complex": 300_000,
		}
		estimatedCU := cuMap["medium"]
		if cu, ok := cuMap[complexity]; ok {
			estimatedCU = cu
		}

		budget := CalculateSolanaBudget(estimatedCU, profile, nil)
		solanaBudget = &budget

		recommendations = append(recommendations, "Solana: Use versioned transactions for complex operations")
		if characteristics.CostTier == 1 {
			recommendations = append(recommendations, "Solana: Very low cost - prioritize speed over savings")
		}

	case ChainFamilyEVM:
		gasMap := map[string]uint64{
			"simple":  50_000,
			"medium":  150_000,
			"complex": 500_000,
		}
		estimatedGas := gasMap["medium"]
		if gas, ok := gasMap[complexity]; ok {
			estimatedGas = gas
		}

		config := CalculateEVMGas(estimatedGas, profile, nil)
		evmConfig = &config

		if characteristics.IsL2 {
			recommendations = append(recommendations, "L2: Lower fees, optimize calldata for L1 data costs")
		}

		if strings.ToLower(chainID) == "bsc" {
			recommendations = append(recommendations, "BSC: Very low gas costs - use standard profile")
		}

	default:
		recommendations = append(recommendations, "Chain "+chainID+" not fully optimized yet")
	}

	if characteristics.CostTier >= 4 {
		recommendations = append(recommendations, "High cost chain - consider L2 alternatives")
	}

	return OptimizationResult{
		Chain:           chainID,
		Family:          characteristics.Family,
		Solana:          solanaBudget,
		EVM:             evmConfig,
		Recommendations: recommendations,
	}
}

// ChainCostComparison represents a cost comparison result.
type ChainCostComparison struct {
	Chain          string
	CostTier       int
	Recommendation string
}

// CompareChainCosts compares costs across chains.
func CompareChainCosts(chains []string) []ChainCostComparison {
	results := make([]ChainCostComparison, 0, len(chains))

	recommendations := map[int]string{
		1: "Excellent - very low costs",
		2: "Good - affordable for frequent use",
		3: "Moderate - suitable for medium value txs",
		4: "Expensive - use for high value only",
		5: "Very expensive - consider alternatives",
	}

	for _, chain := range chains {
		chars := GetChainCharacteristics(chain)
		rec := recommendations[chars.CostTier]
		if rec == "" {
			rec = "Unknown"
		}

		results = append(results, ChainCostComparison{
			Chain:          chain,
			CostTier:       chars.CostTier,
			Recommendation: rec,
		})
	}

	// Sort by cost tier (simple bubble sort)
	for i := 0; i < len(results)-1; i++ {
		for j := 0; j < len(results)-i-1; j++ {
			if results[j].CostTier > results[j+1].CostTier {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}

	return results
}

// RecommendCheapestChain recommends the cheapest viable chain.
func RecommendCheapestChain(chains []string, maxBlockTime *float64) string {
	var cheapest string
	cheapestTier := 999

	for _, chain := range chains {
		chars := GetChainCharacteristics(chain)

		if maxBlockTime != nil && chars.BlockTime > *maxBlockTime {
			continue
		}

		if chars.CostTier < cheapestTier {
			cheapestTier = chars.CostTier
			cheapest = chain
		}
	}

	return cheapest
}
