import React, { useState, useCallback, useMemo } from 'react'

/**
 * Ownership status for stealth addresses
 */
export type OwnershipStatus = 'yours' | 'others' | 'unknown'

/**
 * Network configuration for explorer links
 */
export interface NetworkConfig {
  name: string
  explorerUrl: string
}

/**
 * Default NEAR network configurations
 */
export const NEAR_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'NEAR Mainnet',
    explorerUrl: 'https://nearblocks.io/address',
  },
  testnet: {
    name: 'NEAR Testnet',
    explorerUrl: 'https://testnet.nearblocks.io/address',
  },
}

/**
 * StealthAddressDisplay component props
 */
export interface StealthAddressDisplayProps {
  /** The stealth address to display (64-char hex or implicit account) */
  address: string
  /** Optional stealth meta-address for QR code (full sip: format) */
  metaAddress?: string
  /** Ownership status of the address */
  ownership?: OwnershipStatus
  /** Whether the address is validated */
  isValid?: boolean
  /** Network for explorer links */
  network?: 'mainnet' | 'testnet'
  /** Custom network configuration */
  networkConfig?: NetworkConfig
  /** Whether to show the QR code button */
  showQrCode?: boolean
  /** Whether to show the explorer link */
  showExplorerLink?: boolean
  /** Whether to show the copy button */
  showCopyButton?: boolean
  /** Whether to show the ownership badge */
  showOwnership?: boolean
  /** Whether to show the validation indicator */
  showValidation?: boolean
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Callback when address is copied */
  onCopy?: (address: string) => void
  /** Callback when QR code is shown */
  onShowQr?: (address: string) => void
}

/**
 * Validates a NEAR stealth address format
 */
export function isValidStealthAddress(address: string): boolean {
  // Stealth addresses are 64-char hex strings (implicit accounts)
  const hexRegex = /^[0-9a-fA-F]{64}$/
  return hexRegex.test(address)
}

/**
 * Truncates an address for display
 */
export function truncateAddress(address: string, startChars = 8, endChars = 8): string {
  if (address.length <= startChars + endChars + 3) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * CSS styles for the component
 */
const styles = `
.sip-stealth-address {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  font-family: system-ui, -apple-system, sans-serif;
}

.sip-stealth-address-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #3a3a5c;
  border-radius: 8px;
  position: relative;
}

.sip-stealth-address-container[data-size="sm"] {
  padding: 4px 8px;
  gap: 6px;
  border-radius: 6px;
}

.sip-stealth-address-container[data-size="lg"] {
  padding: 12px 16px;
  gap: 12px;
  border-radius: 12px;
}

.sip-stealth-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 6px;
  color: white;
  flex-shrink: 0;
}

.sip-stealth-icon svg {
  width: 14px;
  height: 14px;
}

.sip-stealth-address-container[data-size="sm"] .sip-stealth-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.sip-stealth-address-container[data-size="sm"] .sip-stealth-icon svg {
  width: 12px;
  height: 12px;
}

.sip-stealth-address-container[data-size="lg"] .sip-stealth-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.sip-stealth-address-container[data-size="lg"] .sip-stealth-icon svg {
  width: 18px;
  height: 18px;
}

.sip-stealth-address-text {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 13px;
  color: #e2e8f0;
  cursor: default;
  position: relative;
}

.sip-stealth-address-container[data-size="sm"] .sip-stealth-address-text {
  font-size: 11px;
}

.sip-stealth-address-container[data-size="lg"] .sip-stealth-address-text {
  font-size: 15px;
}

.sip-stealth-address-full {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  background: #1f2937;
  color: #e2e8f0;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, monospace;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.sip-stealth-address-full::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.sip-stealth-address-text:hover .sip-stealth-address-full {
  opacity: 1;
  visibility: visible;
}

.sip-stealth-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
}

.sip-stealth-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.sip-stealth-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.sip-stealth-action-btn:active {
  transform: scale(0.95);
}

.sip-stealth-action-btn svg {
  width: 16px;
  height: 16px;
}

.sip-stealth-address-container[data-size="sm"] .sip-stealth-action-btn {
  width: 24px;
  height: 24px;
}

.sip-stealth-address-container[data-size="sm"] .sip-stealth-action-btn svg {
  width: 14px;
  height: 14px;
}

.sip-stealth-address-container[data-size="lg"] .sip-stealth-action-btn {
  width: 32px;
  height: 32px;
}

.sip-stealth-address-container[data-size="lg"] .sip-stealth-action-btn svg {
  width: 18px;
  height: 18px;
}

.sip-stealth-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.sip-stealth-badge[data-ownership="yours"] {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.sip-stealth-badge[data-ownership="others"] {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.sip-stealth-badge[data-ownership="unknown"] {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.sip-stealth-validation {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.sip-stealth-validation[data-valid="true"] {
  color: #22c55e;
}

.sip-stealth-validation[data-valid="false"] {
  color: #ef4444;
}

.sip-stealth-validation svg {
  width: 14px;
  height: 14px;
}

.sip-stealth-qr-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.sip-stealth-qr-content {
  background: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  max-width: 320px;
  width: 90%;
}

.sip-stealth-qr-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
}

.sip-stealth-qr-code {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 200px;
  margin: 0 auto 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.sip-stealth-qr-address {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: #6b7280;
  word-break: break-all;
  margin-bottom: 16px;
}

.sip-stealth-qr-close {
  padding: 8px 24px;
  background: #111827;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.sip-stealth-qr-close:hover {
  background: #374151;
}

.sip-stealth-copy-success {
  position: absolute;
  top: -32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: #22c55e;
  color: white;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

.sip-stealth-copy-success.visible {
  opacity: 1;
  visibility: visible;
}

/* Dark mode already active by default, light mode override */
@media (prefers-color-scheme: light) {
  .sip-stealth-address-container {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-color: #e2e8f0;
  }

  .sip-stealth-address-text {
    color: #1e293b;
  }

  .sip-stealth-action-btn {
    color: #64748b;
  }

  .sip-stealth-action-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1e293b;
  }
}
`

/**
 * Shield icon for stealth address indicator
 */
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

/**
 * Copy icon
 */
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

/**
 * External link icon
 */
const ExternalLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

/**
 * QR code icon
 */
const QrCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
)

