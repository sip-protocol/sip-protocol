/**
 * EthereumStealthAddressDisplay Component Tests
 *
 * Tests for the Ethereum-specific stealth address display with EIP-5564 support
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  EthereumStealthAddressDisplay,
  useEthereumStealthAddressDisplay,
  isValidEthereumAddress,
  isValidEthereumStealthAddress,
  isValidEphemeralPublicKey,
  truncateEthereumAddress,
  ETHEREUM_STEALTH_NETWORKS,
  type EthereumOwnershipStatus,
  type EthereumStealthNetworkId,
} from '../../../src/components/ethereum/stealth-address-display'

// Valid test address
const VALID_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const INVALID_ADDRESS = '0xinvalid'
const VALID_EPHEMERAL_KEY =
  '0x02abc123def456789012345678901234567890123456789012345678901234abcd'
const INVALID_EPHEMERAL_KEY = '0xinvalidkey'

describe('EthereumStealthAddressDisplay', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the component with address', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.getByTestId('eth-stealth-address')).toBeInTheDocument()
      expect(screen.getByTestId('address-text')).toBeInTheDocument()
    })

    it('renders truncated address by default', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const addressText = screen.getByTestId('address-text')
      expect(addressText.textContent).toContain('0x742d35...')
      expect(addressText.textContent).toContain('...f44e')
    })

    it('renders with small size', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} size="sm" />)

      const container = document.querySelector('.sip-eth-stealth-container')
      expect(container).toHaveAttribute('data-size', 'sm')
    })

    it('renders with large size', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} size="lg" />)

      const container = document.querySelector('.sip-eth-stealth-container')
      expect(container).toHaveAttribute('data-size', 'lg')
    })

    it('renders Ethereum icon', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const icon = document.querySelector('.sip-eth-stealth-icon')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('title', 'EIP-5564 Stealth Address')
    })
  })

  describe('ownership badge', () => {
    it('renders yours ownership', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} ownership="yours" />
      )

      expect(screen.getByText('Your Address')).toBeInTheDocument()
    })

    it('renders others ownership', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} ownership="others" />
      )

      expect(screen.getByText("Recipient's Address")).toBeInTheDocument()
    })

    it('renders unknown ownership by default', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('hides ownership badge when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          ownership="yours"
          showOwnership={false}
        />
      )

      expect(screen.queryByText('Your Address')).not.toBeInTheDocument()
    })
  })

  describe('network badge', () => {
    const networks: EthereumStealthNetworkId[] = [
      'mainnet',
      'arbitrum',
      'optimism',
      'base',
      'polygon',
      'sepolia',
    ]

    networks.forEach((network) => {
      it(`renders ${network} network badge`, () => {
        render(
          <EthereumStealthAddressDisplay address={VALID_ADDRESS} network={network} />
        )

        const config = ETHEREUM_STEALTH_NETWORKS[network]
        expect(screen.getByText(config.name)).toBeInTheDocument()
      })

      it(`marks ${network} as ${ETHEREUM_STEALTH_NETWORKS[network].isL2 ? 'L2' : 'mainnet'}`, () => {
        render(
          <EthereumStealthAddressDisplay address={VALID_ADDRESS} network={network} />
        )

        const badge = screen.getByText(ETHEREUM_STEALTH_NETWORKS[network].name)
        expect(badge).toHaveAttribute(
          'data-l2',
          ETHEREUM_STEALTH_NETWORKS[network].isL2.toString()
        )
      })
    })

    it('hides network badge when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          network="arbitrum"
          showNetworkBadge={false}
        />
      )

      expect(screen.queryByText('Arbitrum')).not.toBeInTheDocument()
    })
  })

  describe('EIP badge', () => {
    it('renders EIP-5564 badge by default', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.getByText('EIP-5564')).toBeInTheDocument()
    })

    it('hides EIP badge when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          showEipBadge={false}
        />
      )

      expect(screen.queryByText('EIP-5564')).not.toBeInTheDocument()
    })
  })

  describe('view tag', () => {
    it('renders view tag when provided', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} viewTag={42} />
      )

      expect(screen.getByText('View Tag: 42')).toBeInTheDocument()
    })

    it('does not render view tag when not provided', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.queryByText(/View Tag:/)).not.toBeInTheDocument()
    })

    it('hides view tag when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          viewTag={42}
          showViewTag={false}
        />
      )

      expect(screen.queryByText('View Tag: 42')).not.toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('shows valid for valid address', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const validation = document.querySelector('.sip-eth-stealth-validation')
      expect(validation).toHaveAttribute('data-valid', 'true')
      expect(screen.getByText('Valid stealth address')).toBeInTheDocument()
    })

    it('shows invalid for invalid address', () => {
      render(<EthereumStealthAddressDisplay address={INVALID_ADDRESS} />)

      const validation = document.querySelector('.sip-eth-stealth-validation')
      expect(validation).toHaveAttribute('data-valid', 'false')
      expect(screen.getByText('Invalid format')).toBeInTheDocument()
    })

    it('respects isValid prop override', () => {
      render(
        <EthereumStealthAddressDisplay
          address={INVALID_ADDRESS}
          isValid={true}
        />
      )

      const validation = document.querySelector('.sip-eth-stealth-validation')
      expect(validation).toHaveAttribute('data-valid', 'true')
    })

    it('hides validation when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          showValidation={false}
        />
      )

      expect(
        screen.queryByText('Valid stealth address')
      ).not.toBeInTheDocument()
    })
  })

  describe('ephemeral public key', () => {
    it('renders ephemeral key when provided', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          ephemeralPublicKey={VALID_EPHEMERAL_KEY}
        />
      )

      expect(screen.getByText('Ephemeral Key:')).toBeInTheDocument()
    })

    it('does not render ephemeral key section when not provided', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.queryByText('Ephemeral Key:')).not.toBeInTheDocument()
    })

    it('truncates ephemeral key for display', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          ephemeralPublicKey={VALID_EPHEMERAL_KEY}
        />
      )

      const keyElement = document.querySelector('.sip-eth-stealth-ephemeral-key')
      expect(keyElement?.textContent).toMatch(/0x02abc1\.\.\./)
    })

    it('calls onCopyEphemeralKey when copy button clicked', async () => {
      const onCopyEphemeralKey = vi.fn()
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          ephemeralPublicKey={VALID_EPHEMERAL_KEY}
          onCopyEphemeralKey={onCopyEphemeralKey}
        />
      )

      const copyButton = screen.getByLabelText('Copy ephemeral public key')
      fireEvent.click(copyButton)

      // Wait for async clipboard operation
      await vi.waitFor(() => {
        expect(onCopyEphemeralKey).toHaveBeenCalledWith(VALID_EPHEMERAL_KEY)
      })
    })
  })

  describe('copy functionality', () => {
    it('copies address on button click', async () => {
      const onCopy = vi.fn()
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} onCopy={onCopy} />
      )

      const copyButton = screen.getByLabelText('Copy address to clipboard')
      fireEvent.click(copyButton)

      // Wait for async clipboard operation
      await vi.waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(VALID_ADDRESS)
        expect(onCopy).toHaveBeenCalledWith(VALID_ADDRESS)
      })
    })

    it('shows copy success message', async () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const copyButton = screen.getByLabelText('Copy address to clipboard')
      fireEvent.click(copyButton)

      // Wait for state update
      await vi.waitFor(() => {
        const successMessage = document.querySelector('.sip-eth-stealth-copy-success')
        expect(successMessage).toHaveClass('visible')
      })
    })

    it('hides copy button when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          showCopyButton={false}
        />
      )

      expect(
        screen.queryByLabelText('Copy address to clipboard')
      ).not.toBeInTheDocument()
    })
  })

  describe('explorer link', () => {
    it('renders explorer link for mainnet', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} network="mainnet" />
      )

      const link = screen.getByLabelText('View on Etherscan')
      expect(link).toHaveAttribute(
        'href',
        `https://etherscan.io/address/${VALID_ADDRESS}`
      )
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('renders explorer link for Arbitrum', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} network="arbitrum" />
      )

      const link = screen.getByLabelText('View on Arbiscan')
      expect(link).toHaveAttribute(
        'href',
        `https://arbiscan.io/address/${VALID_ADDRESS}`
      )
    })

    it('renders explorer link for Optimism', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} network="optimism" />
      )

      const link = screen.getByLabelText('View on Optimism Explorer')
      expect(link).toHaveAttribute(
        'href',
        `https://optimistic.etherscan.io/address/${VALID_ADDRESS}`
      )
    })

    it('renders explorer link for Base', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} network="base" />
      )

      const link = screen.getByLabelText('View on BaseScan')
      expect(link).toHaveAttribute(
        'href',
        `https://basescan.org/address/${VALID_ADDRESS}`
      )
    })

    it('renders explorer link for Polygon', () => {
      render(
        <EthereumStealthAddressDisplay address={VALID_ADDRESS} network="polygon" />
      )

      const link = screen.getByLabelText('View on PolygonScan')
      expect(link).toHaveAttribute(
        'href',
        `https://polygonscan.com/address/${VALID_ADDRESS}`
      )
    })

    it('hides explorer link when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          showExplorerLink={false}
        />
      )

      expect(screen.queryByLabelText(/View on/)).not.toBeInTheDocument()
    })
  })

  describe('QR code modal', () => {
    it('opens QR modal on button click', () => {
      const onShowQr = vi.fn()
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          onShowQr={onShowQr}
        />
      )

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(onShowQr).toHaveBeenCalledWith(VALID_ADDRESS)
    })

    it('uses metaAddress for QR when provided', () => {
      const metaAddress = 'sip:ethereum:0x02abc...123:0x03def...456'
      const onShowQr = vi.fn()
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          metaAddress={metaAddress}
          onShowQr={onShowQr}
        />
      )

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      expect(onShowQr).toHaveBeenCalledWith(metaAddress)
    })

    it('closes QR modal on close button click', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      const closeButton = screen.getByText('Close')
      fireEvent.click(closeButton)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes QR modal on backdrop click', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      const modal = screen.getByRole('dialog')
      fireEvent.click(modal)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('hides QR button when disabled', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          showQrCode={false}
        />
      )

      expect(screen.queryByLabelText('Show QR code')).not.toBeInTheDocument()
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(
        <EthereumStealthAddressDisplay
          address={VALID_ADDRESS}
          className="my-custom-class"
        />
      )

      const container = screen.getByTestId('eth-stealth-address')
      expect(container).toHaveClass('my-custom-class')
    })
  })

  describe('accessibility', () => {
    it('has accessible copy button', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(
        screen.getByLabelText('Copy address to clipboard')
      ).toBeInTheDocument()
    })

    it('has accessible QR button', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.getByLabelText('Show QR code')).toBeInTheDocument()
    })

    it('has accessible explorer link', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      expect(screen.getByLabelText('View on Etherscan')).toBeInTheDocument()
    })

    it('has accessible validation indicator', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const validation = document.querySelector('.sip-eth-stealth-validation')
      expect(validation).toHaveAttribute(
        'aria-label',
        'Valid EIP-5564 stealth address'
      )
    })

    it('QR modal has correct aria attributes', () => {
      render(<EthereumStealthAddressDisplay address={VALID_ADDRESS} />)

      const qrButton = screen.getByLabelText('Show QR code')
      fireEvent.click(qrButton)

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'eth-qr-modal-title')
    })
  })
})

describe('Utility functions', () => {
  describe('isValidEthereumAddress', () => {
    it('returns true for valid checksummed address', () => {
      expect(isValidEthereumAddress(VALID_ADDRESS)).toBe(true)
    })

    it('returns true for lowercase address', () => {
      expect(isValidEthereumAddress(VALID_ADDRESS.toLowerCase())).toBe(true)
    })

    it('returns false for invalid address', () => {
      expect(isValidEthereumAddress(INVALID_ADDRESS)).toBe(false)
    })

    it('returns false for address without 0x prefix', () => {
      expect(
        isValidEthereumAddress(VALID_ADDRESS.slice(2))
      ).toBe(false)
    })

    it('returns false for address with wrong length', () => {
      expect(isValidEthereumAddress('0x742d35Cc6634C0532925a3b844Bc')).toBe(
        false
      )
    })
  })

  describe('isValidEthereumStealthAddress', () => {
    it('returns true for valid address', () => {
      expect(isValidEthereumStealthAddress(VALID_ADDRESS)).toBe(true)
    })

    it('returns false for invalid address', () => {
      expect(isValidEthereumStealthAddress(INVALID_ADDRESS)).toBe(false)
    })
  })

  describe('isValidEphemeralPublicKey', () => {
    it('returns true for valid compressed key (02 prefix)', () => {
      expect(isValidEphemeralPublicKey(VALID_EPHEMERAL_KEY)).toBe(true)
    })

    it('returns true for valid compressed key (03 prefix)', () => {
      const key03 =
        '0x03abc123def456789012345678901234567890123456789012345678901234abcd'
      expect(isValidEphemeralPublicKey(key03)).toBe(true)
    })

    it('returns true for valid uncompressed key', () => {
      const uncompressed =
        '0x04' + 'a'.repeat(128)
      expect(isValidEphemeralPublicKey(uncompressed)).toBe(true)
    })

    it('returns false for invalid key', () => {
      expect(isValidEphemeralPublicKey(INVALID_EPHEMERAL_KEY)).toBe(false)
    })

    it('returns false for key with wrong prefix', () => {
      const wrongPrefix =
        '0x05abc123def456789012345678901234567890123456789012345678901234abcd'
      expect(isValidEphemeralPublicKey(wrongPrefix)).toBe(false)
    })
  })

  describe('truncateEthereumAddress', () => {
    it('truncates address with default parameters', () => {
      const result = truncateEthereumAddress(VALID_ADDRESS)
      expect(result).toBe('0x742d...f44e')
    })

    it('truncates with custom start/end chars', () => {
      const result = truncateEthereumAddress(VALID_ADDRESS, 8, 6)
      expect(result).toBe('0x742d35...38f44e')
    })

    it('returns full address if shorter than truncation', () => {
      const shortAddr = '0x742d'
      const result = truncateEthereumAddress(shortAddr, 6, 4)
      expect(result).toBe(shortAddr)
    })
  })
})

describe('useEthereumStealthAddressDisplay', () => {
  function TestComponent({
    address,
    network,
    checkOwnership,
  }: {
    address: string
    network?: EthereumStealthNetworkId
    checkOwnership?: (addr: string) => EthereumOwnershipStatus
  }) {
    const result = useEthereumStealthAddressDisplay(address, {
      network,
      checkOwnership,
    })

    return (
      <div>
        <span data-testid="address">{result.address}</span>
        <span data-testid="truncated">{result.truncated}</span>
        <span data-testid="ownership">{result.ownership}</span>
        <span data-testid="isValid">{result.isValid.toString()}</span>
        <span data-testid="isStealth">{result.isStealth.toString()}</span>
        <span data-testid="network">{result.network}</span>
        <span data-testid="isL2">{result.isL2.toString()}</span>
        <span data-testid="explorerUrl">{result.explorerUrl}</span>
      </div>
    )
  }

  it('returns correct values for mainnet', () => {
    render(<TestComponent address={VALID_ADDRESS} network="mainnet" />)

    expect(screen.getByTestId('address')).toHaveTextContent(VALID_ADDRESS)
    expect(screen.getByTestId('truncated')).toHaveTextContent('0x742d...f44e')
    expect(screen.getByTestId('ownership')).toHaveTextContent('unknown')
    expect(screen.getByTestId('isValid')).toHaveTextContent('true')
    expect(screen.getByTestId('isStealth')).toHaveTextContent('true')
    expect(screen.getByTestId('network')).toHaveTextContent('mainnet')
    expect(screen.getByTestId('isL2')).toHaveTextContent('false')
    expect(screen.getByTestId('explorerUrl')).toHaveTextContent(
      `https://etherscan.io/address/${VALID_ADDRESS}`
    )
  })

  it('returns correct values for L2 network', () => {
    render(<TestComponent address={VALID_ADDRESS} network="arbitrum" />)

    expect(screen.getByTestId('network')).toHaveTextContent('arbitrum')
    expect(screen.getByTestId('isL2')).toHaveTextContent('true')
    expect(screen.getByTestId('explorerUrl')).toHaveTextContent(
      `https://arbiscan.io/address/${VALID_ADDRESS}`
    )
  })

  it('uses custom ownership checker', () => {
    const checkOwnership = vi.fn().mockReturnValue('yours')
    render(
      <TestComponent
        address={VALID_ADDRESS}
        checkOwnership={checkOwnership}
      />
    )

    expect(checkOwnership).toHaveBeenCalledWith(VALID_ADDRESS)
    expect(screen.getByTestId('ownership')).toHaveTextContent('yours')
  })

  it('returns false for invalid address', () => {
    render(<TestComponent address={INVALID_ADDRESS} />)

    expect(screen.getByTestId('isValid')).toHaveTextContent('false')
    expect(screen.getByTestId('isStealth')).toHaveTextContent('false')
  })
})

describe('ETHEREUM_STEALTH_NETWORKS', () => {
  it('has all required networks', () => {
    expect(ETHEREUM_STEALTH_NETWORKS.mainnet).toBeDefined()
    expect(ETHEREUM_STEALTH_NETWORKS.arbitrum).toBeDefined()
    expect(ETHEREUM_STEALTH_NETWORKS.optimism).toBeDefined()
    expect(ETHEREUM_STEALTH_NETWORKS.base).toBeDefined()
    expect(ETHEREUM_STEALTH_NETWORKS.polygon).toBeDefined()
    expect(ETHEREUM_STEALTH_NETWORKS.sepolia).toBeDefined()
  })

  it('has correct chain IDs', () => {
    expect(ETHEREUM_STEALTH_NETWORKS.mainnet.chainId).toBe(1)
    expect(ETHEREUM_STEALTH_NETWORKS.arbitrum.chainId).toBe(42161)
    expect(ETHEREUM_STEALTH_NETWORKS.optimism.chainId).toBe(10)
    expect(ETHEREUM_STEALTH_NETWORKS.base.chainId).toBe(8453)
    expect(ETHEREUM_STEALTH_NETWORKS.polygon.chainId).toBe(137)
    expect(ETHEREUM_STEALTH_NETWORKS.sepolia.chainId).toBe(11155111)
  })

  it('has correct L2 flags', () => {
    expect(ETHEREUM_STEALTH_NETWORKS.mainnet.isL2).toBe(false)
    expect(ETHEREUM_STEALTH_NETWORKS.arbitrum.isL2).toBe(true)
    expect(ETHEREUM_STEALTH_NETWORKS.optimism.isL2).toBe(true)
    expect(ETHEREUM_STEALTH_NETWORKS.base.isL2).toBe(true)
    expect(ETHEREUM_STEALTH_NETWORKS.polygon.isL2).toBe(true)
    expect(ETHEREUM_STEALTH_NETWORKS.sepolia.isL2).toBe(false)
  })
})
