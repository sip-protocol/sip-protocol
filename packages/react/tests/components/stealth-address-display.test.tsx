import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import {
  StealthAddressDisplay,
  useStealthAddressDisplay,
  isValidStealthAddress,
  truncateAddress,
  NEAR_NETWORKS,
  type OwnershipStatus,
} from '../../src/components/stealth-address-display'

// Valid 64-char hex address (stealth address)
const VALID_STEALTH_ADDRESS = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
const INVALID_ADDRESS = 'alice.near'
const META_ADDRESS = 'sip:near:0x02abc123def456:0x03def789abc012'

describe('StealthAddressDisplay', () => {
  // Mock clipboard API
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: mockClipboard })
  })

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Basic Rendering', () => {
    it('should render the stealth address', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const addressText = container.querySelector('[data-testid="address-text"]')
      expect(addressText).toBeTruthy()
    })

    it('should show truncated address by default', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const addressText = container.querySelector('[data-testid="address-text"]')
      // Check that the displayed text contains the truncation indicator
      expect(addressText?.textContent).toContain('...')
      // The visible truncated part should be shorter than the full address
      // (textContent includes both truncated and full tooltip, so we check for '...')
    })

    it('should show full address in tooltip on hover', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const fullAddressElement = container.querySelector('.sip-stealth-address-full')
      expect(fullAddressElement?.textContent).toBe(VALID_STEALTH_ADDRESS)
    })

    it('should show stealth icon/badge', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const icon = container.querySelector('.sip-stealth-icon')
      expect(icon).toBeTruthy()
    })
  })

  // ─── Copy Functionality ────────────────────────────────────────────────────

  describe('Copy Functionality', () => {
    it('should show copy button by default', () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const copyButton = screen.getByLabelText('Copy address to clipboard')
      expect(copyButton).toBeTruthy()
    })

    it('should copy address to clipboard when clicked', async () => {
      const onCopy = vi.fn()
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} onCopy={onCopy} />)

      const copyButton = screen.getByLabelText('Copy address to clipboard')
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith(VALID_STEALTH_ADDRESS)
        expect(onCopy).toHaveBeenCalledWith(VALID_STEALTH_ADDRESS)
      })
    })

    it('should show copy success message', async () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const copyButton = screen.getByLabelText('Copy address to clipboard')
      fireEvent.click(copyButton)

      await waitFor(() => {
        const successMessage = container.querySelector('.sip-stealth-copy-success.visible')
        expect(successMessage).toBeTruthy()
      })
    })

    it('should hide copy button when showCopyButton is false', () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} showCopyButton={false} />)

      const copyButton = screen.queryByLabelText('Copy address to clipboard')
      expect(copyButton).toBeNull()
    })
  })

  // ─── Explorer Link ──────────────────────────────────────────────────────────

  describe('Explorer Link', () => {
    it('should show explorer link by default', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const explorerLink = container.querySelector('a[href*="nearblocks.io"]')
      expect(explorerLink).toBeTruthy()
    })

    it('should link to mainnet explorer by default', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const explorerLink = container.querySelector('a') as HTMLAnchorElement
      expect(explorerLink?.href).toContain('nearblocks.io')
      expect(explorerLink?.href).toContain(VALID_STEALTH_ADDRESS)
    })

    it('should link to testnet explorer when specified', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} network="testnet" />
      )

      const explorerLink = container.querySelector('a') as HTMLAnchorElement
      expect(explorerLink?.href).toContain('testnet.nearblocks.io')
    })

    it('should hide explorer link when showExplorerLink is false', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} showExplorerLink={false} />
      )

      const explorerLink = container.querySelector('a[href*="nearblocks.io"]')
      expect(explorerLink).toBeNull()
    })

    it('should use custom network config when provided', () => {
      const customConfig = {
        name: 'Custom Explorer',
        explorerUrl: 'https://custom-explorer.com/address',
      }

      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} networkConfig={customConfig} />
      )

      const explorerLink = container.querySelector('a') as HTMLAnchorElement
      expect(explorerLink?.href).toContain('custom-explorer.com')
    })
  })

  // ─── QR Code ────────────────────────────────────────────────────────────────

  describe('QR Code', () => {
    it('should show QR button by default', () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      expect(qrButton).toBeTruthy()
    })

    it('should open QR modal when clicked', async () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      await waitFor(() => {
        const modal = screen.getByRole('dialog')
        expect(modal).toBeTruthy()
      })
    })

    it('should call onShowQr callback when QR is opened', () => {
      const onShowQr = vi.fn()
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} onShowQr={onShowQr} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      expect(onShowQr).toHaveBeenCalledWith(VALID_STEALTH_ADDRESS)
    })

    it('should use meta-address for QR when provided', () => {
      const onShowQr = vi.fn()
      render(
        <StealthAddressDisplay
          address={VALID_STEALTH_ADDRESS}
          metaAddress={META_ADDRESS}
          onShowQr={onShowQr}
        />
      )

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      expect(onShowQr).toHaveBeenCalledWith(META_ADDRESS)
    })

    it('should display meta-address in QR modal', async () => {
      render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} metaAddress={META_ADDRESS} />
      )

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      await waitFor(() => {
        const addressDisplay = screen.getByText(META_ADDRESS)
        expect(addressDisplay).toBeTruthy()
      })
    })

    it('should close QR modal when close button clicked', async () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      const closeButton = screen.getByText('Close')
      fireEvent.click(closeButton)

      await waitFor(() => {
        const modal = screen.queryByRole('dialog')
        expect(modal).toBeNull()
      })
    })

    it('should close QR modal when backdrop clicked', async () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      const modal = screen.getByRole('dialog')
      fireEvent.click(modal)

      await waitFor(() => {
        const modalAfter = screen.queryByRole('dialog')
        expect(modalAfter).toBeNull()
      })
    })

    it('should hide QR button when showQrCode is false', () => {
      render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} showQrCode={false} />)

      const qrButton = screen.queryByLabelText('Show QR code')
      expect(qrButton).toBeNull()
    })
  })

  // ─── Validation Indicator ──────────────────────────────────────────────────

  describe('Validation Indicator', () => {
    it('should show valid indicator for valid stealth address', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const validation = container.querySelector('.sip-stealth-validation')
      expect(validation?.getAttribute('data-valid')).toBe('true')
      expect(validation?.textContent).toContain('Valid stealth address')
    })

    it('should show invalid indicator for invalid address', () => {
      const { container } = render(<StealthAddressDisplay address={INVALID_ADDRESS} />)

      const validation = container.querySelector('.sip-stealth-validation')
      expect(validation?.getAttribute('data-valid')).toBe('false')
      expect(validation?.textContent).toContain('Invalid format')
    })

    it('should use provided isValid prop', () => {
      const { container } = render(
        <StealthAddressDisplay address={INVALID_ADDRESS} isValid={true} />
      )

      const validation = container.querySelector('.sip-stealth-validation')
      expect(validation?.getAttribute('data-valid')).toBe('true')
    })

    it('should hide validation when showValidation is false', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} showValidation={false} />
      )

      const validation = container.querySelector('.sip-stealth-validation')
      expect(validation).toBeNull()
    })
  })

  // ─── Ownership Status ──────────────────────────────────────────────────────

  describe('Ownership Status', () => {
    it('should show unknown ownership by default', () => {
      const { container } = render(<StealthAddressDisplay address={VALID_STEALTH_ADDRESS} />)

      const badge = container.querySelector('.sip-stealth-badge')
      expect(badge?.getAttribute('data-ownership')).toBe('unknown')
      expect(badge?.textContent).toBe('Unknown')
    })

    it('should show "Your Address" for yours ownership', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} ownership="yours" />
      )

      const badge = container.querySelector('.sip-stealth-badge')
      expect(badge?.getAttribute('data-ownership')).toBe('yours')
      expect(badge?.textContent).toBe('Your Address')
    })

    it('should show "Someone\'s Address" for others ownership', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} ownership="others" />
      )

      const badge = container.querySelector('.sip-stealth-badge')
      expect(badge?.getAttribute('data-ownership')).toBe('others')
      expect(badge?.textContent).toContain("Someone's Address")
    })

    it('should hide ownership badge when showOwnership is false', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} showOwnership={false} />
      )

      const badge = container.querySelector('.sip-stealth-badge')
      expect(badge).toBeNull()
    })
  })

  // ─── Size Variants ──────────────────────────────────────────────────────────

  describe('Size Variants', () => {
    it('should apply size attribute', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} size="lg" />
      )

      const wrapper = container.querySelector('.sip-stealth-address-container')
      expect(wrapper?.getAttribute('data-size')).toBe('lg')
    })

    it('should truncate address based on size', () => {
      const { container: smContainer } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} size="sm" />
      )
      const { container: lgContainer } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} size="lg" />
      )

      const smText = smContainer.querySelector('[data-testid="address-text"]')?.textContent || ''
      const lgText = lgContainer.querySelector('[data-testid="address-text"]')?.textContent || ''

      // Small size should have shorter visible text
      expect(smText.length).toBeLessThan(lgText.length)
    })
  })

  // ─── Custom Class Name ──────────────────────────────────────────────────────

  describe('Custom Class Name', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <StealthAddressDisplay address={VALID_STEALTH_ADDRESS} className="my-custom-class" />
      )

      const wrapper = container.querySelector('.sip-stealth-address')
      expect(wrapper?.classList.contains('my-custom-class')).toBe(true)
    })
  })
})

