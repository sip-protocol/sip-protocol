import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import {
  PrivacyToggle,
  usePrivacyToggle,
  type PrivacyLevel,
  type GasEstimate,
} from '../../src/components/privacy-toggle'

describe('PrivacyToggle', () => {
  // Helper to get option by level
  const getOptionByLevel = (container: HTMLElement, level: PrivacyLevel) => {
    return container.querySelector(`[data-level="${level}"]`) as HTMLElement
  }

  // ─── Basic Rendering ────────────────────────────────────────────────────────

  describe('Basic Rendering', () => {
    it('should render all three privacy options', () => {
      const { container } = render(<PrivacyToggle />)

      expect(getOptionByLevel(container, 'off')).toBeTruthy()
      expect(getOptionByLevel(container, 'shielded')).toBeTruthy()
      expect(getOptionByLevel(container, 'compliant')).toBeTruthy()
    })

    it('should have shielded as default value', () => {
      const { container } = render(<PrivacyToggle />)

      const shieldedOption = getOptionByLevel(container, 'shielded')
      expect(shieldedOption?.getAttribute('aria-checked')).toBe('true')
    })

    it('should render with custom default value', () => {
      const { container } = render(<PrivacyToggle defaultValue="compliant" />)

      const compliantOption = getOptionByLevel(container, 'compliant')
      expect(compliantOption?.getAttribute('aria-checked')).toBe('true')
    })

    it('should render with controlled value', () => {
      const { container } = render(<PrivacyToggle value="off" />)

      const publicOption = getOptionByLevel(container, 'off')
      expect(publicOption?.getAttribute('aria-checked')).toBe('true')
    })

    it('should render radiogroup with proper aria-label', () => {
      render(<PrivacyToggle aria-label="Transaction privacy" />)

      const group = screen.getByRole('radiogroup', { name: 'Transaction privacy' })
      expect(group).toBeTruthy()
    })
  })

  // ─── Interaction ────────────────────────────────────────────────────────────

  describe('Interaction', () => {
    it('should call onChange when clicking an option', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle onChange={onChange} />)

      const publicOption = getOptionByLevel(container, 'off')
      fireEvent.click(publicOption!)

      expect(onChange).toHaveBeenCalledWith('off')
    })

    it('should update internal state in uncontrolled mode', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle onChange={onChange} />)

      // Initially shielded
      expect(getOptionByLevel(container, 'shielded')?.getAttribute('aria-checked')).toBe('true')

      // Click public
      fireEvent.click(getOptionByLevel(container, 'off')!)

      // Now public should be selected
      expect(getOptionByLevel(container, 'off')?.getAttribute('aria-checked')).toBe('true')
    })

    it('should not update internal state in controlled mode', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle value="shielded" onChange={onChange} />)

      fireEvent.click(getOptionByLevel(container, 'off')!)

      // onChange called but aria-checked should still be on shielded (controlled)
      expect(onChange).toHaveBeenCalledWith('off')
      expect(getOptionByLevel(container, 'shielded')?.getAttribute('aria-checked')).toBe('true')
    })

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle disabled onChange={onChange} />)

      fireEvent.click(getOptionByLevel(container, 'off')!)

      expect(onChange).not.toHaveBeenCalled()
    })

    it('should apply disabled attribute to all options', () => {
      const { container } = render(<PrivacyToggle disabled />)

      const options = container.querySelectorAll('.sip-privacy-option')
      options.forEach(option => {
        expect(option.hasAttribute('disabled')).toBe(true)
      })
    })
  })

  // ─── Keyboard Navigation ────────────────────────────────────────────────────

  describe('Keyboard Navigation', () => {
    it('should navigate with ArrowRight', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="off" onChange={onChange} />)

      const publicOption = getOptionByLevel(container, 'off')
      fireEvent.keyDown(publicOption!, { key: 'ArrowRight' })

      expect(onChange).toHaveBeenCalledWith('shielded')
    })

    it('should navigate with ArrowLeft', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="shielded" onChange={onChange} />)

      const shieldedOption = getOptionByLevel(container, 'shielded')
      fireEvent.keyDown(shieldedOption!, { key: 'ArrowLeft' })

      expect(onChange).toHaveBeenCalledWith('off')
    })

    it('should wrap around with ArrowRight at end', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="compliant" onChange={onChange} />)

      const compliantOption = getOptionByLevel(container, 'compliant')
      fireEvent.keyDown(compliantOption!, { key: 'ArrowRight' })

      expect(onChange).toHaveBeenCalledWith('off')
    })

    it('should wrap around with ArrowLeft at start', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="off" onChange={onChange} />)

      const publicOption = getOptionByLevel(container, 'off')
      fireEvent.keyDown(publicOption!, { key: 'ArrowLeft' })

      expect(onChange).toHaveBeenCalledWith('compliant')
    })

    it('should navigate with Home key', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="compliant" onChange={onChange} />)

      const compliantOption = getOptionByLevel(container, 'compliant')
      fireEvent.keyDown(compliantOption!, { key: 'Home' })

      expect(onChange).toHaveBeenCalledWith('off')
    })

    it('should navigate with End key', () => {
      const onChange = vi.fn()
      const { container } = render(<PrivacyToggle defaultValue="off" onChange={onChange} />)

      const publicOption = getOptionByLevel(container, 'off')
      fireEvent.keyDown(publicOption!, { key: 'End' })

      expect(onChange).toHaveBeenCalledWith('compliant')
    })

    it('should have correct tabIndex', () => {
      const { container } = render(<PrivacyToggle defaultValue="shielded" />)

      expect(getOptionByLevel(container, 'off')?.getAttribute('tabindex')).toBe('-1')
      expect(getOptionByLevel(container, 'shielded')?.getAttribute('tabindex')).toBe('0')
      expect(getOptionByLevel(container, 'compliant')?.getAttribute('tabindex')).toBe('-1')
    })
  })

  // ─── Gas Estimates ──────────────────────────────────────────────────────────

  describe('Gas Estimates', () => {
    const gasEstimates: Record<PrivacyLevel, GasEstimate> = {
      off: { gas: '2500000000000', cost: '0.00025 NEAR' },
      shielded: { gas: '30000000000000', cost: '0.003 NEAR' },
      compliant: { gas: '35000000000000', cost: '0.0035 NEAR', costUsd: '$0.02' },
    }

    it('should not show gas estimate by default', () => {
      const { container } = render(<PrivacyToggle gasEstimates={gasEstimates} />)

      expect(container.querySelector('.sip-privacy-gas-info')).toBeNull()
    })

    it('should show gas estimate when enabled', () => {
      const { container } = render(<PrivacyToggle gasEstimates={gasEstimates} showGasEstimate />)

      expect(container.querySelector('.sip-privacy-gas-info')).toBeTruthy()
      expect(container.textContent).toContain('0.003 NEAR')
    })

    it('should update gas estimate when selection changes', () => {
      const { container } = render(<PrivacyToggle gasEstimates={gasEstimates} showGasEstimate />)

      // Default is shielded
      expect(container.textContent).toContain('0.003 NEAR')

      // Click public
      fireEvent.click(getOptionByLevel(container, 'off')!)

      expect(container.textContent).toContain('0.00025 NEAR')
    })

    it('should show USD cost when available', () => {
      const { container } = render(
        <PrivacyToggle
          gasEstimates={gasEstimates}
          showGasEstimate
          defaultValue="compliant"
        />
      )

      expect(container.textContent).toContain('0.0035 NEAR')
      expect(container.textContent).toContain('$0.02')
    })
  })

  // ─── Tooltips ───────────────────────────────────────────────────────────────

  describe('Tooltips', () => {
    it('should show tooltips by default', () => {
      const { container } = render(<PrivacyToggle />)

      const tooltips = container.querySelectorAll('.sip-privacy-tooltip')
      expect(tooltips.length).toBe(3)
    })

    it('should hide tooltips when disabled', () => {
      const { container } = render(<PrivacyToggle showTooltips={false} />)

      const tooltips = container.querySelectorAll('.sip-privacy-tooltip')
      expect(tooltips.length).toBe(0)
    })

    it('should have correct tooltip content', () => {
      const { container } = render(<PrivacyToggle />)

      const tooltipTexts = Array.from(container.querySelectorAll('.sip-privacy-tooltip'))
        .map(t => t.textContent)

      expect(tooltipTexts.some(t => t?.includes('fully visible'))).toBe(true)
      expect(tooltipTexts.some(t => t?.includes('Full privacy'))).toBe(true)
      expect(tooltipTexts.some(t => t?.includes('viewing keys'))).toBe(true)
    })
  })

  // ─── Size Variants ──────────────────────────────────────────────────────────

  describe('Size Variants', () => {
    it('should apply size attribute to group', () => {
      const { container } = render(<PrivacyToggle size="lg" />)

      const group = container.querySelector('.sip-privacy-toggle-group')
      expect(group?.getAttribute('data-size')).toBe('lg')
    })

    it('should apply size attribute to options', () => {
      const { container } = render(<PrivacyToggle size="sm" />)

      const options = container.querySelectorAll('.sip-privacy-option')
      options.forEach(option => {
        expect(option.getAttribute('data-size')).toBe('sm')
      })
    })
  })

  // ─── Custom Class Name ──────────────────────────────────────────────────────

  describe('Custom Class Name', () => {
    it('should apply custom className', () => {
      const { container } = render(<PrivacyToggle className="my-custom-class" />)

      const toggle = container.querySelector('.sip-privacy-toggle')
      expect(toggle?.classList.contains('my-custom-class')).toBe(true)
    })
  })

  // ─── Chain Context ──────────────────────────────────────────────────────────

  describe('Chain Context', () => {
    it('should apply chain data attribute', () => {
      const { container } = render(<PrivacyToggle chain="ethereum" />)

      const toggle = container.querySelector('.sip-privacy-toggle')
      expect(toggle?.getAttribute('data-chain')).toBe('ethereum')
    })

    it('should default to near chain', () => {
      const { container } = render(<PrivacyToggle />)

      const toggle = container.querySelector('.sip-privacy-toggle')
      expect(toggle?.getAttribute('data-chain')).toBe('near')
    })
  })

  // ─── Accessibility ──────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('should have proper ARIA roles', () => {
      const { container } = render(<PrivacyToggle />)

      expect(container.querySelector('[role="radiogroup"]')).toBeTruthy()
      expect(container.querySelectorAll('[role="radio"]').length).toBe(3)
    })

    it('should have aria-checked on selected option', () => {
      const { container } = render(<PrivacyToggle defaultValue="compliant" />)

      expect(getOptionByLevel(container, 'compliant')?.getAttribute('aria-checked')).toBe('true')
      expect(getOptionByLevel(container, 'off')?.getAttribute('aria-checked')).toBe('false')
      expect(getOptionByLevel(container, 'shielded')?.getAttribute('aria-checked')).toBe('false')
    })

    it('should have aria-label on each option', () => {
      const { container } = render(<PrivacyToggle />)

      const options = container.querySelectorAll('.sip-privacy-option')
      options.forEach(option => {
        expect(option.hasAttribute('aria-label')).toBe(true)
        expect(option.getAttribute('aria-label')).not.toBe('')
      })
    })

    it('should have aria-live on gas info', () => {
      const gasEstimates: Record<PrivacyLevel, GasEstimate> = {
        off: { gas: '1', cost: '0.001 NEAR' },
        shielded: { gas: '2', cost: '0.002 NEAR' },
        compliant: { gas: '3', cost: '0.003 NEAR' },
      }

      const { container } = render(
        <PrivacyToggle gasEstimates={gasEstimates} showGasEstimate />
      )

      const gasInfo = container.querySelector('.sip-privacy-gas-info')
      expect(gasInfo?.getAttribute('aria-live')).toBe('polite')
    })
  })

  // ─── Data Attributes ────────────────────────────────────────────────────────

  describe('Data Attributes', () => {
    it('should have data-level on options', () => {
      const { container } = render(<PrivacyToggle />)

      const options = container.querySelectorAll('.sip-privacy-option')
      const levels = Array.from(options).map(opt => opt.getAttribute('data-level'))

      expect(levels).toContain('off')
      expect(levels).toContain('shielded')
      expect(levels).toContain('compliant')
    })
  })
})

