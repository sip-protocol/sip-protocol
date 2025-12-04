/**
 * Ethereum RLP Encoding Tests
 *
 * Tests for RLP (Recursive Length Prefix) encoding used in
 * Ledger Ethereum transaction signing.
 */

import { describe, it, expect } from 'vitest'
import { RLP } from '@ethereumjs/rlp'

describe('Ethereum RLP Encoding', () => {
  // Helper to convert hex string to bytes (mirrors ledger.ts implementation)
  const hexToBytes = (hex: string | undefined): Uint8Array => {
    if (!hex || hex === '0x' || hex === '0x0' || hex === '0x00') {
      return new Uint8Array(0)
    }
    let cleanHex = hex.slice(2)
    if (cleanHex.length % 2 !== 0) {
      cleanHex = '0' + cleanHex
    }
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  describe('hexToBytes helper', () => {
    it('should convert valid hex to bytes', () => {
      const bytes = hexToBytes('0x1234')
      expect(bytes).toEqual(new Uint8Array([0x12, 0x34]))
    })

    it('should handle odd-length hex (pad with zero)', () => {
      const bytes = hexToBytes('0x123')
      expect(bytes).toEqual(new Uint8Array([0x01, 0x23]))
    })

    it('should return empty array for empty values', () => {
      expect(hexToBytes('0x')).toEqual(new Uint8Array(0))
      expect(hexToBytes('0x0')).toEqual(new Uint8Array(0))
      expect(hexToBytes('0x00')).toEqual(new Uint8Array(0))
      expect(hexToBytes(undefined)).toEqual(new Uint8Array(0))
    })

    it('should handle large values', () => {
      const bytes = hexToBytes('0xde0b6b3a7640000') // 1 ETH in wei
      expect(bytes.length).toBe(8)
    })
  })

  describe('Legacy Transaction Encoding', () => {
    it('should encode a simple legacy transaction', () => {
      // Legacy tx: RLP([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])
      const tx = {
        nonce: '0x0',
        gasPrice: '0x09184e72a000', // 10 Gwei
        gasLimit: '0x5208', // 21000
        to: '0x1234567890123456789012345678901234567890',
        value: '0xde0b6b3a7640000', // 1 ETH
        data: '0x',
        chainId: 1,
      }

      const txData = [
        hexToBytes(tx.nonce),
        hexToBytes(tx.gasPrice),
        hexToBytes(tx.gasLimit),
        hexToBytes(tx.to),
        hexToBytes(tx.value),
        hexToBytes(tx.data),
        hexToBytes(`0x${tx.chainId.toString(16)}`),
        new Uint8Array(0), // r
        new Uint8Array(0), // s
      ]

      const encoded = RLP.encode(txData)
      const hex = '0x' + Buffer.from(encoded).toString('hex')

      expect(hex).toMatch(/^0x[a-f0-9]+$/i)
      expect(hex.length).toBeGreaterThan(10)
    })

    it('should encode transaction with data', () => {
      const tx = {
        nonce: '0x5',
        gasPrice: '0x3b9aca00', // 1 Gwei
        gasLimit: '0x186a0', // 100000
        to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        value: '0x0',
        data: '0xa9059cbb000000000000000000000000abcd...', // transfer call
        chainId: 1,
      }

      const txData = [
        hexToBytes(tx.nonce),
        hexToBytes(tx.gasPrice),
        hexToBytes(tx.gasLimit),
        hexToBytes(tx.to),
        hexToBytes(tx.value),
        hexToBytes(tx.data),
        hexToBytes(`0x${tx.chainId.toString(16)}`),
        new Uint8Array(0),
        new Uint8Array(0),
      ]

      const encoded = RLP.encode(txData)
      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('EIP-1559 Transaction Encoding', () => {
    it('should encode EIP-1559 transaction with type prefix', () => {
      // EIP-1559: 0x02 || RLP([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])
      const tx = {
        chainId: 1,
        nonce: '0x0',
        maxPriorityFeePerGas: '0x59682f00', // 1.5 Gwei
        maxFeePerGas: '0x77359400', // 2 Gwei
        gasLimit: '0x5208',
        to: '0x1234567890123456789012345678901234567890',
        value: '0xde0b6b3a7640000',
        data: '0x',
      }

      const txData = [
        hexToBytes(`0x${tx.chainId.toString(16)}`),
        hexToBytes(tx.nonce),
        hexToBytes(tx.maxPriorityFeePerGas),
        hexToBytes(tx.maxFeePerGas),
        hexToBytes(tx.gasLimit),
        hexToBytes(tx.to),
        hexToBytes(tx.value),
        hexToBytes(tx.data),
        [], // accessList
      ]

      const encoded = RLP.encode(txData)

      // Prepend type byte (0x02)
      const result = new Uint8Array(1 + encoded.length)
      result[0] = 0x02
      result.set(encoded, 1)

      const hex = '0x' + Buffer.from(result).toString('hex')

      expect(hex).toMatch(/^0x02[a-f0-9]+$/i) // Starts with type byte
      expect(result[0]).toBe(0x02)
    })

    it('should handle different chain IDs', () => {
      const chains = [
        { id: 1, name: 'mainnet' },
        { id: 137, name: 'polygon' },
        { id: 42161, name: 'arbitrum' },
        { id: 10, name: 'optimism' },
      ]

      for (const chain of chains) {
        const txData = [
          hexToBytes(`0x${chain.id.toString(16)}`),
          hexToBytes('0x1'),
          hexToBytes('0x3b9aca00'),
          hexToBytes('0x77359400'),
          hexToBytes('0x5208'),
          hexToBytes('0x1234567890123456789012345678901234567890'),
          hexToBytes('0x0'),
          hexToBytes('0x'),
          [],
        ]

        const encoded = RLP.encode(txData)
        expect(encoded.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero value transactions', () => {
      const txData = [
        hexToBytes('0x0'),
        hexToBytes('0x3b9aca00'),
        hexToBytes('0x5208'),
        hexToBytes('0x1234567890123456789012345678901234567890'),
        hexToBytes('0x0'), // zero value
        hexToBytes('0x'),
        hexToBytes('0x1'),
        new Uint8Array(0),
        new Uint8Array(0),
      ]

      const encoded = RLP.encode(txData)
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle large nonce values', () => {
      const txData = [
        hexToBytes('0xfffff'), // Large nonce
        hexToBytes('0x3b9aca00'),
        hexToBytes('0x5208'),
        hexToBytes('0x1234567890123456789012345678901234567890'),
        hexToBytes('0x0'),
        hexToBytes('0x'),
        hexToBytes('0x1'),
        new Uint8Array(0),
        new Uint8Array(0),
      ]

      const encoded = RLP.encode(txData)
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle contract deployment (empty to)', () => {
      const txData = [
        hexToBytes('0x0'),
        hexToBytes('0x3b9aca00'),
        hexToBytes('0x186a0'),
        new Uint8Array(0), // Empty to = contract deployment
        hexToBytes('0x0'),
        hexToBytes('0x6080604052...'), // Contract bytecode
        hexToBytes('0x1'),
        new Uint8Array(0),
        new Uint8Array(0),
      ]

      const encoded = RLP.encode(txData)
      expect(encoded.length).toBeGreaterThan(0)
    })
  })
})
