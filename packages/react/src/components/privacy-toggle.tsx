import React, { useState, useCallback, useId, useMemo } from 'react'

/**
 * Privacy level options
 */
export type PrivacyLevel = 'off' | 'shielded' | 'compliant'

/**
 * Gas estimate for different privacy levels
 */
export interface GasEstimate {
  /** Gas in native units (e.g., yoctoNEAR, gwei) */
  gas: string
  /** Formatted cost in native token */
  cost: string
  /** Formatted cost in USD (optional) */
  costUsd?: string
}

/**
 * Privacy level metadata
 */
export interface PrivacyLevelInfo {
  level: PrivacyLevel
  label: string
  description: string
  icon: React.ReactNode
  gasEstimate?: GasEstimate
}

/**
 * PrivacyToggle component props
 */
export interface PrivacyToggleProps {
  /** Current privacy level (controlled mode) */
  value?: PrivacyLevel
  /** Default privacy level (uncontrolled mode) */
  defaultValue?: PrivacyLevel
  /** Callback when privacy level changes */
  onChange?: (level: PrivacyLevel) => void
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Gas estimates for each level */
  gasEstimates?: Partial<Record<PrivacyLevel, GasEstimate>>
  /** Show gas/fee difference */
  showGasEstimate?: boolean
  /** Show tooltips */
  showTooltips?: boolean
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Chain identifier for context */
  chain?: string
  /** Aria label for the toggle group */
  'aria-label'?: string
}

/**
 * Default privacy level descriptions
 */
