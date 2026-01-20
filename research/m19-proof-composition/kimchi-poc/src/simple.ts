/**
 * SIP Kimchi POC - Simple Circuit
 *
 * Demonstrates:
 * - Basic o1js circuit construction
 * - ZkProgram for proof generation
 * - Proof verification
 *
 * Equivalent to the Halo2 simple multiplication circuit.
 */

import { Field, ZkProgram, Provable } from 'o1js'

// Define a simple circuit that proves a * b = c
const SimpleCircuit = ZkProgram({
  name: 'simple-multiplication',
  publicInput: Field, // The expected product (c)

  methods: {
    multiply: {
      privateInputs: [Field, Field], // a and b (private)

      async method(expectedProduct: Field, a: Field, b: Field) {
        // Compute a * b
        const product = a.mul(b)

        // Assert that a * b equals the expected product
        product.assertEquals(expectedProduct)
      },
    },
  },
})

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     SIP KIMCHI POC - Simple Multiplication Circuit         ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()

  // Input values
  const a = Field(3)
  const b = Field(4)
  const expectedProduct = Field(12)

  console.log(`Inputs: a = ${a.toString()}, b = ${b.toString()}`)
  console.log(`Expected output: c = a × b = ${expectedProduct.toString()}`)
  console.log()

  // Compile the circuit
  console.log('─── COMPILATION ───')
  const startCompile = Date.now()
  const { verificationKey } = await SimpleCircuit.compile()
  const compileTime = Date.now() - startCompile
  console.log(`  Compiled in ${compileTime}ms`)
  console.log(`  Verification key hash: ${verificationKey.hash.toString().slice(0, 20)}...`)
  console.log()

  // Generate proof
  console.log('─── PROOF GENERATION ───')
  const startProve = Date.now()
  const proof = await SimpleCircuit.multiply(expectedProduct, a, b)
  const proveTime = Date.now() - startProve
  console.log(`  Proof generated in ${proveTime}ms`)
  console.log(`  Proof JSON size: ${JSON.stringify(proof.toJSON()).length} bytes`)
  console.log()

  // Verify proof
  console.log('─── VERIFICATION ───')
  const startVerify = Date.now()
  const isValid = await SimpleCircuit.verify(proof)
  const verifyTime = Date.now() - startVerify
  console.log(`  Verification result: ${isValid ? '✓ Valid' : '✗ Invalid'}`)
  console.log(`  Verified in ${verifyTime}ms`)
  console.log()

  // Summary
  console.log('─── SUMMARY ───')
  console.log(`  ✓ Successfully proved: ${a.toString()} × ${b.toString()} = ${expectedProduct.toString()}`)
  console.log(`  ✓ Compilation time: ${compileTime}ms`)
  console.log(`  ✓ Proving time: ${proveTime}ms`)
  console.log(`  ✓ Verification time: ${verifyTime}ms`)
  console.log()

  // SIP Relevance
  console.log('─── SIP RELEVANCE ───')
  console.log()
  console.log('This demonstrates Kimchi/o1js proof generation:')
  console.log('  • ZkProgram defines the circuit')
  console.log('  • Private inputs (a, b) are hidden')
  console.log('  • Public input (expectedProduct) is verifiable')
  console.log('  • Proof attests to correct computation')
  console.log()
  console.log('Kimchi uses the same Pasta curves as Halo2,')
  console.log('enabling potential proof composition between systems.')
  console.log()
}

main().catch(console.error)
