import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TTLCache } from '../src/cache'

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns undefined on miss', () => {
    const cache = new TTLCache<string>(1000)
    expect(cache.get('nope')).toBeUndefined()
  })

  it('returns value within TTL', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('expires after TTL', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    vi.advanceTimersByTime(1001)
    expect(cache.get('key')).toBeUndefined()
  })

  it('invalidates explicitly', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('key', 'value')
    cache.invalidate('key')
    expect(cache.get('key')).toBeUndefined()
  })

  it('clears all entries', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('per-entry TTL overrides default', () => {
    const cache = new TTLCache<string>(1000)
    cache.set('short', 'v', 500)
    vi.advanceTimersByTime(600)
    expect(cache.get('short')).toBeUndefined()
  })
})