const DEFAULT_LEVEL_INFO: Record<PrivacyLevel, Omit<PrivacyLevelInfo, 'level' | 'gasEstimate'>> = {
  off: {
    label: 'Public',
    description: 'Transaction details are fully visible on-chain. Sender, recipient, and amount are public.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-privacy-icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  shielded: {
    label: 'Shielded',
    description: 'Full privacy. Sender, recipient, and amount are hidden using stealth addresses and commitments.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-privacy-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  compliant: {
    label: 'Compliant',
    description: 'Privacy with viewing keys. Transaction is shielded but can be audited by authorized parties.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sip-privacy-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
}

/**
 * CSS styles for the component (can be overridden via className)
 */
const styles = `
.sip-privacy-toggle {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  font-family: system-ui, -apple-system, sans-serif;
}

.sip-privacy-toggle-group {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
}

.sip-privacy-toggle-group[data-size="sm"] {
  padding: 2px;
  gap: 2px;
  border-radius: 8px;
}

.sip-privacy-toggle-group[data-size="lg"] {
  padding: 6px;
  gap: 6px;
  border-radius: 16px;
}

.sip-privacy-option {
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

.sip-privacy-option[data-size="sm"] {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
}

.sip-privacy-option[data-size="lg"] {
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 12px;
}

.sip-privacy-option:hover:not(:disabled) {
  color: #374151;
  background: rgba(0, 0, 0, 0.05);
}

.sip-privacy-option:focus-visible {
  box-shadow: 0 0 0 2px #3b82f6;
}

.sip-privacy-option[aria-checked="true"] {
  background: white;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.sip-privacy-option[aria-checked="true"][data-level="off"] {
  color: #6b7280;
}

.sip-privacy-option[aria-checked="true"][data-level="shielded"] {
  color: #059669;
}

.sip-privacy-option[aria-checked="true"][data-level="compliant"] {
  color: #2563eb;
}

.sip-privacy-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sip-privacy-icon {
  width: 16px;
  height: 16px;
}

.sip-privacy-option[data-size="sm"] .sip-privacy-icon {
  width: 14px;
  height: 14px;
}

.sip-privacy-option[data-size="lg"] .sip-privacy-icon {
  width: 20px;
  height: 20px;
}

.sip-privacy-tooltip {
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
  max-width: 250px;
  white-space: normal;
  text-align: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 10;
  pointer-events: none;
}

.sip-privacy-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.sip-privacy-option:hover .sip-privacy-tooltip,
.sip-privacy-option:focus .sip-privacy-tooltip {
  opacity: 1;
  visibility: visible;
}

.sip-privacy-gas-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
  padding: 0 4px;
}

.sip-privacy-gas-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 11px;
}

.sip-privacy-gas-badge[data-level="shielded"],
.sip-privacy-gas-badge[data-level="compliant"] {
  background: #fef3c7;
  color: #92400e;
}

@keyframes sip-privacy-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.sip-privacy-option[aria-checked="true"] {
  animation: sip-privacy-pulse 0.3s ease;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .sip-privacy-toggle-group {
    background: #374151;
  }

  .sip-privacy-option {
    color: #9ca3af;
  }

  .sip-privacy-option:hover:not(:disabled) {
    color: #e5e7eb;
    background: rgba(255, 255, 255, 0.05);
  }

  .sip-privacy-option[aria-checked="true"] {
    background: #4b5563;
    color: #f9fafb;
  }

  .sip-privacy-gas-info {
    color: #9ca3af;
  }

  .sip-privacy-gas-badge {
    background: #374151;
    color: #d1d5db;
  }
}
`

/**
 * PrivacyToggle - Toggle component for selecting privacy level
 *
 * A three-state toggle for controlling transaction privacy on NEAR and other chains.
 * Supports controlled and uncontrolled modes, accessibility features, and gas estimates.
 *
 * @example Basic usage
 * ```tsx
 * import { PrivacyToggle } from '@sip-protocol/react'
 *
 * function SendForm() {
 *   const [privacy, setPrivacy] = useState<PrivacyLevel>('shielded')
 *
 *   return (
 *     <PrivacyToggle
 *       value={privacy}
 *       onChange={setPrivacy}
 *     />
 *   )
 * }
 * ```
 *
 * @example With gas estimates
 * ```tsx
 * <PrivacyToggle
 *   value={privacy}
 *   onChange={setPrivacy}
 *   showGasEstimate
 *   gasEstimates={{
 *     off: { gas: '2500000000000', cost: '0.00025 NEAR' },
 *     shielded: { gas: '30000000000000', cost: '0.003 NEAR' },
 *     compliant: { gas: '35000000000000', cost: '0.0035 NEAR' },
 *   }}
 * />
 * ```
 *
 * @example Uncontrolled mode
 * ```tsx
 * <PrivacyToggle
 *   defaultValue="shielded"
 *   onChange={(level) => console.log('Selected:', level)}
 * />
 * ```
 */
export function PrivacyToggle({
  value,
  defaultValue = 'shielded',
  onChange,
  disabled = false,
  gasEstimates,
  showGasEstimate = false,
  showTooltips = true,
  className = '',
  size = 'md',
  chain = 'near',
  'aria-label': ariaLabel = 'Privacy level',
}: PrivacyToggleProps) {
  // Generate unique IDs for accessibility
  const baseId = useId()

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState<PrivacyLevel>(defaultValue)

  // Determine if controlled or uncontrolled
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  // Handle selection change
  const handleSelect = useCallback(
    (level: PrivacyLevel) => {
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
    (event: React.KeyboardEvent, currentLevel: PrivacyLevel) => {
      const levels: PrivacyLevel[] = ['off', 'shielded', 'compliant']
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
  const levelInfos: PrivacyLevelInfo[] = useMemo(
    () =>
      (['off', 'shielded', 'compliant'] as PrivacyLevel[]).map((level) => ({
        level,
        ...DEFAULT_LEVEL_INFO[level],
        gasEstimate: gasEstimates?.[level],
      })),
    [gasEstimates]
  )

  // Calculate gas difference from base (off)
  const getGasDifference = useCallback(
    (level: PrivacyLevel): string | null => {
      if (!gasEstimates?.off || !gasEstimates?.[level]) return null
      if (level === 'off') return null

      const baseCost = gasEstimates.off.cost
      const levelCost = gasEstimates[level]?.cost

      if (!levelCost) return null

      return `+${levelCost} vs ${baseCost}`
    },
    [gasEstimates]
  )

  return (
    <>
      {/* Inject styles */}
      <style>{styles}</style>

      <div
        className={`sip-privacy-toggle ${className}`}
        data-chain={chain}
      >
        {/* Toggle group */}
        <div
          role="radiogroup"
          aria-label={ariaLabel}
          className="sip-privacy-toggle-group"
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
                className="sip-privacy-option"
                data-level={info.level}
                data-size={size}
              >
                {info.icon}
                <span>{info.label}</span>

                {/* Tooltip */}
                {showTooltips && (
                  <span className="sip-privacy-tooltip" role="tooltip">
                    {info.description}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Gas estimate info */}
        {showGasEstimate && gasEstimates && (
          <div className="sip-privacy-gas-info" aria-live="polite">
            <span>Estimated fee:</span>
            <span
              className="sip-privacy-gas-badge"
              data-level={currentValue}
            >
              {gasEstimates[currentValue]?.cost ?? 'Unknown'}
              {gasEstimates[currentValue]?.costUsd && (
                <span> (~{gasEstimates[currentValue]?.costUsd})</span>
              )}
            </span>
            {currentValue !== 'off' && getGasDifference(currentValue) && (
              <span className="sip-privacy-gas-diff">
                ({getGasDifference(currentValue)})
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Hook to use with PrivacyToggle for managing privacy state
 */
export function usePrivacyToggle(initialValue: PrivacyLevel = 'shielded') {
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(initialValue)

  const isPrivate = privacyLevel !== 'off'
  const isCompliant = privacyLevel === 'compliant'
  const isShielded = privacyLevel === 'shielded'

  const setPublic = useCallback(() => setPrivacyLevel('off'), [])
  const setShielded = useCallback(() => setPrivacyLevel('shielded'), [])
  const setCompliant = useCallback(() => setPrivacyLevel('compliant'), [])

  return {
    privacyLevel,
    setPrivacyLevel,
    isPrivate,
    isCompliant,
    isShielded,
    setPublic,
    setShielded,
    setCompliant,
  }
}

export default PrivacyToggle