describe('usePrivacyToggle', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    expect(result.current.privacyLevel).toBe('shielded')
  })

  it('should initialize with custom value', () => {
    const { result } = renderHook(() => usePrivacyToggle('compliant'))

    expect(result.current.privacyLevel).toBe('compliant')
  })

  it('should update privacy level', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    act(() => {
      result.current.setPrivacyLevel('off')
    })

    expect(result.current.privacyLevel).toBe('off')
  })

  it('should have correct isPrivate flag', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    expect(result.current.isPrivate).toBe(true) // shielded is private

    act(() => {
      result.current.setPrivacyLevel('off')
    })

    expect(result.current.isPrivate).toBe(false)

    act(() => {
      result.current.setPrivacyLevel('compliant')
    })

    expect(result.current.isPrivate).toBe(true)
  })

  it('should have correct isCompliant flag', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    expect(result.current.isCompliant).toBe(false)

    act(() => {
      result.current.setPrivacyLevel('compliant')
    })

    expect(result.current.isCompliant).toBe(true)
  })

  it('should have correct isShielded flag', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    expect(result.current.isShielded).toBe(true)

    act(() => {
      result.current.setPrivacyLevel('compliant')
    })

    expect(result.current.isShielded).toBe(false)
  })

  it('should provide setPublic helper', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    act(() => {
      result.current.setPublic()
    })

    expect(result.current.privacyLevel).toBe('off')
  })

  it('should provide setShielded helper', () => {
    const { result } = renderHook(() => usePrivacyToggle('off'))

    act(() => {
      result.current.setShielded()
    })

    expect(result.current.privacyLevel).toBe('shielded')
  })

  it('should provide setCompliant helper', () => {
    const { result } = renderHook(() => usePrivacyToggle())

    act(() => {
      result.current.setCompliant()
    })

    expect(result.current.privacyLevel).toBe('compliant')
  })
})
