/**
 * Secure Memory Utilities
 *
 * Provides best-effort secure memory handling for cryptographic secrets
 * in JavaScript environments.
 *
 * ## What This Provides
 * - **Explicit Cleanup**: Deterministic overwriting of sensitive buffers
 * - **Defense in Depth**: Overwrite with random data, then zero
 * - **API for Safe Patterns**: Helper functions for scoped secret usage
 *
 * ## IMPORTANT: Limitations of JavaScript Memory Cleanup
 *
 * JavaScript does NOT provide true secure memory guarantees. These utilities
 * offer BEST-EFFORT cleanup only. Be aware of these fundamental limitations:
 *
 * 1. **Garbage Collection**: The GC may have already copied the original
 *    data to other memory locations before you call secureWipe().
 *
 * 2. **JIT Compilation**: Modern JS engines may optimize away "dead" writes
 *    or create copies in compiled code paths.
 *
 * 3. **Memory Swapping**: The OS may swap memory pages to disk before cleanup,
 *    leaving secrets in swap files or hibernation images.
 *
 * 4. **String Interning**: If secrets pass through strings, they may be
 *    interned and retained in the string pool.
 *
 * ## Recommendations for High-Security Applications
 *
 * For applications requiring strong memory protection:
 * - Use hardware security modules (HSMs) for key storage
 * - Use hardware wallets (Ledger, Trezor) for signing operations
 * - Consider native bindings with secure memory allocators
 * - Run in isolated environments with encrypted swap disabled
 *
 * This module is appropriate for:
 * - Reducing attack surface (makes casual inspection harder)
 * - Defense in depth (multiple security layers)
 * - Compliance with best practices (demonstrable cleanup efforts)
 *
 * @see docs/security/KNOWN_LIMITATIONS.md
 */

import { randomBytes } from '@noble/hashes/utils'

/**
 * Securely wipe a buffer containing sensitive data
 *
 * This performs a defense-in-depth wipe:
 * 1. Overwrite with random data (defeats simple memory scrapers)
 * 2. Zero the buffer (standard cleanup)
 *
 * Note: Due to JavaScript's garbage collection and potential JIT
 * optimizations, this cannot guarantee complete erasure. However,
 * it provides significant improvement over leaving secrets in memory.
 *
 * @param buffer - The buffer to wipe (modified in place)
 *
 * @example
 * ```typescript
 * const secretKey = randomBytes(32)
 * // ... use the key ...
 * secureWipe(secretKey) // Clean up when done
 * ```
 */
export function secureWipe(buffer: Uint8Array): void {
  if (!buffer || buffer.length === 0) {
    return
  }

  // Step 1: Overwrite with random data
  // This defeats simple memory scrapers looking for zeroed patterns
  const random = randomBytes(buffer.length)
  buffer.set(random)

  // Step 2: Zero the buffer
  // Standard cleanup - makes the data unreadable
  buffer.fill(0)
}

/**
 * Execute a function with a secret buffer and ensure cleanup
 *
 * Provides a safer pattern for using secrets - the buffer is
 * automatically wiped after the function completes (or throws).
 *
 * @param createSecret - Function to create the secret buffer
 * @param useSecret - Function that uses the secret
 * @returns The result of useSecret
 *
 * @example
 * ```typescript
 * const signature = await withSecureBuffer(
 *   () => generatePrivateKey(),
 *   async (privateKey) => {
 *     return signMessage(message, privateKey)
 *   }
 * )
 * // privateKey is automatically wiped after signing
 * ```
 */
export async function withSecureBuffer<T>(
  createSecret: () => Uint8Array,
  useSecret: (secret: Uint8Array) => T | Promise<T>,
): Promise<T> {
  const secret = createSecret()
  try {
    return await useSecret(secret)
  } finally {
    secureWipe(secret)
  }
}

/**
 * Synchronous version of withSecureBuffer
 *
 * @param createSecret - Function to create the secret buffer
 * @param useSecret - Function that uses the secret (sync)
 * @returns The result of useSecret
 */
export function withSecureBufferSync<T>(
  createSecret: () => Uint8Array,
  useSecret: (secret: Uint8Array) => T,
): T {
  const secret = createSecret()
  try {
    return useSecret(secret)
  } finally {
    secureWipe(secret)
  }
}

/**
 * Wipe multiple buffers at once
 *
 * Convenience function for cleaning up multiple secrets.
 *
 * @param buffers - Array of buffers to wipe
 */
export function secureWipeAll(...buffers: (Uint8Array | undefined | null)[]): void {
  for (const buffer of buffers) {
    if (buffer) {
      secureWipe(buffer)
    }
  }
}