// ─── Utility Functions ────────────────────────────────────────────────────────

describe('isValidStealthAddress', () => {
  it('should return true for valid 64-char hex address', () => {
    expect(isValidStealthAddress(VALID_STEALTH_ADDRESS)).toBe(true)
  })

  it('should return false for named account', () => {
    expect(isValidStealthAddress('alice.near')).toBe(false)
  })

  it('should return false for short hex', () => {
    expect(isValidStealthAddress('a1b2c3d4')).toBe(false)
  })

  it('should return false for hex with invalid characters', () => {
    expect(isValidStealthAddress('g1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2')).toBe(false)
  })

  it('should handle mixed case', () => {
    const mixedCase = 'A1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6a1b2c3d4e5f6A1B2C3D4E5F6a1b2'
    expect(isValidStealthAddress(mixedCase)).toBe(true)
  })
})

describe('truncateAddress', () => {
  it('should truncate long addresses', () => {
    const result = truncateAddress(VALID_STEALTH_ADDRESS, 8, 8)
    expect(result).toBe('a1b2c3d4...e5f6a1b2')
  })

  it('should not truncate short addresses', () => {
    const shortAddress = 'abcd1234'
    const result = truncateAddress(shortAddress, 8, 8)
    expect(result).toBe(shortAddress)
  })

  it('should use custom start/end chars', () => {
    const result = truncateAddress(VALID_STEALTH_ADDRESS, 4, 4)
    expect(result).toBe('a1b2...a1b2')
  })
})

