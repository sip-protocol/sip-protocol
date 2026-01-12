/**
 * Noir on Solana Demo
 *
 * Demonstrates SIP Protocol's Noir ZK proofs on Solana.
 *
 * Usage:
 *   npx tsx src/index.ts
 */

import { NoirProofProvider } from '@sip-protocol/sdk'
import { SolanaNoirVerifier, createDevnetVerifier } from '@sip-protocol/sdk/solana'
import { ComplianceProofProvider } from '@sip-protocol/sdk/proofs'

// ─── Configuration ───────────────────────────────────────────────────────────

const DEMO_CONFIG = {
  verbose: true,
  network: 'devnet' as const,
}

// ─── Demo Functions ──────────────────────────────────────────────────────────

/**
 * Demo 1: Generate a Funding Proof
 *
 * Proves: "I have at least X tokens" without revealing actual balance
 */
async function demoFundingProof(): Promise<void> {
  console.log('\n' + '═'.repeat(60))
  console.log('Demo 1: Funding Proof (Prove Balance >= Minimum)')
  console.log('═'.repeat(60))

  const provider = new NoirProofProvider({ verbose: DEMO_CONFIG.verbose })

  console.log('Initializing Noir provider...')
  await provider.initialize()

  console.log('Generating funding proof...')
  const startTime = Date.now()

  const { proof, publicInputs } = await provider.generateFundingProof({
    balance: BigInt('1000000000'), // 1 SOL in lamports
    minimumRequired: BigInt('500000000'), // 0.5 SOL minimum
    blindingFactor: new Uint8Array(32).fill(0x42),
    assetId: 'SOL',
    userAddress: '0x' + '1'.repeat(64),
    ownershipSignature: new Uint8Array(64).fill(0xab),
  })

  const duration = Date.now() - startTime

  console.log('\nResults:')
  console.log(`  Proof type: ${proof.type}`)
  console.log(`  Proof size: ${proof.proof.length / 2} bytes`)
  console.log(`  Public inputs: ${publicInputs.length}`)
  console.log(`  Generation time: ${duration}ms`)

  // Verify the proof
  console.log('\nVerifying proof...')
  const isValid = await provider.verifyProof(proof)
  console.log(`  Proof valid: ${isValid ? 'YES' : 'NO'}`)

  await provider.destroy()
}

/**
 * Demo 2: Verify on Solana
 *
 * Shows off-chain and simulated on-chain verification
 */
async function demoSolanaVerification(): Promise<void> {
  console.log('\n' + '═'.repeat(60))
  console.log('Demo 2: Solana Verification')
  console.log('═'.repeat(60))

  // Generate a proof first
  const proofProvider = new NoirProofProvider()
  await proofProvider.initialize()

  const { proof } = await proofProvider.generateFundingProof({
    balance: BigInt('2000000000'),
    minimumRequired: BigInt('1000000000'),
    blindingFactor: new Uint8Array(32).fill(0x11),
    assetId: 'SOL',
    userAddress: '0x' + '2'.repeat(64),
    ownershipSignature: new Uint8Array(64).fill(0xcd),
  })

  await proofProvider.destroy()

  // Verify on Solana
  console.log('Creating Solana verifier (devnet)...')
  const verifier = createDevnetVerifier({ verbose: DEMO_CONFIG.verbose })
  await verifier.initialize()

  console.log('\nOff-chain verification...')
  const offChainStart = Date.now()
  const isValid = await verifier.verifyOffChain(proof)
  const offChainDuration = Date.now() - offChainStart

  console.log(`  Result: ${isValid ? 'VALID' : 'INVALID'}`)
  console.log(`  Time: ${offChainDuration}ms`)

  // Get proof statistics
  console.log('\nProof statistics:')
  const stats = verifier.getProofStatistics(proof)
  console.log(`  Circuit type: ${stats.circuitType}`)
  console.log(`  Proof size: ${stats.proofSize} bytes`)
  console.log(`  Public inputs: ${stats.publicInputsSize} bytes`)
  console.log(`  Estimated compute units: ${stats.estimatedComputeUnits}`)

  await verifier.destroy()
}

