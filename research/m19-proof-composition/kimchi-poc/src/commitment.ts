/**
 * SIP Kimchi POC - Commitment Circuit
 *
 * Demonstrates how to verify Pedersen-style commitments in Kimchi/o1js.
 * This is directly relevant to SIP's privacy layer.
 *
 * Uses Poseidon hash (native to Kimchi) instead of Pedersen
 * for better performance.
 */

import { Field, ZkProgram, Poseidon, Struct, Provable } from 'o1js'

// Commitment structure
class Commitment extends Struct({
  value: Field,
}) {}

// SIP-style commitment circuit
const CommitmentCircuit = ZkProgram({
  name: 'sip-commitment',
  publicInput: Commitment, // The commitment (public)

  methods: {
    // Prove knowledge of amount and blinding that produce the commitment
    verifyCommitment: {
      privateInputs: [Field, Field], // amount and blinding (private)

      async method(commitment: Commitment, amount: Field, blinding: Field) {
        // Compute Poseidon hash of (amount, blinding)
        // This simulates a Pedersen-style commitment: C = H(amount || blinding)
        const computed = Poseidon.hash([amount, blinding])

        // Assert the computed commitment matches the public commitment
        computed.assertEquals(commitment.value)
      },
    },

    // Prove that amount is at least some minimum (range-like check)
    // Note: o1js doesn't have native range checks, so we use comparison
    proveMinimum: {
      privateInputs: [Field, Field, Field], // amount, blinding, minimum

      async method(commitment: Commitment, amount: Field, blinding: Field, minimum: Field) {
        // Verify commitment
        const computed = Poseidon.hash([amount, blinding])
        computed.assertEquals(commitment.value)

        // Check amount >= minimum
        // In o1js, we use assertGreaterThanOrEqual
        amount.assertGreaterThanOrEqual(minimum)
      },
    },
  },
})

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     SIP KIMCHI POC - Commitment Circuit (SIP-Relevant)     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()

  // Private inputs
  const amount = Field(1000)
  const blinding = Field(42)

  // Compute commitment (this would be public on-chain)
  const commitmentValue = Poseidon.hash([amount, blinding])
  const commitment = new Commitment({ value: commitmentValue })

  console.log('┌─────────────────────────────────────────┐')
  console.log('│         SIP COMMITMENT CIRCUIT          │')
  console.log('└─────────────────────────────────────────┘')
  console.log()
  console.log('Private inputs:')
  console.log(`  • Amount: ${amount.toString()}`)
  console.log(`  • Blinding: ${blinding.toString()}`)
  console.log()
  console.log('Public commitment:')
  console.log(`  • Hash: ${commitmentValue.toString().slice(0, 30)}...`)
  console.log('  (computed as: Poseidon(amount, blinding))')
  console.log()

  // Compile
  console.log('─── COMPILATION ───')
  const startCompile = Date.now()
  const { verificationKey } = await CommitmentCircuit.compile()
  const compileTime = Date.now() - startCompile
  console.log(`  Compiled in ${compileTime}ms`)
  console.log()

  // Test 1: Basic commitment verification
  console.log('─── TEST 1: Verify Commitment ───')
  const startProve1 = Date.now()
  const proof1 = await CommitmentCircuit.verifyCommitment(commitment, amount, blinding)
  const proveTime1 = Date.now() - startProve1
  console.log(`  Proof generated in ${proveTime1}ms`)

  const startVerify1 = Date.now()
  const isValid1 = await CommitmentCircuit.verify(proof1)
  const verifyTime1 = Date.now() - startVerify1
  console.log(`  Verification: ${isValid1 ? '✓ Valid' : '✗ Invalid'} (${verifyTime1}ms)`)
  console.log()

  // Test 2: Prove minimum amount
  console.log('─── TEST 2: Prove Minimum Amount ───')
  const minimum = Field(500)
  console.log(`  Proving amount >= ${minimum.toString()}`)

  const startProve2 = Date.now()
  const proof2 = await CommitmentCircuit.proveMinimum(commitment, amount, blinding, minimum)
  const proveTime2 = Date.now() - startProve2
  console.log(`  Proof generated in ${proveTime2}ms`)

  const startVerify2 = Date.now()
  const isValid2 = await CommitmentCircuit.verify(proof2)
  const verifyTime2 = Date.now() - startVerify2
  console.log(`  Verification: ${isValid2 ? '✓ Valid' : '✗ Invalid'} (${verifyTime2}ms)`)
  console.log()

  // Summary
  console.log('─── SUMMARY ───')
  console.log(`  ✓ Compilation: ${compileTime}ms`)
  console.log(`  ✓ Commitment proof: ${proveTime1}ms (verify: ${verifyTime1}ms)`)
  console.log(`  ✓ Minimum proof: ${proveTime2}ms (verify: ${verifyTime2}ms)`)
  console.log()

  // SIP Relevance
  console.log('─── SIP RELEVANCE ───')
  console.log()
  console.log("This demonstrates SIP's core privacy mechanism in Kimchi:")
  console.log()
  console.log('  1. PRIVATE INPUTS (known only to prover):')
  console.log(`     • Amount: ${amount.toString()} (hidden from observers)`)
  console.log(`     • Blinding: ${blinding.toString()} (ensures uniqueness)`)
  console.log()
  console.log('  2. PUBLIC OUTPUT (visible on-chain):')
  console.log(`     • Commitment: ${commitmentValue.toString().slice(0, 20)}...`)
  console.log('     (reveals nothing about amount)')
  console.log()
  console.log('  3. VERIFICATION:')
  console.log('     • Anyone can verify the proof is valid')
  console.log('     • No one learns the private inputs')
  console.log()
  console.log('  4. KIMCHI ADVANTAGES:')
  console.log('     • Same Pasta curves as Halo2')
  console.log('     • No trusted setup')
  console.log('     • Native Poseidon hash')
  console.log('     • Recursion via Pickles')
  console.log()
}

main().catch(console.error)
