/**
 * SIP Kimchi POC - Recursive Proof Demo
 *
 * Demonstrates Kimchi/Pickles recursion capabilities.
 * This is the key differentiator for proof composition.
 */

import { Field, ZkProgram, Provable, SelfProof } from 'o1js'

// Counter circuit that can recursively prove increments
const RecursiveCounter = ZkProgram({
  name: 'recursive-counter',
  publicInput: Field, // Current counter value

  methods: {
    // Base case: initialize counter at 0
    init: {
      privateInputs: [],

      async method(counter: Field) {
        counter.assertEquals(Field(0))
      },
    },

    // Recursive case: increment counter and verify previous proof
    increment: {
      privateInputs: [SelfProof],

      async method(counter: Field, previousProof: SelfProof<Field, void>) {
        // Verify the previous proof
        previousProof.verify()

        // Get previous counter value
        const previousCounter = previousProof.publicInput

        // Assert current counter = previous + 1
        counter.assertEquals(previousCounter.add(1))
      },
    },
  },
})

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     SIP KIMCHI POC - Recursive Proof Demo                  ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()

  console.log('┌─────────────────────────────────────────┐')
  console.log('│     KIMCHI/PICKLES RECURSION DEMO       │')
  console.log('└─────────────────────────────────────────┘')
  console.log()
  console.log('This demonstrates proof composition via recursion.')
  console.log('Each proof verifies the previous proof and increments a counter.')
  console.log()

  // Compile
  console.log('─── COMPILATION ───')
  const startCompile = Date.now()
  await RecursiveCounter.compile()
  const compileTime = Date.now() - startCompile
  console.log(`  Compiled in ${compileTime}ms`)
  console.log()

  // Build recursive proof chain
  const numIterations = 3
  console.log(`─── RECURSIVE PROOF CHAIN (${numIterations} iterations) ───`)
  console.log()

  // Base case: counter = 0
  console.log('  [0] Base case (counter = 0)')
  let startProve = Date.now()
  let proof = await RecursiveCounter.init(Field(0))
  let proveTime = Date.now() - startProve
  console.log(`      Proof generated in ${proveTime}ms`)

  // Recursive cases
  for (let i = 1; i <= numIterations; i++) {
    console.log(`  [${i}] Recursive case (counter = ${i})`)
    startProve = Date.now()
    proof = await RecursiveCounter.increment(Field(i), proof)
    proveTime = Date.now() - startProve
    console.log(`      Proof generated in ${proveTime}ms`)
    console.log(`      (Verifies previous proof internally)`)
  }
  console.log()

  // Verify final proof
  console.log('─── FINAL VERIFICATION ───')
  const startVerify = Date.now()
  const isValid = await RecursiveCounter.verify(proof)
  const verifyTime = Date.now() - startVerify
  console.log(`  Final proof (counter = ${numIterations}): ${isValid ? '✓ Valid' : '✗ Invalid'}`)
  console.log(`  Verified in ${verifyTime}ms`)
  console.log()

  // Comparison
  console.log('─── COMPARISON: KIMCHI vs HALO2 RECURSION ───')
  console.log()
  console.log('┌──────────────────┬─────────────────────┬─────────────────────┐')
  console.log('│     Aspect       │   Halo2 (Accum)     │  Kimchi (Pickles)   │')
  console.log('├──────────────────┼─────────────────────┼─────────────────────┤')
  console.log('│ Recursion Model  │   Accumulation      │   Step/Wrap         │')
  console.log('│ Final Size       │   ~1.5KB × depth    │   ~22KB constant    │')
  console.log('│ Verification     │   O(log n) amort.   │   O(1) constant     │')
  console.log('│ API Style        │   Manual accum.     │   SelfProof auto    │')
  console.log('│ Best For         │   Many proofs       │   Constant output   │')
  console.log('└──────────────────┴─────────────────────┴─────────────────────┘')
  console.log()

  // SIP composition vision
  console.log('─── SIP PROOF COMPOSITION VISION ───')
  console.log()
  console.log('  1. MULTI-SYSTEM COMPOSITION:')
  console.log()
  console.log('     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐')
  console.log('     │ Noir Proof  │  │ Halo2 Proof │  │ External    │')
  console.log('     │ (validity)  │  │ (privacy)   │  │ (any)       │')
  console.log('     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘')
  console.log('            │                │                │')
  console.log('            └────────┬───────┴────────┬───────┘')
  console.log('                     │                │')
  console.log('                     ▼                ▼')
  console.log('            ┌─────────────────────────────────┐')
  console.log('            │       HALO2 ACCUMULATOR         │')
  console.log('            │  (flexible, small per-proof)    │')
  console.log('            └──────────────┬──────────────────┘')
  console.log('                           │')
  console.log('                           ▼')
  console.log('            ┌─────────────────────────────────┐')
  console.log('            │     KIMCHI/PICKLES WRAPPER      │')
  console.log('            │  (constant ~22KB output)        │')
  console.log('            └──────────────┬──────────────────┘')
  console.log('                           │')
  console.log('                           ▼')
  console.log('            ┌─────────────────────────────────┐')
  console.log('            │      LIGHT CLIENT PROOF         │')
  console.log('            │  • Verifiable by mobile         │')
  console.log('            │  • Chain-agnostic              │')
  console.log('            │  • No full node needed         │')
  console.log('            └─────────────────────────────────┘')
  console.log()
  console.log('  2. WHY BOTH SYSTEMS:')
  console.log('     • Halo2: Flexible accumulation for multiple proof types')
  console.log('     • Kimchi: Constant-size output for light clients')
  console.log('     • Same Pasta curves enable composition')
  console.log()
  console.log('  3. SIP UNIQUE MOAT:')
  console.log('     Privacy (Zcash/Halo2) + Validity (Noir) + Succinct (Kimchi)')
  console.log('     = Composed proof that no single system can provide')
  console.log()
}

main().catch(console.error)