/**
 * Demo 3: Compliance Proofs
 *
 * Shows non-financial ZK use cases
 */
async function demoComplianceProofs(): Promise<void> {
  console.log('\n' + '═'.repeat(60))
  console.log('Demo 3: Compliance Proofs (Non-Financial ZK)')
  console.log('═'.repeat(60))

  const provider = new ComplianceProofProvider({ verbose: DEMO_CONFIG.verbose })
  await provider.initialize()

  // Demo: Viewing Key Access Proof
  console.log('\n--- Viewing Key Access Proof ---')
  console.log('Proving: "I can decrypt this transaction" without revealing contents')

  const viewingKeyResult = await provider.generateViewingKeyAccessProof({
    viewingKey: {
      viewingKeyPublic: '0x' + 'ab'.repeat(32),
      viewingKeyPrivate: '0x' + 'cd'.repeat(32),
    } as never,
    transactionHash: '0x' + '12'.repeat(32),
    encryptedData: new Uint8Array(64).fill(0xaa),
    auditorPublicKey: '0x' + '34'.repeat(32),
    timestamp: Math.floor(Date.now() / 1000),
  })

  console.log(`  Proof generated: ${viewingKeyResult.complianceType}`)
  console.log(`  Valid until: ${new Date(viewingKeyResult.validUntil * 1000).toISOString()}`)
  console.log(`  Auditor hash: ${viewingKeyResult.auditorHash?.slice(0, 16)}...`)

  // Demo: Sanctions Clearance Proof
  console.log('\n--- Sanctions Clearance Proof ---')
  console.log('Proving: "Neither party is sanctioned" without revealing addresses')

  const sanctionsResult = await provider.generateSanctionsClearProof({
    senderAddress: '0x' + '56'.repeat(20),
    recipientAddress: '0x' + '78'.repeat(20),
    senderBlinding: new Uint8Array(32).fill(0x11),
    recipientBlinding: new Uint8Array(32).fill(0x22),
    sanctionsListRoot: '0x' + '9a'.repeat(32),
    checkTimestamp: Math.floor(Date.now() / 1000),
    jurisdiction: 'US',
  })

  console.log(`  Proof generated: ${sanctionsResult.complianceType}`)
  console.log(`  Jurisdiction: ${sanctionsResult.jurisdiction}`)

  // Demo: Balance Attestation Proof
  console.log('\n--- Balance Attestation Proof ---')
  console.log('Proving: "I have at least $100K" without revealing exact balance')

  const balanceResult = await provider.generateBalanceAttestationProof({
    balance: BigInt('250000000000'), // $250K
    blindingFactor: new Uint8Array(32).fill(0x33),
    minimumRequired: BigInt('100000000000'), // $100K
    assetId: 'USDC',
    accountCommitment: '0x' + 'de'.repeat(32),
    attestationTime: Math.floor(Date.now() / 1000),
  })

  console.log(`  Proof generated: ${balanceResult.complianceType}`)
  console.log(`  Proof type: ${balanceResult.proof.type}`)

  // Verify all proofs
  console.log('\n--- Verifying Compliance Proofs ---')
  const viewingKeyValid = await provider.verifyComplianceProof(viewingKeyResult)
  const sanctionsValid = await provider.verifyComplianceProof(sanctionsResult)
  const balanceValid = await provider.verifyComplianceProof(balanceResult)

  console.log(`  Viewing key proof: ${viewingKeyValid ? 'VALID' : 'INVALID'}`)
  console.log(`  Sanctions proof: ${sanctionsValid ? 'VALID' : 'INVALID'}`)
  console.log(`  Balance proof: ${balanceValid ? 'VALID' : 'INVALID'}`)

  await provider.destroy()
}

/**
 * Demo 4: Multi-Circuit Showcase
 *
 * Shows all three privacy circuits
 */
