/**
 * EthereumPrivacyToggle Component Tests
 *
 * Tests for the Ethereum-specific privacy toggle with EIP-5564 support
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  EthereumPrivacyToggle,
  useEthereumPrivacyToggle,
  type EthereumPrivacyLevel,
} from '../../../src/components/ethereum/privacy-toggle'

describe('EthereumPrivacyToggle', () => {
  // Helper to get radio options by their exact level
  const getPublicOption = () =>
    screen.getByRole('radio', { name: /^Public:/ })
  const getStealthOption = () =>
    screen.getByRole('radio', { name: /^Stealth:/ })
  const getCompliantOption = () =>
    screen.getByRole('radio', { name: /^Compliant:/ })

  describe('rendering', () => {
    it('renders all three privacy options', () => {
      render(<EthereumPrivacyToggle />)

      expect(getPublicOption()).toBeInTheDocument()
      expect(getStealthOption()).toBeInTheDocument()
      expect(getCompliantOption()).toBeInTheDocument()
    })

    it('renders with default value of stealth', () => {
      render(<EthereumPrivacyToggle />)

      const stealthOption = getStealthOption()
      expect(stealthOption).toHaveAttribute('aria-checked', 'true')
    })

    it('renders with custom default value', () => {
      render(<EthereumPrivacyToggle defaultValue="compliant" />)

      const compliantOption = getCompliantOption()
      expect(compliantOption).toHaveAttribute('aria-checked', 'true')
    })

    it('renders controlled value', () => {
      render(<EthereumPrivacyToggle value="public" />)

      const publicOption = getPublicOption()
      expect(publicOption).toHaveAttribute('aria-checked', 'true')
    })

    it('renders network badge', () => {
      render(<EthereumPrivacyToggle network="arbitrum" />)

      expect(screen.getByText('Arbitrum')).toBeInTheDocument()
    })

    it('renders EIP references when enabled', () => {
      render(<EthereumPrivacyToggle showEipReferences />)

      expect(screen.getByText('EIP-5564')).toBeInTheDocument()
      expect(screen.getByText('EIP-5564 + EIP-6538')).toBeInTheDocument()
    })

    it('hides EIP references when disabled', () => {
      render(<EthereumPrivacyToggle showEipReferences={false} />)

      expect(screen.queryByText('EIP-5564')).not.toBeInTheDocument()
    })

    it('renders in compact mode', () => {
      render(<EthereumPrivacyToggle compact />)

      // In compact mode, only icons show (no labels)
      const options = screen.getAllByRole('radio')
      options.forEach(option => {
        expect(option).toHaveAttribute('data-compact', 'true')
      })
    })
  })

  describe('size variants', () => {
    it('renders small size', () => {
      render(<EthereumPrivacyToggle size="sm" />)

      const options = screen.getAllByRole('radio')
      options.forEach(option => {
        expect(option).toHaveAttribute('data-size', 'sm')
      })
    })

    it('renders medium size (default)', () => {
      render(<EthereumPrivacyToggle />)

      const options = screen.getAllByRole('radio')
      options.forEach(option => {
        expect(option).toHaveAttribute('data-size', 'md')
      })
    })

    it('renders large size', () => {
      render(<EthereumPrivacyToggle size="lg" />)

      const options = screen.getAllByRole('radio')
      options.forEach(option => {
        expect(option).toHaveAttribute('data-size', 'lg')
      })
    })
  })

  describe('networks', () => {
    const networks: Array<{
      network: 'mainnet' | 'arbitrum' | 'optimism' | 'base' | 'polygon' | 'sepolia'
      displayName: string
      isL2: boolean
    }> = [
      { network: 'mainnet', displayName: 'Ethereum', isL2: false },
      { network: 'arbitrum', displayName: 'Arbitrum', isL2: true },
      { network: 'optimism', displayName: 'Optimism', isL2: true },
      { network: 'base', displayName: 'Base', isL2: true },
      { network: 'polygon', displayName: 'Polygon', isL2: true },
      { network: 'sepolia', displayName: 'Sepolia', isL2: false },
    ]

    networks.forEach(({ network, displayName, isL2 }) => {
      it(`renders ${displayName} network badge`, () => {
        render(<EthereumPrivacyToggle network={network} />)

        expect(screen.getByText(displayName)).toBeInTheDocument()
      })

      it(`marks ${displayName} as ${isL2 ? 'L2' : 'non-L2'}`, () => {
        render(<EthereumPrivacyToggle network={network} />)

        const badge = screen.getByText(displayName).closest('.sip-eth-privacy-network-badge')
        expect(badge).toHaveAttribute('data-l2', isL2.toString())
      })
    })

    it('shows L2 savings badge when enabled', () => {
      render(<EthereumPrivacyToggle network="base" showL2Savings />)

      expect(screen.getByText(/cheaper/i)).toBeInTheDocument()
    })

    it('does not show L2 savings for mainnet', () => {
      render(<EthereumPrivacyToggle network="mainnet" showL2Savings />)

      expect(screen.queryByText(/cheaper/i)).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onChange when option is clicked', async () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle onChange={onChange} />)

      const publicOption = getPublicOption()
      fireEvent.click(publicOption)

      expect(onChange).toHaveBeenCalledWith('public')
    })

    it('updates selection in uncontrolled mode', async () => {
      render(<EthereumPrivacyToggle defaultValue="stealth" />)

      const compliantOption = getCompliantOption()
      fireEvent.click(compliantOption)

      expect(compliantOption).toHaveAttribute('aria-checked', 'true')
      expect(getStealthOption()).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    it('respects controlled value', async () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="stealth" onChange={onChange} />)

      const publicOption = getPublicOption()
      fireEvent.click(publicOption)

      // Should call onChange but not update visually (controlled)
      expect(onChange).toHaveBeenCalledWith('public')
      expect(getStealthOption()).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })

    it('is disabled when disabled prop is true', async () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle disabled onChange={onChange} />)

      const publicOption = getPublicOption()
      fireEvent.click(publicOption)

      expect(onChange).not.toHaveBeenCalled()
      expect(publicOption).toBeDisabled()
    })
  })

  describe('keyboard navigation', () => {
    it('navigates with arrow right', () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="public" onChange={onChange} />)

      const publicOption = getPublicOption()
      fireEvent.keyDown(publicOption, { key: 'ArrowRight' })

      expect(onChange).toHaveBeenCalledWith('stealth')
    })

    it('navigates with arrow left', () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="stealth" onChange={onChange} />)

      const stealthOption = getStealthOption()
      fireEvent.keyDown(stealthOption, { key: 'ArrowLeft' })

      expect(onChange).toHaveBeenCalledWith('public')
    })

    it('wraps around with arrow right', () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="compliant" onChange={onChange} />)

      const compliantOption = getCompliantOption()
      fireEvent.keyDown(compliantOption, { key: 'ArrowRight' })

      expect(onChange).toHaveBeenCalledWith('public')
    })

    it('navigates to first with Home key', () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="compliant" onChange={onChange} />)

      const compliantOption = getCompliantOption()
      fireEvent.keyDown(compliantOption, { key: 'Home' })

      expect(onChange).toHaveBeenCalledWith('public')
    })

    it('navigates to last with End key', () => {
      const onChange = vi.fn()
      render(<EthereumPrivacyToggle value="public" onChange={onChange} />)

      const publicOption = getPublicOption()
      fireEvent.keyDown(publicOption, { key: 'End' })

      expect(onChange).toHaveBeenCalledWith('compliant')
    })
  })

  describe('gas estimates', () => {
    it('shows gas estimate info when enabled', () => {
      render(<EthereumPrivacyToggle showGasEstimate />)

      expect(screen.getByText(/est\. gas/i)).toBeInTheDocument()
    })

    it('hides gas estimate info when disabled', () => {
      render(<EthereumPrivacyToggle showGasEstimate={false} />)

      expect(screen.queryByText(/est\. gas/i)).not.toBeInTheDocument()
    })

    it('uses custom gas estimates', () => {
      render(
        <EthereumPrivacyToggle
          showGasEstimate
          value="stealth"
          gasEstimates={{
            public: {
              gasUnits: 21000n,
              gasPriceGwei: 30,
              costEth: '0.000630',
            },
            stealth: {
              gasUnits: 85000n,
              gasPriceGwei: 30,
              costEth: '0.002550',
            },
            compliant: {
              gasUnits: 120000n,
              gasPriceGwei: 30,
              costEth: '0.003600',
            },
          }}
        />
      )

      expect(screen.getByText(/0\.002550/)).toBeInTheDocument()
    })

    it('shows gas units', () => {
      render(<EthereumPrivacyToggle showGasEstimate value="stealth" />)

      expect(screen.getByText(/85000 units/i)).toBeInTheDocument()
    })

    it('shows L1 data cost for L2 networks', () => {
      render(<EthereumPrivacyToggle showGasEstimate network="arbitrum" />)

      expect(screen.getByText(/L1 data/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has correct aria-label', () => {
      render(<EthereumPrivacyToggle aria-label="Select privacy" />)

      expect(screen.getByRole('radiogroup')).toHaveAttribute(
        'aria-label',
        'Select privacy'
      )
    })

    it('uses radiogroup role', () => {
      render(<EthereumPrivacyToggle />)

      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('marks selected option with aria-checked', () => {
      render(<EthereumPrivacyToggle value="stealth" />)

      expect(getStealthOption()).toHaveAttribute(
        'aria-checked',
        'true'
      )
      expect(getPublicOption()).toHaveAttribute(
        'aria-checked',
        'false'
      )
    })

    it('has tooltips with role tooltip', () => {
      render(<EthereumPrivacyToggle showTooltips />)

      // Tooltips are hidden by default, use querySelector to find them
      const container = document.querySelector('.sip-eth-privacy-toggle')
      const tooltips = container?.querySelectorAll('[role="tooltip"]')
      expect(tooltips?.length).toBe(3)
    })
  })
})

describe('useEthereumPrivacyToggle', () => {
  function TestComponent({ initialValue }: { initialValue?: EthereumPrivacyLevel }) {
    const {
      privacyLevel,
      setPrivacyLevel,
      isPrivate,
      isCompliant,
      isStealth,
      setPublic,
      setStealth,
      setCompliant,
      eipStandard,
    } = useEthereumPrivacyToggle(initialValue)

    return (
      <div>
        <span data-testid="level">{privacyLevel}</span>
        <span data-testid="isPrivate">{isPrivate.toString()}</span>
        <span data-testid="isCompliant">{isCompliant.toString()}</span>
        <span data-testid="isStealth">{isStealth.toString()}</span>
        <span data-testid="eipStandard">{eipStandard ?? 'none'}</span>
        <button onClick={setPublic}>Set Public</button>
        <button onClick={setStealth}>Set Stealth</button>
        <button onClick={setCompliant}>Set Compliant</button>
        <button onClick={() => setPrivacyLevel('public')}>Direct Set</button>
      </div>
    )
  }

  it('initializes with default value (stealth)', () => {
    render(<TestComponent />)

    expect(screen.getByTestId('level')).toHaveTextContent('stealth')
    expect(screen.getByTestId('isPrivate')).toHaveTextContent('true')
    expect(screen.getByTestId('isStealth')).toHaveTextContent('true')
    expect(screen.getByTestId('isCompliant')).toHaveTextContent('false')
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('EIP-5564')
  })

  it('initializes with custom value', () => {
    render(<TestComponent initialValue="compliant" />)

    expect(screen.getByTestId('level')).toHaveTextContent('compliant')
    expect(screen.getByTestId('isCompliant')).toHaveTextContent('true')
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('EIP-5564 + EIP-6538')
  })

  it('setPublic sets level to public', async () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Set Public'))

    expect(screen.getByTestId('level')).toHaveTextContent('public')
    expect(screen.getByTestId('isPrivate')).toHaveTextContent('false')
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('none')
  })

  it('setStealth sets level to stealth', async () => {
    render(<TestComponent initialValue="public" />)

    fireEvent.click(screen.getByText('Set Stealth'))

    expect(screen.getByTestId('level')).toHaveTextContent('stealth')
    expect(screen.getByTestId('isStealth')).toHaveTextContent('true')
  })

  it('setCompliant sets level to compliant', async () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Set Compliant'))

    expect(screen.getByTestId('level')).toHaveTextContent('compliant')
    expect(screen.getByTestId('isCompliant')).toHaveTextContent('true')
  })

  it('setPrivacyLevel sets level directly', async () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Direct Set'))

    expect(screen.getByTestId('level')).toHaveTextContent('public')
  })

  it('returns correct EIP standard for each level', async () => {
    render(<TestComponent initialValue="public" />)
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('none')

    fireEvent.click(screen.getByText('Set Stealth'))
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('EIP-5564')

    fireEvent.click(screen.getByText('Set Compliant'))
    expect(screen.getByTestId('eipStandard')).toHaveTextContent('EIP-5564 + EIP-6538')
  })
})
