import React, { useState, useCallback, useId, useMemo } from 'react'

/**
 * Privacy level options for Ethereum
 */
export type EthereumPrivacyLevel = 'public' | 'stealth' | 'compliant'

/**
 * Supported Ethereum networks
 */
export type EthereumNetworkId =
  | 'mainnet'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  | 'sepolia'

/**
 * Gas estimate for Ethereum privacy operations
 */
export interface EthereumGasEstimate {
  /** Gas units required */
  gasUnits: bigint
  /** Gas price in gwei */
  gasPriceGwei: number
  /** Total cost in ETH */
  costEth: string
  /** Approximate cost in USD */
  costUsd?: string
  /** L1 data cost (for L2s) */
  l1DataCost?: string
}

/**
 * Network-specific gas configuration
 */
export interface NetworkGasConfig {
  network: EthereumNetworkId
  displayName: string
  nativeSymbol: string
  gasMultiplier: number
  isL2: boolean
}

/**
 * Privacy level metadata for Ethereum
 */
export interface EthereumPrivacyLevelInfo {
  level: EthereumPrivacyLevel
  label: string
  description: string
  eipReference?: string
  icon: React.ReactNode
  gasEstimate?: EthereumGasEstimate
}

/**
 * EthereumPrivacyToggle component props
 */
export interface EthereumPrivacyToggleProps {
  /** Current privacy level (controlled mode) */
  value?: EthereumPrivacyLevel
  /** Default privacy level (uncontrolled mode) */
  defaultValue?: EthereumPrivacyLevel
  /** Callback when privacy level changes */
  onChange?: (level: EthereumPrivacyLevel) => void
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Network for gas estimates */
  network?: EthereumNetworkId
  /** Custom gas estimates */
  gasEstimates?: Partial<Record<EthereumPrivacyLevel, EthereumGasEstimate>>
  /** Show gas/fee estimates */
  showGasEstimate?: boolean
  /** Show EIP references */
  showEipReferences?: boolean
  /** Show tooltips */
  showTooltips?: boolean
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Compact mode (icon only) */
  compact?: boolean
  /** Show L2 savings badge */
  showL2Savings?: boolean
  /** Aria label for the toggle group */
  'aria-label'?: string
}

/**
 * Network configuration defaults
 */
const NETWORK_CONFIGS: Record<EthereumNetworkId, NetworkGasConfig> = {
  mainnet: {
    network: 'mainnet',
    displayName: 'Ethereum',
    nativeSymbol: 'ETH',
    gasMultiplier: 1,
    isL2: false,
  },
  arbitrum: {
    network: 'arbitrum',
    displayName: 'Arbitrum',
    nativeSymbol: 'ETH',
    gasMultiplier: 0.01,
    isL2: true,
  },
  optimism: {
    network: 'optimism',
    displayName: 'Optimism',
    nativeSymbol: 'ETH',
    gasMultiplier: 0.01,
    isL2: true,
  },
  base: {
    network: 'base',
    displayName: 'Base',
    nativeSymbol: 'ETH',
    gasMultiplier: 0.005,
    isL2: true,
  },
  polygon: {
    network: 'polygon',
    displayName: 'Polygon',
    nativeSymbol: 'MATIC',
    gasMultiplier: 0.02,
    isL2: true,
  },
  sepolia: {
    network: 'sepolia',
    displayName: 'Sepolia',
    nativeSymbol: 'ETH',
    gasMultiplier: 0,
    isL2: false,
  },
}

/**
 * Default gas estimates for privacy operations (mainnet)
 */
const DEFAULT_GAS_ESTIMATES: Record<EthereumPrivacyLevel, { gasUnits: bigint; description: string }> = {
  public: {
    gasUnits: 21000n,
    description: 'Standard ETH transfer',
  },
  stealth: {
    gasUnits: 85000n,
    description: 'Stealth address transfer (EIP-5564)',
  },
  compliant: {
    gasUnits: 120000n,
    description: 'Stealth + viewing key announcement',
  },
}

/**
 * Default privacy level descriptions for Ethereum
 */