async function demoMultiCircuit(): Promise<void> {
  console.log('\n' + '═'.repeat(60))
  console.log('Demo 4: Multi-Circuit Privacy Stack')
  console.log('═'.repeat(60))

  const provider = new NoirProofProvider({ verbose: false })
  await provider.initialize()

  const circuits = [
    {
      name: 'Funding Proof',
      description: 'Prove balance >= minimum',
      constraints: '~2,000',
      generate: () =>
        provider.generateFundingProof({
          balance: BigInt('1000'),
          minimumRequired: BigInt('500'),
          blindingFactor: new Uint8Array(32).fill(0x01),
          assetId: 'TEST',
          userAddress: '0x' + '1'.repeat(64),
          ownershipSignature: new Uint8Array(64).fill(0x02),
        }),
    },
    {
      name: 'Validity Proof',
      description: 'Prove intent authorization',
      constraints: '~72,000',
      generate: () =>
        provider.generateValidityProof({
          intentHash: '0x' + '3'.repeat(64),
          senderAddress: '0x' + '4'.repeat(64),
          senderBlinding: new Uint8Array(32).fill(0x05),
          senderSecret: new Uint8Array(32).fill(0x06),
          authorizationSignature: new Uint8Array(64).fill(0x07),
          nonce: new Uint8Array(32).fill(0x08),
          timestamp: Math.floor(Date.now() / 1000),
          expiry: Math.floor(Date.now() / 1000) + 3600,
        }),
    },
    {
      name: 'Fulfillment Proof',
      description: 'Prove correct execution',
      constraints: '~22,000',
      generate: () =>
        provider.generateFulfillmentProof({
          intentHash: '0x' + '9'.repeat(64),
          outputAmount: BigInt('1000'),
          outputBlinding: new Uint8Array(32).fill(0x0a),
          minOutputAmount: BigInt('900'),
          recipientStealth: '0x' + 'b'.repeat(64),
          solverId: 'solver-1',
          solverSecret: new Uint8Array(32).fill(0x0c),
          oracleAttestation: {
            recipient: '0x' + 'd'.repeat(64),
            amount: BigInt('1000'),
            txHash: '0x' + 'e'.repeat(64),
            blockNumber: BigInt(12345),
            signature: new Uint8Array(64).fill(0x0f),
          },
          fulfillmentTime: Math.floor(Date.now() / 1000),
          expiry: Math.floor(Date.now() / 1000) + 3600,
        }),
    },
  ]

  console.log('\nGenerating all circuit proofs...\n')

  for (const circuit of circuits) {
    console.log(`${circuit.name} (${circuit.constraints} constraints)`)
    console.log(`  ${circuit.description}`)

    const startTime = Date.now()
    try {
      const { proof } = await circuit.generate()
      const duration = Date.now() - startTime

      console.log(`  Proof size: ${proof.proof.length / 2} bytes`)
      console.log(`  Generation: ${duration}ms`)

      const isValid = await provider.verifyProof(proof)
      console.log(`  Valid: ${isValid ? 'YES' : 'NO'}`)
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`)
    }
    console.log()
  }

  await provider.destroy()
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        SIP Protocol: Noir on Solana Demo                  ║')
  console.log('║        Production ZK Proofs for Privacy                   ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  console.log('\nThis demo showcases:')
  console.log('  1. Funding Proof - Prove balance without revealing amount')
  console.log('  2. Solana Verification - Verify proofs on Solana')
  console.log('  3. Compliance Proofs - Non-financial ZK use cases')
  console.log('  4. Multi-Circuit - All three privacy circuits')

  try {
    await demoFundingProof()
    await demoSolanaVerification()
    await demoComplianceProofs()
    await demoMultiCircuit()

    console.log('\n' + '═'.repeat(60))
    console.log('Demo Complete!')
    console.log('═'.repeat(60))
    console.log('\nKey Takeaways:')
    console.log('  - Noir enables production ZK proofs in TypeScript')
    console.log('  - Browser WASM support for client-side proving')
    console.log('  - Solana verification for on-chain privacy')
    console.log('  - Compliance proofs enable privacy + regulatory compliance')
    console.log('\nResources:')
    console.log('  - SIP Protocol: https://sip-protocol.org')
    console.log('  - Documentation: https://docs.sip-protocol.org')
    console.log('  - GitHub: https://github.com/sip-protocol/sip-protocol')
  } catch (error) {
    console.error('\nDemo failed:', error)
    process.exit(1)
  }
}

main()
