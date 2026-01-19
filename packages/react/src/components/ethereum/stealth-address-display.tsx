import React, { useState, useCallback, useMemo } from 'react'

/**
 * EthereumStealthAddressDisplay Component
 *
 * Displays EIP-5564 stealth addresses with Ethereum-specific features including
 * network support for mainnet and L2s, Etherscan integration, and EIP-5564 validation.
 *
 * @module components/ethereum/stealth-address-display
 */

/**
 * Ownership status for stealth addresses
 */
export type EthereumOwnershipStatus = 'yours' | 'others' | 'unknown'

/**
 * Ethereum network IDs
 */
export type EthereumStealthNetworkId =
  | 'mainnet'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  | 'sepolia'

/**
 * Network configuration for explorer links
 */
export interface EthereumStealthNetworkConfig {
  name: string
  chainId: number
  explorerUrl: string
  explorerName: string
  isL2: boolean
  color: string
}

/**
 * Default Ethereum network configurations
 */
export const ETHEREUM_STEALTH_NETWORKS: Record<
  EthereumStealthNetworkId,
  EthereumStealthNetworkConfig
> = {
  mainnet: {
    name: 'Ethereum',
    chainId: 1,
    explorerUrl: 'https://etherscan.io/address',
    explorerName: 'Etherscan',
    isL2: false,
    color: '#627EEA',
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    explorerUrl: 'https://arbiscan.io/address',
    explorerName: 'Arbiscan',
    isL2: true,
    color: '#28A0F0',
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    explorerUrl: 'https://optimistic.etherscan.io/address',
    explorerName: 'Optimism Explorer',
    isL2: true,
    color: '#FF0420',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    explorerUrl: 'https://basescan.org/address',
    explorerName: 'BaseScan',
    isL2: true,
    color: '#0052FF',
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    explorerUrl: 'https://polygonscan.com/address',
    explorerName: 'PolygonScan',
    isL2: true,
    color: '#8247E5',
  },
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io/address',
    explorerName: 'Sepolia Etherscan',
    isL2: false,
    color: '#CFB5F0',
  },
}

/**
 * EthereumStealthAddressDisplay component props
 */
export interface EthereumStealthAddressDisplayProps {
  /** The stealth address to display (0x prefixed, 42 chars) */
  address: string
  /** Optional stealth meta-address for QR code (full sip: format) */
  metaAddress?: string
  /** Optional ephemeral public key (EIP-5564) */
  ephemeralPublicKey?: string
  /** View tag for the stealth address (EIP-5564) */
  viewTag?: number
  /** Ownership status of the address */
  ownership?: EthereumOwnershipStatus
  /** Whether the address is validated */
  isValid?: boolean
  /** Network for explorer links */
  network?: EthereumStealthNetworkId
  /** Custom network configuration */
  networkConfig?: EthereumStealthNetworkConfig
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
  /** Whether to show the network badge */
  showNetworkBadge?: boolean
  /** Whether to show the EIP-5564 badge */
  showEipBadge?: boolean
  /** Whether to show the view tag */
  showViewTag?: boolean
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Callback when address is copied */
  onCopy?: (address: string) => void
  /** Callback when QR code is shown */
  onShowQr?: (address: string) => void
  /** Callback when ephemeral key is copied */
  onCopyEphemeralKey?: (key: string) => void
}

/**
 * Validates an Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  // Ethereum addresses are 42 chars with 0x prefix
  const ethRegex = /^0x[0-9a-fA-F]{40}$/
  return ethRegex.test(address)
}

/**
 * Validates an EIP-5564 stealth address
 * Stealth addresses are valid Ethereum addresses generated from EIP-5564
 */
export function isValidEthereumStealthAddress(address: string): boolean {
  return isValidEthereumAddress(address)
}

/**
 * Validates an ephemeral public key (compressed secp256k1)
 */
export function isValidEphemeralPublicKey(key: string): boolean {
  // Compressed public key: 66 chars (02 or 03 prefix + 64 hex)
  const compressedRegex = /^0x0[23][0-9a-fA-F]{64}$/
  // Uncompressed public key: 130 chars (04 prefix + 128 hex)
  const uncompressedRegex = /^0x04[0-9a-fA-F]{128}$/
  return compressedRegex.test(key) || uncompressedRegex.test(key)
}

/**
 * Truncates an address for display
 */
