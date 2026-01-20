/**
 * Persistent Cache Implementation for Proof Caching
 *
 * @module proofs/cache/persistent-cache
 * @description IndexedDB (browser) and file-based (Node.js) persistent caching
 *
 * M20-13: Implement proof caching layer (#313)
 */

import type { SingleProof } from '@sip-protocol/types'
import type {
  CacheKey,
  CacheEntryMetadata,
  CacheLookupResult,
  ProofCacheStats,
  CacheEvent,
  CacheEventListener,
  PersistentCacheConfig,
  IPersistentCache,
} from './interface'
import { DEFAULT_PERSISTENT_CONFIG, INITIAL_PROOF_CACHE_STATS } from './interface'

// ─── Environment Detection ───────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node !== undefined
}

// ─── IndexedDB Cache (Browser) ───────────────────────────────────────────────

const DB_VERSION = 1
const STORE_NAME = 'proofs'

/**
 * IndexedDB-based persistent cache for browsers
 */
export class IndexedDBCache<T = SingleProof> implements IPersistentCache<T> {
  private readonly config: PersistentCacheConfig
  private db: IDBDatabase | null = null
  private readonly listeners: Set<CacheEventListener> = new Set()
  private initialized = false

  // Statistics
  private totalLookups = 0
  private hits = 0
  private misses = 0
  private totalLookupTimeMs = 0