const DEFAULT_LEVEL_INFO: Record<EthereumPrivacyLevel, Omit<EthereumPrivacyLevelInfo, 'level' | 'gasEstimate'>> = {
  public: {
    label: 'Public',
    description: 'Standard transaction. Sender, recipient, and amount visible on-chain.',
    eipReference: undefined,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-eth-privacy-icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  stealth: {
    label: 'Stealth',
    description: 'Full privacy using EIP-5564 stealth addresses. Recipient hidden, only they can discover.',
    eipReference: 'EIP-5564',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-eth-privacy-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 11v4M12 7h.01" />
      </svg>
    ),
  },
  compliant: {
    label: 'Compliant',
    description: 'Privacy with audit trail. Stealth addresses + viewing keys for authorized disclosure.',
    eipReference: 'EIP-5564 + EIP-6538',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-eth-privacy-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
}

/**
 * CSS styles for the component
 */
const styles = `
.sip-eth-privacy-toggle {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  font-family: system-ui, -apple-system, sans-serif;
}

.sip-eth-privacy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.sip-eth-privacy-network-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.sip-eth-privacy-network-badge[data-l2="true"] {
  background: #dbeafe;
  color: #1d4ed8;
}

.sip-eth-privacy-toggle-group {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}

.sip-eth-privacy-toggle-group[data-size="sm"] {
  padding: 2px;
  gap: 2px;
  border-radius: 8px;
}

.sip-eth-privacy-toggle-group[data-size="lg"] {
  padding: 6px;
  gap: 6px;
  border-radius: 16px;
}

.sip-eth-privacy-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  transition: all 0.2s ease;
  outline: none;
}

.sip-eth-privacy-option[data-compact="true"] {
  padding: 8px;
}

.sip-eth-privacy-option[data-size="sm"] {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
}

.sip-eth-privacy-option[data-size="lg"] {
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 12px;
}

.sip-eth-privacy-option:hover:not(:disabled) {
  color: #374151;
  background: rgba(0, 0, 0, 0.05);
}

.sip-eth-privacy-option:focus-visible {
  box-shadow: 0 0 0 2px #3b82f6;
}

.sip-eth-privacy-option[aria-checked="true"] {
  background: white;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sip-eth-privacy-option[aria-checked="true"][data-level="public"] {
  color: #6b7280;
}

.sip-eth-privacy-option[aria-checked="true"][data-level="stealth"] {
  color: #7c3aed;
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
}

.sip-eth-privacy-option[aria-checked="true"][data-level="compliant"] {
  color: #059669;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
}

.sip-eth-privacy-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sip-eth-privacy-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.sip-eth-privacy-option[data-size="sm"] .sip-eth-privacy-icon {
  width: 14px;
  height: 14px;
}

.sip-eth-privacy-option[data-size="lg"] .sip-eth-privacy-icon {
  width: 20px;
  height: 20px;
}

.sip-eth-privacy-eip-badge {
  display: inline-flex;
  padding: 1px 4px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 9px;
  font-weight: 600;
  border-radius: 2px;
  margin-left: 4px;
}

.sip-eth-privacy-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: #1f2937;
  color: white;
  font-size: 12px;
  font-weight: 400;
  border-radius: 6px;
  white-space: nowrap;
  max-width: 280px;
  white-space: normal;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 10;
  pointer-events: none;
}

.sip-eth-privacy-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.sip-eth-privacy-option:hover .sip-eth-privacy-tooltip,
.sip-eth-privacy-option:focus .sip-eth-privacy-tooltip {
  opacity: 1;
  visibility: visible;
}

.sip-eth-privacy-gas-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
  padding: 0 4px;
}

.sip-eth-privacy-gas-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.sip-eth-privacy-gas-badge[data-level="stealth"],
.sip-eth-privacy-gas-badge[data-level="compliant"] {
  background: #fef3c7;
  color: #92400e;
}

.sip-eth-privacy-l2-savings {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #d1fae5;
  color: #047857;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
}

.sip-eth-privacy-gas-units {
  color: #9ca3af;
  font-size: 10px;
}

@keyframes sip-eth-privacy-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.sip-eth-privacy-option[aria-checked="true"] {
  animation: sip-eth-privacy-pulse 0.3s ease;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .sip-eth-privacy-toggle-group {
    background: #374151;
  }

  .sip-eth-privacy-header {
    color: #9ca3af;
  }

  .sip-eth-privacy-network-badge {
    background: #4b5563;
    color: #d1d5db;
  }

  .sip-eth-privacy-network-badge[data-l2="true"] {
    background: #1e3a5f;
    color: #93c5fd;
  }

  .sip-eth-privacy-option {
    color: #9ca3af;
  }

  .sip-eth-privacy-option:hover:not(:disabled) {
    color: #e5e7eb;
    background: rgba(255, 255, 255, 0.05);
  }

  .sip-eth-privacy-option[aria-checked="true"] {
    background: #4b5563;
    color: #f9fafb;
  }

  .sip-eth-privacy-option[aria-checked="true"][data-level="stealth"] {
    background: linear-gradient(135deg, #2e1065 0%, #4c1d95 100%);
    color: #c4b5fd;
  }

  .sip-eth-privacy-option[aria-checked="true"][data-level="compliant"] {
    background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
    color: #6ee7b7;
  }

  .sip-eth-privacy-gas-info {
    color: #9ca3af;
  }

  .sip-eth-privacy-gas-badge {
    background: #374151;
    color: #d1d5db;
  }

  .sip-eth-privacy-eip-badge {
    background: #312e81;
    color: #a5b4fc;
  }
}
`

/**
 * Calculate gas estimate for a given network and level
 */
function calculateGasEstimate(
  level: EthereumPrivacyLevel,
  network: EthereumNetworkId,
  gasPriceGwei: number = 30
): EthereumGasEstimate {
  const config = NETWORK_CONFIGS[network]
  const baseEstimate = DEFAULT_GAS_ESTIMATES[level]

  const gasUnits = baseEstimate.gasUnits
  const effectiveGasPrice = gasPriceGwei * config.gasMultiplier || gasPriceGwei

  // Cost in ETH = gasUnits * gasPriceGwei / 1e9
  const costWei = gasUnits * BigInt(Math.floor(effectiveGasPrice * 1e9))
  const costEth = Number(costWei) / 1e18

  return {
    gasUnits,
    gasPriceGwei: effectiveGasPrice,
    costEth: costEth.toFixed(6),
    costUsd: undefined, // Would need price feed
    l1DataCost: config.isL2 ? '~$0.01' : undefined,
  }
}

/**
 * EthereumPrivacyToggle - Toggle for selecting Ethereum privacy level
 *
 * A three-state toggle for EIP-5564 stealth address privacy on Ethereum and L2s.
 * Shows gas estimates, L2 savings, and EIP references.
 *
 * @example Basic usage
 * ```tsx
 * import { EthereumPrivacyToggle } from '@sip-protocol/react'
 *
 * function SendForm() {
 *   const [privacy, setPrivacy] = useState<EthereumPrivacyLevel>('stealth')
 *
 *   return (
 *     <EthereumPrivacyToggle
 *       value={privacy}
 *       onChange={setPrivacy}
 *       network="base"
 *     />
 *   )
 * }
 * ```
 *
 * @example With gas estimates and L2 savings
 * ```tsx
 * <EthereumPrivacyToggle
 *   value={privacy}
 *   onChange={setPrivacy}
 *   network="arbitrum"
 *   showGasEstimate
 *   showL2Savings
 * />
 * ```
 *
 * @example Compact mode for toolbars
 * ```tsx
 * <EthereumPrivacyToggle
 *   value={privacy}
 *   onChange={setPrivacy}
 *   compact
 *   size="sm"
 * />
 * ```
 */
export function EthereumPrivacyToggle({
  value,
  defaultValue = 'stealth',
  onChange,
  disabled = false,
  network = 'mainnet',
  gasEstimates,
  showGasEstimate = false,
  showEipReferences = true,
  showTooltips = true,
  className = '',
  size = 'md',
  compact = false,
  showL2Savings = false,
  'aria-label': ariaLabel = 'Ethereum privacy level',
}: EthereumPrivacyToggleProps) {
  const baseId = useId()

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState<EthereumPrivacyLevel>(defaultValue)

  // Determine if controlled or uncontrolled
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  // Get network config
  const networkConfig = NETWORK_CONFIGS[network]

  // Calculate gas estimates
  const computedGasEstimates = useMemo(() => {
    if (gasEstimates) return gasEstimates

    return {
      public: calculateGasEstimate('public', network),
      stealth: calculateGasEstimate('stealth', network),
      compliant: calculateGasEstimate('compliant', network),
    }
  }, [gasEstimates, network])

  // Handle selection change
  const handleSelect = useCallback(
    (level: EthereumPrivacyLevel) => {
      if (disabled) return

      if (!isControlled) {
        setInternalValue(level)
      }

      onChange?.(level)
    },
    [disabled, isControlled, onChange]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentLevel: EthereumPrivacyLevel) => {
      const levels: EthereumPrivacyLevel[] = ['public', 'stealth', 'compliant']
      const currentIndex = levels.indexOf(currentLevel)

      let newIndex = currentIndex

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          newIndex = (currentIndex + 1) % levels.length
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          newIndex = (currentIndex - 1 + levels.length) % levels.length
          break
        case 'Home':
          event.preventDefault()
          newIndex = 0
          break
        case 'End':
          event.preventDefault()
          newIndex = levels.length - 1
          break
        default:
          return
      }

      handleSelect(levels[newIndex])
    },
    [handleSelect]
  )

  // Build level info with gas estimates
  const levelInfos: EthereumPrivacyLevelInfo[] = useMemo(
    () =>
      (['public', 'stealth', 'compliant'] as EthereumPrivacyLevel[]).map((level) => ({
        level,
        ...DEFAULT_LEVEL_INFO[level],
        gasEstimate: computedGasEstimates?.[level],
      })),
    [computedGasEstimates]
  )

  // Calculate L2 savings percentage
  const l2SavingsPercent = useMemo(() => {
    if (!networkConfig.isL2) return null
    const savings = Math.round((1 - networkConfig.gasMultiplier) * 100)
    return savings > 0 ? savings : null
  }, [networkConfig])

  return (
    <>
      <style>{styles}</style>

      <div
        className={`sip-eth-privacy-toggle ${className}`}
        data-network={network}
      >
        {/* Header with network info */}
        <div className="sip-eth-privacy-header">
          <span>Privacy Level</span>
          <span
            className="sip-eth-privacy-network-badge"
            data-l2={networkConfig.isL2}
          >
            {networkConfig.displayName}
            {showL2Savings && l2SavingsPercent && (
              <span className="sip-eth-privacy-l2-savings">
                {l2SavingsPercent}% cheaper
              </span>
            )}
          </span>
        </div>

        {/* Toggle group */}
        <div
          role="radiogroup"
          aria-label={ariaLabel}
          className="sip-eth-privacy-toggle-group"
          data-size={size}
        >
          {levelInfos.map((info) => {
            const isSelected = currentValue === info.level
            const optionId = `${baseId}-${info.level}`

            return (
              <button
                key={info.level}
                id={optionId}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${info.label}: ${info.description}`}
                disabled={disabled}
                onClick={() => handleSelect(info.level)}
                onKeyDown={(e) => handleKeyDown(e, info.level)}
                tabIndex={isSelected ? 0 : -1}
                className="sip-eth-privacy-option"
                data-level={info.level}
                data-size={size}
                data-compact={compact}
              >
                {info.icon}
                {!compact && (
                  <>
                    <span>{info.label}</span>
                    {showEipReferences && info.eipReference && (
                      <span className="sip-eth-privacy-eip-badge">
                        {info.eipReference}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip */}
                {showTooltips && (
                  <span className="sip-eth-privacy-tooltip" role="tooltip">
                    {info.description}
                    {info.eipReference && (
                      <span style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
                        Standard: {info.eipReference}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Gas estimate info */}
        {showGasEstimate && computedGasEstimates && (
          <div className="sip-eth-privacy-gas-info" aria-live="polite">
            <span>Est. gas:</span>
            <span
              className="sip-eth-privacy-gas-badge"
              data-level={currentValue}
            >
              ~{computedGasEstimates[currentValue]?.costEth ?? '?'} {networkConfig.nativeSymbol}
              {computedGasEstimates[currentValue]?.costUsd && (
                <span> (~${computedGasEstimates[currentValue]?.costUsd})</span>
              )}
            </span>
            <span className="sip-eth-privacy-gas-units">
              {computedGasEstimates[currentValue]?.gasUnits?.toString() ?? '?'} units
            </span>
            {networkConfig.isL2 && computedGasEstimates[currentValue]?.l1DataCost && (
              <span style={{ fontSize: 10, color: '#9ca3af' }}>
                +{computedGasEstimates[currentValue]?.l1DataCost} L1 data
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Hook to use with EthereumPrivacyToggle for managing privacy state
 */
export function useEthereumPrivacyToggle(initialValue: EthereumPrivacyLevel = 'stealth') {
  const [privacyLevel, setPrivacyLevel] = useState<EthereumPrivacyLevel>(initialValue)

  const isPrivate = privacyLevel !== 'public'
  const isCompliant = privacyLevel === 'compliant'
  const isStealth = privacyLevel === 'stealth'

  const setPublic = useCallback(() => setPrivacyLevel('public'), [])
  const setStealth = useCallback(() => setPrivacyLevel('stealth'), [])
  const setCompliant = useCallback(() => setPrivacyLevel('compliant'), [])

  // Get EIP standard for current level
  const eipStandard = useMemo(() => {
    switch (privacyLevel) {
      case 'stealth':
        return 'EIP-5564'
      case 'compliant':
        return 'EIP-5564 + EIP-6538'
      default:
        return null
    }
  }, [privacyLevel])

  return {
    privacyLevel,
    setPrivacyLevel,
    isPrivate,
    isCompliant,
    isStealth,
    setPublic,
    setStealth,
    setCompliant,
    eipStandard,
  }
}

export default EthereumPrivacyToggle
