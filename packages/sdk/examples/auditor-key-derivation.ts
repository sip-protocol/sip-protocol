/**
 * Example: Auditor Key Derivation
 *
 * Demonstrates how to derive hierarchical viewing keys for different
 * auditor types using BIP-44 style derivation.
 */

import { AuditorKeyDerivation, AuditorType } from '../src/compliance/derivation'
import { randomBytes } from '@noble/hashes/utils'

async function main() {
  console.log('=== Auditor Key Derivation Example ===\n')

  // Generate master seed (32 bytes)
  // In production, this should come from a secure source (HSM, KMS, etc.)
  const masterSeed = randomBytes(32)

  // 1. Derive single auditor key
  console.log('1. Single Key Derivation')
  console.log('------------------------')

  const regulatoryKey = AuditorKeyDerivation.deriveViewingKey({
    masterSeed,
    auditorType: AuditorType.REGULATORY,
  })

  console.log(`Type: ${AuditorKeyDerivation.getAuditorTypeName(regulatoryKey.auditorType)}`)
  console.log(`Path: ${regulatoryKey.path}`)
  console.log(`Key: ${regulatoryKey.viewingKey.key.slice(0, 20)}...`)
  console.log(`Hash: ${regulatoryKey.viewingKey.hash.slice(0, 20)}...\n`)

  // 2. Derive multiple keys at once
  console.log('2. Batch Derivation')
  console.log('-------------------')

  const allKeys = AuditorKeyDerivation.deriveMultiple({
    masterSeed,
    auditorTypes: [
      AuditorType.PRIMARY,
      AuditorType.REGULATORY,
      AuditorType.INTERNAL,
      AuditorType.TAX,
    ],
  })

  allKeys.forEach((key) => {
    const name = AuditorKeyDerivation.getAuditorTypeName(key.auditorType)
    console.log(`${name.padEnd(15)} | ${key.path} | ${key.viewingKey.key.slice(0, 20)}...`)
  })

  // 3. Multi-tenant setup (different accounts)
  console.log('\n3. Multi-Tenant Setup')
  console.log('---------------------')

  for (let account = 0; account < 3; account++) {
    const key = AuditorKeyDerivation.deriveViewingKey({
      masterSeed,
      auditorType: AuditorType.PRIMARY,
      account,
    })
    console.log(`Tenant ${account} | ${key.path} | ${key.viewingKey.key.slice(0, 20)}...`)
  }

  // 4. Verify deterministic derivation
  console.log('\n4. Deterministic Derivation')
  console.log('---------------------------')

  const key1 = AuditorKeyDerivation.deriveViewingKey({
    masterSeed,
    auditorType: AuditorType.REGULATORY,
  })

  const key2 = AuditorKeyDerivation.deriveViewingKey({
    masterSeed,
    auditorType: AuditorType.REGULATORY,
  })

  const match = key1.viewingKey.key === key2.viewingKey.key
  console.log(`Same key derived twice: ${match ? '✓ MATCH' : '✗ MISMATCH'}`)

  // 5. Verify key isolation
  console.log('\n5. Key Isolation')
  console.log('----------------')

  const primary = AuditorKeyDerivation.deriveViewingKey({
    masterSeed,
    auditorType: AuditorType.PRIMARY,
  })

  const internal = AuditorKeyDerivation.deriveViewingKey({
    masterSeed,
    auditorType: AuditorType.INTERNAL,
  })

  const isolated = primary.viewingKey.key !== internal.viewingKey.key
  console.log(`PRIMARY and INTERNAL keys are different: ${isolated ? '✓ ISOLATED' : '✗ NOT ISOLATED'}`)

  console.log('\n=== Example Complete ===')
}

// Run example
main().catch(console.error)