/**
 * Check icon
 */
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

/**
 * X icon
 */
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/**
 * StealthAddressDisplay - Component for displaying NEAR stealth addresses
 *
 * Displays stealth addresses with visual distinction from regular NEAR addresses,
 * including copy functionality, explorer links, and QR code generation.
 *
 * @example Basic usage
 * ```tsx
 * import { StealthAddressDisplay } from '@sip-protocol/react'
 *
 * function WalletView() {
 *   return (
 *     <StealthAddressDisplay
 *       address="a1b2c3d4e5f6..."
 *       ownership="yours"
 *     />
 *   )
 * }
 * ```
 *
 * @example With meta-address for QR
 * ```tsx
 * <StealthAddressDisplay
 *   address="a1b2c3d4e5f6..."
 *   metaAddress="sip:near:0x02abc...123:0x03def...456"
 *   showQrCode
 *   showExplorerLink
 *   network="mainnet"
 * />
 * ```
 */
export function StealthAddressDisplay({
  address,
  metaAddress,
  ownership = 'unknown',
  isValid,
  network = 'mainnet',
  networkConfig,
  showQrCode = true,
  showExplorerLink = true,
  showCopyButton = true,
  showOwnership = true,
  showValidation = true,
  className = '',
  size = 'md',
  onCopy,
  onShowQr,
}: StealthAddressDisplayProps) {
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Determine validation status
  const validationStatus = useMemo(() => {
    if (isValid !== undefined) return isValid
    return isValidStealthAddress(address)
  }, [address, isValid])

  // Get network config
  const config = useMemo(() => {
    return networkConfig ?? NEAR_NETWORKS[network]
  }, [network, networkConfig])

  // Truncate address for display
  const displayAddress = useMemo(() => {
    const chars = size === 'sm' ? 6 : size === 'lg' ? 10 : 8
    return truncateAddress(address, chars, chars)
  }, [address, size])

  // Handle copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setShowCopySuccess(true)
      onCopy?.(address)
      setTimeout(() => setShowCopySuccess(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = address
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setShowCopySuccess(true)
      onCopy?.(address)
      setTimeout(() => setShowCopySuccess(false), 2000)
    }
  }, [address, onCopy])

  // Handle show QR code
  const handleShowQr = useCallback(() => {
    setShowQrModal(true)
    onShowQr?.(metaAddress ?? address)
  }, [address, metaAddress, onShowQr])

  // Handle close QR modal
  const handleCloseQr = useCallback(() => {
    setShowQrModal(false)
  }, [])

  // Get ownership label
  const ownershipLabel = useMemo(() => {
    switch (ownership) {
      case 'yours':
        return 'Your Address'
      case 'others':
        return "Someone's Address"
      case 'unknown':
      default:
        return 'Unknown'
    }
  }, [ownership])

  // Explorer URL
  const explorerUrl = useMemo(() => {
    return `${config.explorerUrl}/${address}`
  }, [config.explorerUrl, address])

  return (
    <>
      <style>{styles}</style>

      <div className={`sip-stealth-address ${className}`}>
        <div
          className="sip-stealth-address-container"
          data-size={size}
          data-ownership={ownership}
        >
          {/* Copy success message */}
          <span className={`sip-stealth-copy-success ${showCopySuccess ? 'visible' : ''}`}>
            Copied!
          </span>

          {/* Stealth icon badge */}
          <div className="sip-stealth-icon" title="Stealth Address">
            <ShieldIcon />
          </div>

          {/* Address text with full address tooltip */}
          <span className="sip-stealth-address-text" data-testid="address-text">
            {displayAddress}
            <span className="sip-stealth-address-full">{address}</span>
          </span>

          {/* Action buttons */}
          <div className="sip-stealth-actions">
            {showCopyButton && (
              <button
                type="button"
                className="sip-stealth-action-btn"
                onClick={handleCopy}
                title="Copy address"
                aria-label="Copy address to clipboard"
              >
                <CopyIcon />
              </button>
            )}

            {showExplorerLink && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sip-stealth-action-btn"
                title={`View on ${config.name}`}
                aria-label={`View on ${config.name}`}
              >
                <ExternalLinkIcon />
              </a>
            )}

            {showQrCode && (
              <button
                type="button"
                className="sip-stealth-action-btn"
                onClick={handleShowQr}
                title="Show QR code"
                aria-label="Show QR code"
              >
                <QrCodeIcon />
              </button>
            )}
          </div>

          {/* Ownership badge */}
          {showOwnership && (
            <span
              className="sip-stealth-badge"
              data-ownership={ownership}
            >
              {ownershipLabel}
            </span>
          )}
        </div>

        {/* Validation indicator */}
        {showValidation && (
          <div
            className="sip-stealth-validation"
            data-valid={validationStatus}
            aria-label={validationStatus ? 'Valid stealth address' : 'Invalid stealth address'}
          >
            {validationStatus ? <CheckIcon /> : <XIcon />}
            <span>{validationStatus ? 'Valid stealth address' : 'Invalid format'}</span>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div
          className="sip-stealth-qr-modal"
          onClick={handleCloseQr}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div
            className="sip-stealth-qr-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="qr-modal-title" className="sip-stealth-qr-title">
              Scan to Receive
            </h3>
            <div className="sip-stealth-qr-code" data-testid="qr-code-container">
              {/* QR Code placeholder - can be enhanced with actual QR library */}
              <QrCodeIcon />
            </div>
            <p className="sip-stealth-qr-address">
              {metaAddress ?? address}
            </p>
            <button
              type="button"
              className="sip-stealth-qr-close"
              onClick={handleCloseQr}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Hook to manage stealth address display state
 */
export function useStealthAddressDisplay(
  address: string,
  options: {
    checkOwnership?: (address: string) => OwnershipStatus
    validateAddress?: (address: string) => boolean
  } = {}
) {
  const { checkOwnership, validateAddress } = options

  const ownership = useMemo(() => {
    if (checkOwnership) {
      return checkOwnership(address)
    }
    return 'unknown' as OwnershipStatus
  }, [address, checkOwnership])

  const isValid = useMemo(() => {
    if (validateAddress) {
      return validateAddress(address)
    }
    return isValidStealthAddress(address)
  }, [address, validateAddress])

  const truncated = useMemo(() => truncateAddress(address), [address])

  return {
    address,
    truncated,
    ownership,
    isValid,
    isStealth: isValidStealthAddress(address),
  }
}

export default StealthAddressDisplay
