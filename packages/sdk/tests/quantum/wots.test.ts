/**
 * Winternitz One-Time Signature (WOTS) Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateWinternitzKeypair,
  generateWinternitzKeypairFromSeed,
  wotsSign,
  wotsSignHash,
  wotsVerify,
  wotsVerifyWithRoot,
  computeMerkleRoot,
  WotsKeyManager,
  serializeKeypair,
  deserializeKeypair,
  serializeSignature,
  deserializeSignature,
  WOTS_CHAINS,
  KEY_SIZE,
  CHAIN_SIZE,
  MERKLE_ROOT_SIZE,
} from '../../src/quantum/wots'

describe('WOTS Key Generation', () => {
  it('generates valid keypair', () => {
    const keypair = generateWinternitzKeypair()

    expect(keypair.privateKey.length).toBe(KEY_SIZE)
    expect(keypair.publicKey.length).toBe(KEY_SIZE)
    expect(keypair.merkleRoot.length).toBe(MERKLE_ROOT_SIZE)
    expect(keypair.id.length).toBe(16)
  })

  it('generates unique keypairs', () => {
    const keypair1 = generateWinternitzKeypair()
    const keypair2 = generateWinternitzKeypair()

    expect(keypair1.merkleRoot).not.toEqual(keypair2.merkleRoot)
    expect(keypair1.id).not.toBe(keypair2.id)
  })

  it('generates keypair from seed deterministically', () => {
    const seed = new Uint8Array(32).fill(0x42)

    const keypair1 = generateWinternitzKeypairFromSeed(seed)
    const keypair2 = generateWinternitzKeypairFromSeed(seed)

    expect(keypair1.privateKey).toEqual(keypair2.privateKey)
    expect(keypair1.publicKey).toEqual(keypair2.publicKey)
    expect(keypair1.merkleRoot).toEqual(keypair2.merkleRoot)
  })

  it('throws for invalid seed size', () => {
    const invalidSeed = new Uint8Array(16)

    expect(() => generateWinternitzKeypairFromSeed(invalidSeed)).toThrow('Seed must be 32 bytes')
  })
})

describe('WOTS Signing', () => {
  it('signs a message', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Hello, Quantum World!')

    const signature = wotsSign(keypair.privateKey, message)

    expect(signature.chains.length).toBe(KEY_SIZE)
    expect(signature.messageHash.length).toBe(32)
  })

  it('signs a hash directly', () => {
    const keypair = generateWinternitzKeypair()
    const messageHash = new Uint8Array(32).fill(0xaa)

    const signature = wotsSignHash(keypair.privateKey, messageHash)

    expect(signature.chains.length).toBe(KEY_SIZE)
    expect(signature.messageHash).toEqual(messageHash)
  })

  it('throws for invalid private key size', () => {
    const invalidKey = new Uint8Array(100)
    const message = new Uint8Array(32)

    expect(() => wotsSign(invalidKey, message)).toThrow(`Private key must be ${KEY_SIZE} bytes`)
  })

  it('throws for invalid message hash size', () => {
    const keypair = generateWinternitzKeypair()
    const invalidHash = new Uint8Array(16)

    expect(() => wotsSignHash(keypair.privateKey, invalidHash)).toThrow('Message hash must be 32 bytes')
  })
})

describe('WOTS Verification', () => {
  it('verifies valid signature', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test message')

    const signature = wotsSign(keypair.privateKey, message)
    const valid = wotsVerify(keypair.publicKey, message, signature)

    expect(valid).toBe(true)
  })

  it('rejects invalid signature', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test message')
    const differentMessage = new TextEncoder().encode('Different message')

    const signature = wotsSign(keypair.privateKey, message)
    const valid = wotsVerify(keypair.publicKey, differentMessage, signature)

    expect(valid).toBe(false)
  })

  it('rejects tampered signature', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test message')

    const signature = wotsSign(keypair.privateKey, message)

    // Tamper with signature
    signature.chains[0] ^= 0xff

    const valid = wotsVerify(keypair.publicKey, message, signature)

    expect(valid).toBe(false)
  })

  it('verifies with merkle root', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test message')

    const signature = wotsSign(keypair.privateKey, message)
    const valid = wotsVerifyWithRoot(keypair.merkleRoot, message, signature, keypair.publicKey)

    expect(valid).toBe(true)
  })

  it('rejects wrong merkle root', () => {
    const keypair = generateWinternitzKeypair()
    const otherKeypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test message')

    const signature = wotsSign(keypair.privateKey, message)

    // Use wrong merkle root
    const valid = wotsVerifyWithRoot(otherKeypair.merkleRoot, message, signature, keypair.publicKey)

    expect(valid).toBe(false)
  })
})

describe('Merkle Root', () => {
  it('computes consistent merkle root', () => {
    const keypair = generateWinternitzKeypair()

    const root1 = computeMerkleRoot(keypair.publicKey)
    const root2 = computeMerkleRoot(keypair.publicKey)

    expect(root1).toEqual(root2)
    expect(root1).toEqual(keypair.merkleRoot)
  })

  it('throws for invalid public key size', () => {
    const invalidKey = new Uint8Array(100)

    expect(() => computeMerkleRoot(invalidKey)).toThrow(`Public key must be ${KEY_SIZE} bytes`)
  })
})

describe('WotsKeyManager', () => {
  let manager: WotsKeyManager

  beforeEach(() => {
    manager = new WotsKeyManager()
  })

  it('registers new keypair', async () => {
    const keypair = generateWinternitzKeypair()

    await manager.register(keypair)

    expect(manager.canUse(keypair.merkleRoot)).toBe(true)
  })

  it('throws when registering duplicate', async () => {
    const keypair = generateWinternitzKeypair()

    await manager.register(keypair)

    await expect(manager.register(keypair)).rejects.toThrow('already registered')
  })

  it('marks key as used', async () => {
    const keypair = generateWinternitzKeypair()

    await manager.register(keypair)
    await manager.markUsed(keypair.merkleRoot, 'test-operation')

    expect(manager.canUse(keypair.merkleRoot)).toBe(false)
  })

  it('throws when reusing key', async () => {
    const keypair = generateWinternitzKeypair()

    await manager.register(keypair)
    await manager.markUsed(keypair.merkleRoot, 'first-use')

    await expect(
      manager.markUsed(keypair.merkleRoot, 'second-use')
    ).rejects.toThrow('CRITICAL')
  })

  it('gets key state', async () => {
    const keypair = generateWinternitzKeypair()

    await manager.register(keypair)

    const state = manager.getState(keypair.merkleRoot)

    expect(state).toBeDefined()
    expect(state?.used).toBe(false)
    expect(state?.createdAt).toBeDefined()
  })

  it('lists all keys', async () => {
    const keypair1 = generateWinternitzKeypair()
    const keypair2 = generateWinternitzKeypair()

    await manager.register(keypair1)
    await manager.register(keypair2)

    const keys = manager.listKeys()

    expect(keys.length).toBe(2)
  })

  it('returns false for unregistered key', () => {
    const keypair = generateWinternitzKeypair()

    expect(manager.canUse(keypair.merkleRoot)).toBe(false)
  })

  it('calls persist function', async () => {
    const persistFn = vi.fn()
    const managerWithPersist = new WotsKeyManager({ persistFn })

    const keypair = generateWinternitzKeypair()
    await managerWithPersist.register(keypair)

    expect(persistFn).toHaveBeenCalled()
  })
})

describe('Serialization', () => {
  it('serializes and deserializes keypair', () => {
    const keypair = generateWinternitzKeypair()

    const serialized = serializeKeypair(keypair)
    const deserialized = deserializeKeypair(serialized)

    expect(deserialized.privateKey).toEqual(keypair.privateKey)
    expect(deserialized.publicKey).toEqual(keypair.publicKey)
    expect(deserialized.merkleRoot).toEqual(keypair.merkleRoot)
    expect(deserialized.id).toBe(keypair.id)
  })

  it('serializes and deserializes signature', () => {
    const keypair = generateWinternitzKeypair()
    const message = new TextEncoder().encode('Test')

    const signature = wotsSign(keypair.privateKey, message)

    const serialized = serializeSignature(signature)
    const deserialized = deserializeSignature(serialized)

    expect(deserialized.chains).toEqual(signature.chains)
    expect(deserialized.messageHash).toEqual(signature.messageHash)
  })
})

describe('Constants', () => {
  it('has expected values', () => {
    expect(WOTS_CHAINS).toBe(256)
    expect(CHAIN_SIZE).toBe(32)
    expect(KEY_SIZE).toBe(256 * 32) // 8KB
    expect(MERKLE_ROOT_SIZE).toBe(32)
  })
})