  constructor(config: Partial<PersistentCacheConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENT_CONFIG, ...config }
  }

  /**
   * Initialize the IndexedDB storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (!isBrowser()) {
      throw new Error('IndexedDB is only available in browser environments')
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.storageName, DB_VERSION)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          store.createIndex('expiresAt', 'metadata.expiresAt', { unique: false })
          store.createIndex('createdAt', 'metadata.createdAt', { unique: false })
        }
      }
    })
  }

  /**
   * Close the IndexedDB connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  /**
   * Check if IndexedDB is available
   */
  isAvailable(): boolean {
    return isBrowser() && typeof indexedDB !== 'undefined'
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; available: number; quota: number }> {
    if (!isBrowser() || !navigator.storage?.estimate) {
      return { used: 0, available: this.config.maxSizeBytes, quota: this.config.maxSizeBytes }
    }

    try {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage ?? 0,
        available: (estimate.quota ?? this.config.maxSizeBytes) - (estimate.usage ?? 0),
        quota: estimate.quota ?? this.config.maxSizeBytes,
      }
    } catch {
      return { used: 0, available: this.config.maxSizeBytes, quota: this.config.maxSizeBytes }
    }
  }

  /**
   * Compact the storage (remove expired entries)
   */
  async compact(): Promise<void> {
    if (!this.db) return

    const now = Date.now()
    const transaction = this.db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('expiresAt')

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(1, now) // Entries with expiresAt between 1 and now
      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Get an entry from the cache
   */
  async get(key: CacheKey | string): Promise<CacheLookupResult<T>> {
    const startTime = Date.now()
    const keyStr = typeof key === 'string' ? key : key.key

    this.totalLookups++

    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(keyStr)

      request.onsuccess = () => {
        const entry = request.result as StoredEntry<T> | undefined

        if (!entry) {
          this.misses++
          this.updateLookupTime(startTime)
          this.emitEvent({ type: 'miss', key: keyStr, timestamp: Date.now() })
          resolve({
            hit: false,
            missReason: 'not_found',
            lookupTimeMs: Date.now() - startTime,
          })
          return
        }

        // Check expiration
        if (entry.metadata.expiresAt > 0 && Date.now() > entry.metadata.expiresAt) {
          this.delete(keyStr) // Async delete, don't wait
          this.misses++
          this.updateLookupTime(startTime)
          this.emitEvent({ type: 'expire', key: keyStr, timestamp: Date.now() })
          resolve({
            hit: false,
            missReason: 'expired',
            lookupTimeMs: Date.now() - startTime,
          })
          return
        }

        this.hits++
        this.updateLookupTime(startTime)
        this.emitEvent({ type: 'hit', key: keyStr, timestamp: Date.now() })

        resolve({
          hit: true,
          entry: {
            key: typeof key === 'string'
              ? { key, components: {} as CacheKey['components'], generatedAt: 0 }
              : key,
            value: entry.value,
            metadata: entry.metadata,
          },
          lookupTimeMs: Date.now() - startTime,
        })
      }

      request.onerror = () => {
        this.misses++
        this.updateLookupTime(startTime)
        resolve({
          hit: false,
          missReason: 'invalid',
          lookupTimeMs: Date.now() - startTime,
        })
      }
    })
  }

  /**
   * Set an entry in the cache
   */
  async set(key: CacheKey | string, value: T, ttlMs?: number): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key
    const effectiveTtl = ttlMs ?? this.config.defaultTtlMs

    if (!this.db) {
      await this.initialize()
    }

    const metadata: CacheEntryMetadata = {
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      sizeBytes: this.estimateSize(value),
      ttlMs: effectiveTtl,
      expiresAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : 0,
      source: 'generation',
    }

    const entry: StoredEntry<T> = {
      key: keyStr,
      value,
      metadata,
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => {
        this.emitEvent({ type: 'set', key: keyStr, timestamp: Date.now() })
        resolve(true)
      }

      request.onerror = () => {
        resolve(false)
      }
    })
  }

  /**
   * Delete an entry from the cache
   */
  async delete(key: CacheKey | string): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key

    if (!this.db) return false

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(keyStr)

      request.onsuccess = () => {
        this.emitEvent({ type: 'delete', key: keyStr, timestamp: Date.now() })
        resolve(true)
      }

      request.onerror = () => {
        resolve(false)
      }
    })
  }

  /**
   * Check if an entry exists
   */
  async has(key: CacheKey | string): Promise<boolean> {
    const result = await this.get(key)
    return result.hit
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        this.emitEvent({ type: 'clear', timestamp: Date.now() })
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * Get cache statistics
   */
  getStats(): ProofCacheStats {
    return {
      ...INITIAL_PROOF_CACHE_STATS,
      totalLookups: this.totalLookups,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalLookups > 0 ? this.hits / this.totalLookups : 0,
      maxSizeBytes: this.config.maxSizeBytes,
      avgLookupTimeMs: this.totalLookups > 0 ? this.totalLookupTimeMs / this.totalLookups : 0,
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    if (!this.db) {
      await this.initialize()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        let keys = request.result as string[]

        if (pattern) {
          const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
          const regex = new RegExp(`^${regexPattern}$`)
          keys = keys.filter((key) => regex.test(key))
        }

        resolve(keys)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  addEventListener(listener: CacheEventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: CacheEventListener): void {
    this.listeners.delete(listener)
  }

  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value, (_, v) => {
        if (typeof v === 'bigint') return v.toString()
        return v
      })
      return new TextEncoder().encode(json).length
    } catch {
      return 1024
    }
  }

  private updateLookupTime(startTime: number): void {
    this.totalLookupTimeMs += Date.now() - startTime
  }

  private emitEvent(event: CacheEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ─── File-based Cache (Node.js) ──────────────────────────────────────────────

interface StoredEntry<T> {
  key: string
  value: T
  metadata: CacheEntryMetadata
}

/**
 * File-based persistent cache for Node.js
 */
export class FileCache<T = SingleProof> implements IPersistentCache<T> {
  private readonly config: PersistentCacheConfig
  private readonly listeners: Set<CacheEventListener> = new Set()
  private initialized = false
  private fs: typeof import('fs/promises') | null = null
  private path: typeof import('path') | null = null
  private cachePath = ''

  // Statistics
  private totalLookups = 0
  private hits = 0
  private misses = 0
  private totalLookupTimeMs = 0

  constructor(config: Partial<PersistentCacheConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENT_CONFIG, ...config }
  }

  /**
   * Initialize the file-based storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (!isNode()) {
      throw new Error('File-based cache is only available in Node.js environments')
    }

    // Dynamic imports for Node.js modules
    this.fs = await import('fs/promises')
    this.path = await import('path')

    // Determine cache path
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp'
    this.cachePath = this.path.join(homeDir, '.cache', this.config.storageName)

    // Ensure cache directory exists
    await this.fs.mkdir(this.cachePath, { recursive: true })

    this.initialized = true
  }

  /**
   * Close the file cache (no-op for files)
   */
  async close(): Promise<void> {
    this.initialized = false
  }

  /**
   * Check if file system is available
   */
  isAvailable(): boolean {
    return isNode()
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; available: number; quota: number }> {
    if (!this.fs || !this.initialized) {
      return { used: 0, available: this.config.maxSizeBytes, quota: this.config.maxSizeBytes }
    }

    try {
      let totalSize = 0
      const files = await this.fs.readdir(this.cachePath)

      for (const file of files) {
        if (file.endsWith('.json')) {
          const stat = await this.fs.stat(this.path!.join(this.cachePath, file))
          totalSize += stat.size
        }
      }

      return {
        used: totalSize,
        available: this.config.maxSizeBytes - totalSize,
        quota: this.config.maxSizeBytes,
      }
    } catch {
      return { used: 0, available: this.config.maxSizeBytes, quota: this.config.maxSizeBytes }
    }
  }

  /**
   * Compact the storage (remove expired entries)
   */
  async compact(): Promise<void> {
    if (!this.fs || !this.initialized) return

    const now = Date.now()
    const files = await this.fs.readdir(this.cachePath)

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const filePath = this.path!.join(this.cachePath, file)
        const content = await this.fs.readFile(filePath, 'utf-8')
        const entry = JSON.parse(content) as StoredEntry<T>

        if (entry.metadata.expiresAt > 0 && now > entry.metadata.expiresAt) {
          await this.fs.unlink(filePath)
        }
      } catch {
        // Ignore errors, file might be corrupted
      }
    }
  }

  /**
   * Get an entry from the cache
   */
  async get(key: CacheKey | string): Promise<CacheLookupResult<T>> {
    const startTime = Date.now()
    const keyStr = typeof key === 'string' ? key : key.key

    this.totalLookups++

    if (!this.initialized) {
      await this.initialize()
    }

    const filePath = this.getFilePath(keyStr)

    try {
      const content = await this.fs!.readFile(filePath, 'utf-8')
      const entry = JSON.parse(content) as StoredEntry<T>

      // Check expiration
      if (entry.metadata.expiresAt > 0 && Date.now() > entry.metadata.expiresAt) {
        await this.fs!.unlink(filePath).catch(() => {})
        this.misses++
        this.updateLookupTime(startTime)
        this.emitEvent({ type: 'expire', key: keyStr, timestamp: Date.now() })
        return {
          hit: false,
          missReason: 'expired',
          lookupTimeMs: Date.now() - startTime,
        }
      }

      this.hits++
      this.updateLookupTime(startTime)
      this.emitEvent({ type: 'hit', key: keyStr, timestamp: Date.now() })

      return {
        hit: true,
        entry: {
          key: typeof key === 'string'
            ? { key, components: {} as CacheKey['components'], generatedAt: 0 }
            : key,
          value: entry.value,
          metadata: entry.metadata,
        },
        lookupTimeMs: Date.now() - startTime,
      }
    } catch {
      this.misses++
      this.updateLookupTime(startTime)
      this.emitEvent({ type: 'miss', key: keyStr, timestamp: Date.now() })
      return {
        hit: false,
        missReason: 'not_found',
        lookupTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Set an entry in the cache
   */
  async set(key: CacheKey | string, value: T, ttlMs?: number): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key
    const effectiveTtl = ttlMs ?? this.config.defaultTtlMs

    if (!this.initialized) {
      await this.initialize()
    }

    const metadata: CacheEntryMetadata = {
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      sizeBytes: 0, // Will be calculated after serialization
      ttlMs: effectiveTtl,
      expiresAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : 0,
      source: 'generation',
    }

    const entry: StoredEntry<T> = {
      key: keyStr,
      value,
      metadata,
    }

    try {
      const content = JSON.stringify(entry, (_, v) => {
        if (typeof v === 'bigint') return `bigint:${v.toString()}`
        return v
      })

      const filePath = this.getFilePath(keyStr)
      await this.fs!.writeFile(filePath, content, 'utf-8')

      this.emitEvent({ type: 'set', key: keyStr, timestamp: Date.now() })
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete an entry from the cache
   */
  async delete(key: CacheKey | string): Promise<boolean> {
    const keyStr = typeof key === 'string' ? key : key.key

    if (!this.initialized) return false

    try {
      const filePath = this.getFilePath(keyStr)
      await this.fs!.unlink(filePath)
      this.emitEvent({ type: 'delete', key: keyStr, timestamp: Date.now() })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if an entry exists
   */
  async has(key: CacheKey | string): Promise<boolean> {
    const result = await this.get(key)
    return result.hit
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    if (!this.fs || !this.initialized) return

    const files = await this.fs.readdir(this.cachePath)

    for (const file of files) {
      if (file.endsWith('.json')) {
        await this.fs.unlink(this.path!.join(this.cachePath, file)).catch(() => {})
      }
    }

    this.emitEvent({ type: 'clear', timestamp: Date.now() })
  }

  /**
   * Get cache statistics
   */
  getStats(): ProofCacheStats {
    return {
      ...INITIAL_PROOF_CACHE_STATS,
      totalLookups: this.totalLookups,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalLookups > 0 ? this.hits / this.totalLookups : 0,
      maxSizeBytes: this.config.maxSizeBytes,
      avgLookupTimeMs: this.totalLookups > 0 ? this.totalLookupTimeMs / this.totalLookups : 0,
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const files = await this.fs!.readdir(this.cachePath)
    let keys = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => this.fileNameToKey(f))

    if (pattern) {
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      const regex = new RegExp(`^${regexPattern}$`)
      keys = keys.filter((key) => regex.test(key))
    }

    return keys
  }

  addEventListener(listener: CacheEventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: CacheEventListener): void {
    this.listeners.delete(listener)
  }

  private getFilePath(key: string): string {
    // Sanitize key for file system
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
    return this.path!.join(this.cachePath, `${safeKey}.json`)
  }

  private fileNameToKey(fileName: string): string {
    // This is a simplified reverse - in practice, you'd need a mapping
    return fileName.replace('.json', '')
  }

  private updateLookupTime(startTime: number): void {
    this.totalLookupTimeMs += Date.now() - startTime
  }

  private emitEvent(event: CacheEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Create the appropriate persistent cache for the current environment
 */
export function createPersistentCache<T = SingleProof>(
  config?: Partial<PersistentCacheConfig>
): IPersistentCache<T> {
  if (isBrowser()) {
    return new IndexedDBCache<T>(config)
  }
  if (isNode()) {
    return new FileCache<T>(config)
  }
  throw new Error('No persistent storage available in this environment')
}

/**
 * Create an IndexedDB cache (browser only)
 */
export function createIndexedDBCache<T = SingleProof>(
  config?: Partial<PersistentCacheConfig>
): IPersistentCache<T> {
  return new IndexedDBCache<T>(config)
}

/**
 * Create a file-based cache (Node.js only)
 */
export function createFileCache<T = SingleProof>(
  config?: Partial<PersistentCacheConfig>
): IPersistentCache<T> {
  return new FileCache<T>(config)
}
