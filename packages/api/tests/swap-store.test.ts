import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SwapStore, type SwapData } from '../src/stores/swap-store'

describe('SwapStore', () => {
  let store: SwapStore

  beforeEach(() => {
    // Create fresh store for each test
    store = new SwapStore({ maxSize: 100, ttlMs: 1000 })
  })

  afterEach(() => {
    store.clear()
  })

  describe('basic operations', () => {
    it('should set and get swap data', () => {
      const swap: SwapData = {
        id: 'swap-1',
        status: 'pending',
        inputAmount: '1000000000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      store.set('swap-1', swap)
      const retrieved = store.get('swap-1')

      expect(retrieved).toEqual(swap)
    })

    it('should return undefined for non-existent swap', () => {
      expect(store.get('non-existent')).toBeUndefined()
    })

    it('should check if swap exists', () => {
      const swap: SwapData = {
        id: 'swap-1',
        status: 'pending',
        inputAmount: '1000000000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(store.has('swap-1')).toBe(false)
      store.set('swap-1', swap)
      expect(store.has('swap-1')).toBe(true)
    })

    it('should delete swap', () => {
      const swap: SwapData = {
        id: 'swap-1',
        status: 'pending',
        inputAmount: '1000000000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      store.set('swap-1', swap)
      expect(store.has('swap-1')).toBe(true)

      const deleted = store.delete('swap-1')
      expect(deleted).toBe(true)
      expect(store.has('swap-1')).toBe(false)
    })
  })

  describe('updateStatus', () => {
    it('should update swap status', async () => {
      const oldDate = '2020-01-01T00:00:00.000Z'
      const swap: SwapData = {
        id: 'swap-1',
        status: 'pending',
        inputAmount: '1000000000',
        createdAt: oldDate,
        updatedAt: oldDate,
      }

      store.set('swap-1', swap)

      // Small delay to ensure updatedAt will be different
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = store.updateStatus('swap-1', 'completed', {
        outputAmount: '950000000',
        transactionHash: '0xabc123',
      })

      expect(updated).toBeDefined()
      expect(updated?.status).toBe('completed')
      expect(updated?.outputAmount).toBe('950000000')
      expect(updated?.transactionHash).toBe('0xabc123')
      expect(updated?.updatedAt).not.toBe(oldDate)
    })

    it('should return undefined for non-existent swap', () => {
      const result = store.updateStatus('non-existent', 'completed')
      expect(result).toBeUndefined()
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entries when at max size', () => {
      const smallStore = new SwapStore({ maxSize: 3, ttlMs: 60000 })

      // Add 3 swaps
      for (let i = 1; i <= 3; i++) {
        smallStore.set(`swap-${i}`, {
          id: `swap-${i}`,
          status: 'pending',
          inputAmount: '1000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      expect(smallStore.getMetrics().size).toBe(3)

      // Add 4th swap - should evict swap-1
      smallStore.set('swap-4', {
        id: 'swap-4',
        status: 'pending',
        inputAmount: '1000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      expect(smallStore.getMetrics().size).toBe(3)
      expect(smallStore.has('swap-1')).toBe(false) // Evicted
      expect(smallStore.has('swap-4')).toBe(true) // Added
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      // Store with 100ms TTL
      const ttlStore = new SwapStore({ maxSize: 100, ttlMs: 100 })

      ttlStore.set('swap-1', {
        id: 'swap-1',
        status: 'pending',
        inputAmount: '1000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      expect(ttlStore.has('swap-1')).toBe(true)

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Entry should be expired
      expect(ttlStore.get('swap-1')).toBeUndefined()
    })
  })

  describe('metrics', () => {
    it('should return accurate metrics', () => {
      const metrics = store.getMetrics()

      expect(metrics.size).toBe(0)
      expect(metrics.maxSize).toBe(100)
      expect(metrics.ttlMs).toBe(1000)
      expect(metrics.utilizationPercent).toBe(0)

      // Add some swaps
      for (let i = 1; i <= 50; i++) {
        store.set(`swap-${i}`, {
          id: `swap-${i}`,
          status: 'pending',
          inputAmount: '1000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      const updatedMetrics = store.getMetrics()
      expect(updatedMetrics.size).toBe(50)
      expect(updatedMetrics.utilizationPercent).toBe(50)
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      for (let i = 1; i <= 10; i++) {
        store.set(`swap-${i}`, {
          id: `swap-${i}`,
          status: 'pending',
          inputAmount: '1000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      expect(store.getMetrics().size).toBe(10)

      store.clear()

      expect(store.getMetrics().size).toBe(0)
    })
  })

  describe('default configuration', () => {
    it('should use default values when not configured', () => {
      const defaultStore = new SwapStore()
      const metrics = defaultStore.getMetrics()

      expect(metrics.maxSize).toBe(10_000)
      expect(metrics.ttlMs).toBe(24 * 60 * 60 * 1000) // 24 hours
    })
  })
})