export function truncateEthereumAddress(
  address: string,
  startChars = 6,
  endChars = 4
): string {
  if (address.length <= startChars + endChars + 3) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * CSS styles for the component
 */
const styles = `
.sip-eth-stealth-address {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  font-family: system-ui, -apple-system, sans-serif;
}

.sip-eth-stealth-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #1a1a2e 0%, #0d1421 100%);
  border: 1px solid #2d3748;
  border-radius: 8px;
  position: relative;
}

.sip-eth-stealth-container[data-size="sm"] {
  padding: 4px 8px;
  gap: 6px;
  border-radius: 6px;
}

.sip-eth-stealth-container[data-size="lg"] {
  padding: 12px 16px;
  gap: 12px;
  border-radius: 12px;
}

.sip-eth-stealth-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #627EEA 0%, #8A92B2 100%);
  border-radius: 6px;
  color: white;
  flex-shrink: 0;
}

.sip-eth-stealth-icon svg {
  width: 14px;
  height: 14px;
}

.sip-eth-stealth-container[data-size="sm"] .sip-eth-stealth-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.sip-eth-stealth-container[data-size="sm"] .sip-eth-stealth-icon svg {
  width: 12px;
  height: 12px;
}

.sip-eth-stealth-container[data-size="lg"] .sip-eth-stealth-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.sip-eth-stealth-container[data-size="lg"] .sip-eth-stealth-icon svg {
  width: 18px;
  height: 18px;
}

.sip-eth-stealth-address-text {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 13px;
  color: #e2e8f0;
  cursor: default;
  position: relative;
}

.sip-eth-stealth-container[data-size="sm"] .sip-eth-stealth-address-text {
  font-size: 11px;
}

.sip-eth-stealth-container[data-size="lg"] .sip-eth-stealth-address-text {
  font-size: 15px;
}

.sip-eth-stealth-address-full {
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

.sip-eth-stealth-address-full::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.sip-eth-stealth-address-text:hover .sip-eth-stealth-address-full {
  opacity: 1;
  visibility: visible;
}

.sip-eth-stealth-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
}

.sip-eth-stealth-action-btn {
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

.sip-eth-stealth-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.sip-eth-stealth-action-btn:active {
  transform: scale(0.95);
}

.sip-eth-stealth-action-btn svg {
  width: 16px;
  height: 16px;
}

.sip-eth-stealth-container[data-size="sm"] .sip-eth-stealth-action-btn {
  width: 24px;
  height: 24px;
}

.sip-eth-stealth-container[data-size="sm"] .sip-eth-stealth-action-btn svg {
  width: 14px;
  height: 14px;
}

.sip-eth-stealth-container[data-size="lg"] .sip-eth-stealth-action-btn {
  width: 32px;
  height: 32px;
}

.sip-eth-stealth-container[data-size="lg"] .sip-eth-stealth-action-btn svg {
  width: 18px;
  height: 18px;
}

.sip-eth-stealth-badge {
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

.sip-eth-stealth-badge[data-ownership="yours"] {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.sip-eth-stealth-badge[data-ownership="others"] {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.sip-eth-stealth-badge[data-ownership="unknown"] {
  background: rgba(156, 163, 175, 0.2);
  color: #9ca3af;
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.sip-eth-stealth-network-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  background: rgba(98, 126, 234, 0.2);
  color: #627EEA;
  border: 1px solid rgba(98, 126, 234, 0.3);
}

.sip-eth-stealth-network-badge[data-l2="true"] {
  background: rgba(40, 160, 240, 0.2);
  color: #28A0F0;
  border: 1px solid rgba(40, 160, 240, 0.3);
}

.sip-eth-stealth-eip-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 9px;
  font-weight: 600;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.2);
  color: #8b5cf6;
  border: 1px solid rgba(139, 92, 246, 0.3);
  font-family: 'SF Mono', Monaco, monospace;
}

.sip-eth-stealth-view-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
  font-family: 'SF Mono', Monaco, monospace;
}

.sip-eth-stealth-validation {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.sip-eth-stealth-validation[data-valid="true"] {
  color: #22c55e;
}

.sip-eth-stealth-validation[data-valid="false"] {
  color: #ef4444;
}

.sip-eth-stealth-validation svg {
  width: 14px;
  height: 14px;
}

.sip-eth-stealth-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.sip-eth-stealth-ephemeral {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  font-size: 10px;
  color: #a5b4fc;
}

.sip-eth-stealth-ephemeral-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sip-eth-stealth-ephemeral-key {
  font-family: 'SF Mono', Monaco, monospace;
  color: #c4b5fd;
}

.sip-eth-stealth-qr-modal {
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

.sip-eth-stealth-qr-content {
  background: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  max-width: 320px;
  width: 90%;
}

.sip-eth-stealth-qr-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
}

.sip-eth-stealth-qr-code {
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

.sip-eth-stealth-qr-address {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: #6b7280;
  word-break: break-all;
  margin-bottom: 16px;
}

.sip-eth-stealth-qr-close {
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

.sip-eth-stealth-qr-close:hover {
  background: #374151;
}

.sip-eth-stealth-copy-success {
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

.sip-eth-stealth-copy-success.visible {
  opacity: 1;
  visibility: visible;
}

/* Dark mode already active by default, light mode override */
@media (prefers-color-scheme: light) {
  .sip-eth-stealth-container {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-color: #e2e8f0;
  }

  .sip-eth-stealth-address-text {
    color: #1e293b;
  }

  .sip-eth-stealth-action-btn {
    color: #64748b;
  }

  .sip-eth-stealth-action-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1e293b;
  }
}
`

/**
 * Ethereum diamond icon for stealth address indicator
 */
const EthereumIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2L4 12l8 10 8-10L12 2z" />
    <path d="M4 12l8 3.5L20 12" />
    <path d="M12 2v13.5" />
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
 * EthereumStealthAddressDisplay - Component for displaying EIP-5564 stealth addresses
 *
 * Displays stealth addresses with Ethereum-specific visual styling,
 * including network support, Etherscan links, and EIP-5564 metadata.
 *
 * @example Basic usage
 * ```tsx
 * import { EthereumStealthAddressDisplay } from '@sip-protocol/react'
 *
 * function WalletView() {
 *   return (
 *     <EthereumStealthAddressDisplay
 *       address="0x742d35Cc6634C0532925a3b844Bc9e7595f2..."
 *       ownership="yours"
 *     />
 *   )
 * }
 * ```
 *
 * @example With EIP-5564 metadata
 * ```tsx
 * <EthereumStealthAddressDisplay
 *   address="0x742d35Cc6634C0532925a3b844Bc9e7595f2..."
 *   ephemeralPublicKey="0x02abc...123"
 *   viewTag={42}
 *   network="arbitrum"
 *   showEipBadge
 *   showViewTag
 * />
 * ```
 */
export function EthereumStealthAddressDisplay({
  address,
  metaAddress,
  ephemeralPublicKey,
  viewTag,
  ownership = 'unknown',
  isValid,
  network = 'mainnet',
  networkConfig,
  showQrCode = true,
  showExplorerLink = true,
  showCopyButton = true,
  showOwnership = true,
  showValidation = true,
  showNetworkBadge = true,
  showEipBadge = true,
  showViewTag = true,
  className = '',
  size = 'md',
  onCopy,
  onShowQr,
  onCopyEphemeralKey,
}: EthereumStealthAddressDisplayProps) {
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)

  // Determine validation status
  const validationStatus = useMemo(() => {
    if (isValid !== undefined) return isValid
    return isValidEthereumStealthAddress(address)
  }, [address, isValid])

  // Get network config
  const config = useMemo(() => {
    return networkConfig ?? ETHEREUM_STEALTH_NETWORKS[network]
  }, [network, networkConfig])

  // Truncate address for display based on size
  const displayAddress = useMemo(() => {
    const startChars = size === 'sm' ? 6 : size === 'lg' ? 10 : 8
    const endChars = size === 'sm' ? 4 : size === 'lg' ? 6 : 4
    return truncateEthereumAddress(address, startChars, endChars)
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

  // Handle copy ephemeral key
  const handleCopyEphemeralKey = useCallback(async () => {
    if (!ephemeralPublicKey) return
    try {
      await navigator.clipboard.writeText(ephemeralPublicKey)
      onCopyEphemeralKey?.(ephemeralPublicKey)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = ephemeralPublicKey
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      onCopyEphemeralKey?.(ephemeralPublicKey)
    }
  }, [ephemeralPublicKey, onCopyEphemeralKey])

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
        return "Recipient's Address"
      case 'unknown':
      default:
        return 'Unknown'
    }
  }, [ownership])

  // Explorer URL
  const explorerUrl = useMemo(() => {
    return `${config.explorerUrl}/${address}`
  }, [config.explorerUrl, address])

  // Truncate ephemeral key for display
  const displayEphemeralKey = useMemo(() => {
    if (!ephemeralPublicKey) return ''
    return truncateEthereumAddress(ephemeralPublicKey, 8, 6)
  }, [ephemeralPublicKey])

  return (
    <>
      <style>{styles}</style>

      <div
        className={`sip-eth-stealth-address ${className}`}
        data-testid="eth-stealth-address"
      >
        <div
          className="sip-eth-stealth-container"
          data-size={size}
          data-ownership={ownership}
        >
          {/* Copy success message */}
          <span
            className={`sip-eth-stealth-copy-success ${showCopySuccess ? 'visible' : ''}`}
          >
            Copied!
          </span>

          {/* Ethereum icon badge */}
          <div className="sip-eth-stealth-icon" title="EIP-5564 Stealth Address">
            <EthereumIcon />
          </div>

          {/* Address text with full address tooltip */}
          <span className="sip-eth-stealth-address-text" data-testid="address-text">
            {displayAddress}
            <span className="sip-eth-stealth-address-full">{address}</span>
          </span>

          {/* Action buttons */}
          <div className="sip-eth-stealth-actions">
            {showCopyButton && (
              <button
                type="button"
                className="sip-eth-stealth-action-btn"
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
                className="sip-eth-stealth-action-btn"
                title={`View on ${config.explorerName}`}
                aria-label={`View on ${config.explorerName}`}
              >
                <ExternalLinkIcon />
              </a>
            )}

            {showQrCode && (
              <button
                type="button"
                className="sip-eth-stealth-action-btn"
                onClick={handleShowQr}
                title="Show QR code"
                aria-label="Show QR code"
              >
                <QrCodeIcon />
              </button>
            )}
          </div>

          {/* Network badge */}
          {showNetworkBadge && (
            <span
              className="sip-eth-stealth-network-badge"
              data-l2={config.isL2.toString()}
              style={{
                borderColor: `${config.color}40`,
                color: config.color,
                background: `${config.color}20`,
              }}
            >
              {config.name}
            </span>
          )}

          {/* Ownership badge */}
          {showOwnership && (
            <span className="sip-eth-stealth-badge" data-ownership={ownership}>
              {ownershipLabel}
            </span>
          )}
        </div>

        {/* Meta information row */}
        <div className="sip-eth-stealth-meta">
          {/* EIP-5564 badge */}
          {showEipBadge && (
            <span className="sip-eth-stealth-eip-badge">EIP-5564</span>
          )}

          {/* View tag */}
          {showViewTag && viewTag !== undefined && (
            <span className="sip-eth-stealth-view-tag">View Tag: {viewTag}</span>
          )}

          {/* Validation indicator */}
          {showValidation && (
            <div
              className="sip-eth-stealth-validation"
              data-valid={validationStatus}
              aria-label={
                validationStatus
                  ? 'Valid EIP-5564 stealth address'
                  : 'Invalid address format'
              }
            >
              {validationStatus ? <CheckIcon /> : <XIcon />}
              <span>
                {validationStatus ? 'Valid stealth address' : 'Invalid format'}
              </span>
            </div>
          )}
        </div>

        {/* Ephemeral public key (if provided) */}
        {ephemeralPublicKey && (
          <div className="sip-eth-stealth-ephemeral">
            <span className="sip-eth-stealth-ephemeral-label">Ephemeral Key:</span>
            <span className="sip-eth-stealth-ephemeral-key">
              {displayEphemeralKey}
            </span>
            <button
              type="button"
              className="sip-eth-stealth-action-btn"
              onClick={handleCopyEphemeralKey}
              title="Copy ephemeral key"
              aria-label="Copy ephemeral public key"
              style={{ width: 20, height: 20 }}
            >
              <CopyIcon />
            </button>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div
          className="sip-eth-stealth-qr-modal"
          onClick={handleCloseQr}
          role="dialog"
          aria-modal="true"
          aria-labelledby="eth-qr-modal-title"
        >
          <div
            className="sip-eth-stealth-qr-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="eth-qr-modal-title" className="sip-eth-stealth-qr-title">
              Scan to Receive ({config.name})
            </h3>
            <div className="sip-eth-stealth-qr-code" data-testid="qr-code-container">
              {/* QR Code placeholder - can be enhanced with actual QR library */}
              <QrCodeIcon />
            </div>
            <p className="sip-eth-stealth-qr-address">{metaAddress ?? address}</p>
            <button
              type="button"
              className="sip-eth-stealth-qr-close"
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
 * Hook to manage Ethereum stealth address display state
 */
export function useEthereumStealthAddressDisplay(
  address: string,
  options: {
    checkOwnership?: (address: string) => EthereumOwnershipStatus
    validateAddress?: (address: string) => boolean
    network?: EthereumStealthNetworkId
  } = {}
) {
  const { checkOwnership, validateAddress, network = 'mainnet' } = options

  const ownership = useMemo(() => {
    if (checkOwnership) {
      return checkOwnership(address)
    }
    return 'unknown' as EthereumOwnershipStatus
  }, [address, checkOwnership])

  const isValid = useMemo(() => {
    if (validateAddress) {
      return validateAddress(address)
    }
    return isValidEthereumStealthAddress(address)
  }, [address, validateAddress])

  const truncated = useMemo(() => truncateEthereumAddress(address), [address])

  const networkConfig = useMemo(
    () => ETHEREUM_STEALTH_NETWORKS[network],
    [network]
  )

  const explorerUrl = useMemo(
    () => `${networkConfig.explorerUrl}/${address}`,
    [networkConfig.explorerUrl, address]
  )

  return {
    address,
    truncated,
    ownership,
    isValid,
    isStealth: isValidEthereumStealthAddress(address),
    network,
    networkConfig,
    explorerUrl,
    isL2: networkConfig.isL2,
  }
}

export default EthereumStealthAddressDisplay