describe('NEAR_NETWORKS', () => {
  it('should have mainnet config', () => {
    expect(NEAR_NETWORKS.mainnet).toBeDefined()
    expect(NEAR_NETWORKS.mainnet.name).toBe('NEAR Mainnet')
    expect(NEAR_NETWORKS.mainnet.explorerUrl).toContain('nearblocks.io')
  })

  it('should have testnet config', () => {
    expect(NEAR_NETWORKS.testnet).toBeDefined()
    expect(NEAR_NETWORKS.testnet.name).toBe('NEAR Testnet')
    expect(NEAR_NETWORKS.testnet.explorerUrl).toContain('testnet')
  })
})

// ─── useStealthAddressDisplay Hook ────────────────────────────────────────────

describe('useStealthAddressDisplay', () => {
  it('should return address info', () => {
    const { result } = renderHook(() => useStealthAddressDisplay(VALID_STEALTH_ADDRESS))

    expect(result.current.address).toBe(VALID_STEALTH_ADDRESS)
    expect(result.current.truncated).toContain('...')
    expect(result.current.isValid).toBe(true)
    expect(result.current.isStealth).toBe(true)
    expect(result.current.ownership).toBe('unknown')
  })

  it('should use custom ownership checker', () => {
    const checkOwnership = vi.fn().mockReturnValue('yours' as OwnershipStatus)

    const { result } = renderHook(() =>
      useStealthAddressDisplay(VALID_STEALTH_ADDRESS, { checkOwnership })
    )

    expect(result.current.ownership).toBe('yours')
    expect(checkOwnership).toHaveBeenCalledWith(VALID_STEALTH_ADDRESS)
  })

  it('should use custom validator', () => {
    const validateAddress = vi.fn().mockReturnValue(true)

    const { result } = renderHook(() =>
      useStealthAddressDisplay(INVALID_ADDRESS, { validateAddress })
    )

    expect(result.current.isValid).toBe(true)
    expect(validateAddress).toHaveBeenCalledWith(INVALID_ADDRESS)
  })

  it('should identify non-stealth addresses', () => {
    const { result } = renderHook(() => useStealthAddressDisplay(INVALID_ADDRESS))

    expect(result.current.isStealth).toBe(false)
    expect(result.current.isValid).toBe(false)
  })
})
