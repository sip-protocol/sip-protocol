import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  MockProofProvider,
  createProofAggregator,
  createVerificationPipeline,
  createCrossSystemValidator,
  UnifiedProofConverter,
} from '@sip-protocol/sdk'
import type {
  SingleProof,
  ComposedProof,
  ProofSystem,
  ProofMetadata,
  ComposableProofProvider,
} from '@sip-protocol/sdk'
import {
  success,
  error,
  info,
  keyValue,
  heading,
  spinner,
  json,
  table,
  divider,
  formatHash,
} from '../utils/output'

type OutputFormat = 'human' | 'json'

interface ProofFile {
  proof: SingleProof | ComposedProof
  metadata?: Record<string, unknown>
}

function readProofFile(path: string): ProofFile {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`)
  }
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content) as ProofFile
}

function writeProofFile(path: string, data: ProofFile): void {
  writeFileSync(path, JSON.stringify(data, null, 2))
}

function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => { data += chunk })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)

    // Set a timeout for stdin
    setTimeout(() => {
      if (data === '') {
        reject(new Error('No input received from stdin'))
      }
    }, 1000)
  })
}

// Extended list including experimental systems
const PROOF_SYSTEM_NAMES: Record<string, string> = {
  noir: 'Noir (Aztec)',
  halo2: 'Halo2 (Zcash)',
  kimchi: 'Kimchi (Mina)',
  groth16: 'Groth16',
  plonk: 'PLONK',
  stark: 'STARK',
}

function formatProofSystem(system: string): string {
  return PROOF_SYSTEM_NAMES[system] || system
}

function getSystemFromProof(proof: SingleProof): ProofSystem {
  return proof.metadata.system
}

export function createProofCommand(): Command {
  const proof = new Command('proof')
    .description('Proof composition operations (M20)')

  // ─── Generate Command ─────────────────────────────────────────────────────

  proof
    .command('generate')
    .description('Generate a ZK proof')
    .requiredOption('-s, --system <system>', 'Proof system (noir|halo2|kimchi|mock)')
    .requiredOption('-c, --circuit <id>', 'Circuit identifier')
    .option('-i, --inputs <json>', 'Public inputs as JSON string')
    .option('-f, --inputs-file <path>', 'Public inputs from JSON file')
    .option('-w, --witness <json>', 'Private witness as JSON string')
    .option('--witness-file <path>', 'Private witness from JSON file')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .action(async (options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Generate ZK Proof')
        }

        // Parse inputs
        let publicInputs: Record<string, unknown> = {}
        if (options.inputs) {
          publicInputs = JSON.parse(options.inputs)
        } else if (options.inputsFile) {
          publicInputs = JSON.parse(readFileSync(options.inputsFile, 'utf-8'))
        }

        const spin = format === 'human' ? spinner(`Generating ${options.system} proof...`) : null

        // Select provider based on system
        // Note: Currently using MockProofProvider for all systems
        // Real Halo2/Kimchi providers require WASM and native binaries
        const systemLower = options.system.toLowerCase()
        const provider = new MockProofProvider({ silent: true })
        await provider.initialize()

        // Generate funding proof as example
        const result = await provider.generateFundingProof({
          balance: BigInt(publicInputs.balance as string || '1000000'),
          minimumRequired: BigInt(publicInputs.minimum as string || '100'),
          blindingFactor: new Uint8Array(32),
          assetId: (publicInputs.asset as string) || 'ETH',
          userAddress: (publicInputs.user as string) || '0x0000000000000000000000000000000000000000',
          ownershipSignature: new Uint8Array(64),
        })

        spin?.succeed('Proof generated')

        const proofMetadata: ProofMetadata = {
          system: systemLower as ProofSystem,
          systemVersion: '1.0.0',
          circuitId: options.circuit,
          circuitVersion: '1.0.0',
          generatedAt: Date.now(),
          proofSizeBytes: result.proof.proof.length / 2, // hex string to bytes
        }

        const proofData: ProofFile = {
          proof: {
            id: `proof_${Date.now()}`,
            proof: result.proof.proof,
            publicInputs: result.publicInputs.map(String),
            metadata: proofMetadata,
          } as SingleProof,
          metadata: {
            system: options.system,
            circuit: options.circuit,
            timestamp: new Date().toISOString(),
          },
        }

        if (options.output) {
          writeProofFile(options.output, proofData)
          if (format === 'human') {
            success(`Proof written to ${options.output}`)
          }
        }

        if (format === 'json') {
          json(proofData)
        } else if (!options.output) {
          keyValue('System', formatProofSystem(systemLower))
          keyValue('Circuit', options.circuit)
          keyValue('Proof', formatHash(result.proof.proof, 16))
          keyValue('Public Inputs', JSON.stringify(result.publicInputs))
        }
      } catch (err) {
        if (format === 'json') {
          json({ error: String(err) })
        } else {
          error(`Failed to generate proof: ${err}`)
        }
        process.exit(1)
      }
    })

  // ─── Compose Command ──────────────────────────────────────────────────────

  proof
    .command('compose')
    .description('Compose multiple proofs together')
    .requiredOption('-p, --proofs <paths...>', 'Proof file paths to compose')
    .option('-t, --template <name>', 'Composition template (sequential|parallel|recursive)', 'sequential')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .option('--validate', 'Validate compatibility before composing', true)
    .action(async (options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Compose Proofs')
        }

        // Load proofs
        const proofs: SingleProof[] = []
        for (const path of options.proofs) {
          const proofFile = readProofFile(path)
          proofs.push(proofFile.proof as SingleProof)
        }

        if (format === 'human') {
          info(`Loaded ${proofs.length} proofs`)
          proofs.forEach((p, i) => {
            keyValue(`  Proof ${i + 1}`, `${formatProofSystem(getSystemFromProof(p))} - ${formatHash(p.id)}`)
          })
          divider()
        }

        // Validate compatibility if requested
        if (options.validate) {
          const validator = createCrossSystemValidator()
          const systems = [...new Set(proofs.map(p => getSystemFromProof(p)))]

          if (systems.length > 1) {
            const spin = format === 'human' ? spinner('Validating cross-system compatibility...') : null
            const report = validator.validate(proofs, {
              skipFieldCheck: false,
              skipCurveCheck: false,
            })

            const errors = report.checks.filter(c => !c.passed && c.severity === 'error')
            if (errors.length > 0) {
              spin?.fail('Compatibility check failed')
              if (format === 'json') {
                json({ error: 'Incompatible proof systems', report })
              } else {
                error('Proof systems are not compatible for composition')
                errors.forEach(e => {
                  error(`  - ${e.name}: ${e.message}`)
                })
              }
              process.exit(1)
            }
            spin?.succeed('Compatibility validated')
          }
        }

        const spin = format === 'human' ? spinner(`Composing proofs (${options.template})...`) : null
        const startTime = Date.now()

        // Create aggregator and compose using the appropriate method
        const aggregator = createProofAggregator()

        // Create a mock provider for composition
        const mockProvider = new MockProofProvider({ silent: true })
        await mockProvider.initialize()
        const getProvider = (_system: ProofSystem): ComposableProofProvider | undefined => {
          return mockProvider as unknown as ComposableProofProvider
        }

        let result
        if (options.template === 'parallel') {
          result = await aggregator.aggregateParallel({
            proofs,
            getProvider,
            verifyBefore: options.validate,
            maxConcurrent: 4,
            onProgress: (event) => {
              if (format === 'human' && spin) {
                const progress = Math.round((event.step / event.totalSteps) * 100)
                spin.text = `${event.operation} (${progress}%)`
              }
            },
          })
        } else {
          // Sequential is the default
          result = await aggregator.aggregateSequential({
            proofs,
            getProvider,
            verifyBefore: options.validate,
            onProgress: (event) => {
              if (format === 'human' && spin) {
                const progress = Math.round((event.step / event.totalSteps) * 100)
                spin.text = `${event.operation} (${progress}%)`
              }
            },
          })
        }

        const timeMs = Date.now() - startTime

        if (!result.success || !result.composedProof) {
          spin?.fail('Composition failed')
          if (format === 'json') {
            json({ error: result.error || 'Unknown error' })
          } else {
            error(`Composition failed: ${result.error || 'Unknown error'}`)
          }
          process.exit(1)
        }

        spin?.succeed('Composition complete')

        const outputData: ProofFile = {
          proof: result.composedProof,
          metadata: {
            template: options.template,
            inputProofs: proofs.map(p => p.id),
            timestamp: new Date().toISOString(),
            timeMs,
          },
        }

        if (options.output) {
          writeProofFile(options.output, outputData)
          if (format === 'human') {
            success(`Composed proof written to ${options.output}`)
          }
        }

        if (format === 'json') {
          json(outputData)
        } else if (!options.output) {
          keyValue('Composed Proof ID', result.composedProof.id)
          keyValue('Component Proofs', result.composedProof.proofs.length.toString())
          keyValue('Strategy', result.composedProof.strategy)
          keyValue('Time', `${timeMs}ms`)
        }
      } catch (err) {
        if (format === 'json') {
          json({ error: String(err) })
        } else {
          error(`Failed to compose proofs: ${err}`)
        }
        process.exit(1)
      }
    })

  // ─── Verify Command ───────────────────────────────────────────────────────

  proof
    .command('verify')
    .description('Verify a proof or composed proof')
    .argument('<path>', 'Proof file path (or - for stdin)')
    .option('--strict', 'Enable strict verification mode', false)
    .option('--json', 'Output as JSON', false)
    .action(async (path, options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Verify Proof')
        }

        // Read proof from file or stdin
        let proofData: ProofFile
        if (path === '-') {
          const stdinData = await readFromStdin()
          proofData = JSON.parse(stdinData) as ProofFile
        } else {
          proofData = readProofFile(path)
        }

        const spin = format === 'human' ? spinner('Verifying proof...') : null

        const pipeline = createVerificationPipeline()

        // Check if it's a composed proof
        const isComposed = 'proofs' in proofData.proof && Array.isArray((proofData.proof as ComposedProof).proofs)

        // Create a mock provider for verification
        const mockProvider = new MockProofProvider({ silent: true })
        await mockProvider.initialize()
        const getProvider = (_system: ProofSystem): ComposableProofProvider | undefined => {
          return mockProvider as unknown as ComposableProofProvider
        }

        let result
        if (isComposed) {
          result = await pipeline.verify(proofData.proof as ComposedProof, {
            getProvider,
            config: {},
          })
        } else {
          result = await pipeline.verifySingle(proofData.proof as SingleProof, getProvider)
        }

        if (result.valid) {
          spin?.succeed('Proof is valid')
        } else {
          spin?.fail('Proof verification failed')
        }

        if (format === 'json') {
          json({
            valid: result.valid,
            isComposed,
            details: result,
          })
        } else {
          keyValue('Valid', result.valid ? 'Yes' : 'No')
          keyValue('Type', isComposed ? 'Composed' : 'Single')
          if (isComposed) {
            const composed = proofData.proof as ComposedProof
            keyValue('Component Proofs', composed.proofs.length.toString())
          }
          if (!result.valid && 'error' in result) {
            error(`Reason: ${(result as { error?: string }).error}`)
          }
        }

        if (!result.valid) {
          process.exit(1)
        }
      } catch (err) {
        if (format === 'json') {
          json({ valid: false, error: String(err) })
        } else {
          error(`Failed to verify proof: ${err}`)
        }
        process.exit(1)
      }
    })

  // ─── Inspect Command ──────────────────────────────────────────────────────

  proof
    .command('inspect')
    .description('Analyze and display proof details')
    .argument('<path>', 'Proof file path (or - for stdin)')
    .option('--json', 'Output as JSON', false)
    .option('--full', 'Show full proof data (not truncated)', false)
    .action(async (path, options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Proof Inspection')
        }

        // Read proof from file or stdin
        let proofData: ProofFile
        if (path === '-') {
          const stdinData = await readFromStdin()
          proofData = JSON.parse(stdinData) as ProofFile
        } else {
          proofData = readProofFile(path)
        }

        const proof = proofData.proof
        const isComposed = 'proofs' in proof && Array.isArray((proof as ComposedProof).proofs)

        if (format === 'json') {
          json({
            type: isComposed ? 'composed' : 'single',
            ...proofData,
          })
          return
        }

        // Human-readable output
        keyValue('Type', isComposed ? 'Composed Proof' : 'Single Proof')
        keyValue('ID', proof.id)
        divider()

        if (isComposed) {
          const composed = proof as ComposedProof
          keyValue('Strategy', composed.strategy)
          keyValue('Status', composed.status)
          keyValue('Component Proofs', composed.proofs.length.toString())

          info('\nComponent Proofs:')
          table(
            ['#', 'System', 'ID', 'Public Inputs'],
            composed.proofs.map((p, i) => [
              (i + 1).toString(),
              formatProofSystem(getSystemFromProof(p)),
              formatHash(p.id),
              p.publicInputs.length.toString(),
            ])
          )

          if (composed.compositionMetadata) {
            divider()
            info('Composition Metadata:')
            keyValue('  Proof Count', composed.compositionMetadata.proofCount.toString())
            keyValue('  Systems', composed.compositionMetadata.systems.join(', '))
            keyValue('  Composition Time', `${composed.compositionMetadata.compositionTimeMs}ms`)
          }
        } else {
          const single = proof as SingleProof
          keyValue('System', formatProofSystem(getSystemFromProof(single)))

          if (single.metadata) {
            keyValue('Circuit ID', single.metadata.circuitId || 'N/A')
            keyValue('Circuit Version', single.metadata.circuitVersion || 'N/A')
            keyValue('System Version', single.metadata.systemVersion || 'N/A')
            keyValue('Proof Size', `${single.metadata.proofSizeBytes} bytes`)
            if (single.metadata.generatedAt) {
              keyValue('Generated At', new Date(single.metadata.generatedAt).toISOString())
            }
          }

          divider()
          info('Proof Data:')
          if (options.full) {
            keyValue('Proof', single.proof)
          } else {
            keyValue('Proof', formatHash(single.proof, 32))
          }

          info('\nPublic Inputs:')
          if (single.publicInputs && single.publicInputs.length > 0) {
            single.publicInputs.forEach((input, i) => {
              keyValue(`  [${i}]`, formatHash(input, 16))
            })
          } else {
            info('  (none)')
          }
        }

        if (proofData.metadata) {
          divider()
          info('File Metadata:')
          Object.entries(proofData.metadata).forEach(([key, value]) => {
            keyValue(`  ${key}`, typeof value === 'object' ? JSON.stringify(value) : String(value))
          })
        }
      } catch (err) {
        if (format === 'json') {
          json({ error: String(err) })
        } else {
          error(`Failed to inspect proof: ${err}`)
        }
        process.exit(1)
      }
    })

  // ─── Convert Command ──────────────────────────────────────────────────────

  proof
    .command('convert')
    .description('Convert proof between formats')
    .argument('<path>', 'Source proof file path (or - for stdin)')
    .requiredOption('-t, --to <format>', 'Target format (sip|noir|halo2|kimchi|json)')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON', false)
    .action(async (path, options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Convert Proof Format')
        }

        // Read proof from file or stdin
        let proofData: ProofFile
        if (path === '-') {
          const stdinData = await readFromStdin()
          proofData = JSON.parse(stdinData) as ProofFile
        } else {
          proofData = readProofFile(path)
        }

        const spin = format === 'human' ? spinner(`Converting to ${options.to} format...`) : null

        const converter = new UnifiedProofConverter()
        const targetFormat = options.to.toLowerCase()
        const single = proofData.proof as SingleProof

        let result: unknown

        if (targetFormat === 'json') {
          // Just pretty-print as JSON
          result = proofData
        } else if (targetFormat === 'sip') {
          // Already in SIP format, just validate
          result = proofData
        } else {
          // Convert to native format using the unified converter
          // Note: The converter uses the system from the proof's metadata
          const converted = converter.fromSIP(single)
          if (!converted.success || !converted.result) {
            throw new Error(converted.error || 'Conversion failed')
          }
          result = converted.result
        }

        spin?.succeed('Conversion complete')

        const outputData = {
          originalFormat: getSystemFromProof(single),
          targetFormat: targetFormat,
          proof: result,
          convertedAt: new Date().toISOString(),
        }

        if (options.output) {
          writeFileSync(options.output, JSON.stringify(outputData, null, 2))
          if (format === 'human') {
            success(`Converted proof written to ${options.output}`)
          }
        }

        if (format === 'json' || !options.output) {
          json(outputData)
        }
      } catch (err) {
        if (format === 'json') {
          json({ error: String(err) })
        } else {
          error(`Failed to convert proof: ${err}`)
        }
        process.exit(1)
      }
    })

  // ─── Systems Command ──────────────────────────────────────────────────────

  proof
    .command('systems')
    .description('List supported proof systems and their capabilities')
    .option('--json', 'Output as JSON', false)
    .action(async (options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      const systems = [
        {
          id: 'noir',
          name: 'Noir (Aztec)',
          curve: 'BN254',
          features: ['SNARK', 'Universal Setup', 'Browser Support'],
          status: 'Production',
        },
        {
          id: 'halo2',
          name: 'Halo2 (Zcash)',
          curve: 'Pallas/Vesta',
          features: ['SNARK', 'No Trusted Setup', 'Recursive'],
          status: 'Production',
        },
        {
          id: 'kimchi',
          name: 'Kimchi (Mina)',
          curve: 'Pasta',
          features: ['SNARK', 'Recursive', 'Succinct'],
          status: 'Production',
        },
        {
          id: 'groth16',
          name: 'Groth16',
          curve: 'BN254',
          features: ['SNARK', 'Smallest Proofs', 'Fastest Verification'],
          status: 'Supported',
        },
        {
          id: 'plonk',
          name: 'PLONK',
          curve: 'BN254',
          features: ['SNARK', 'Universal Setup', 'Flexible'],
          status: 'Supported',
        },
        {
          id: 'stark',
          name: 'STARK',
          curve: 'None (Hash-based)',
          features: ['No Trusted Setup', 'Post-Quantum', 'Large Proofs'],
          status: 'Experimental',
        },
      ]

      if (format === 'json') {
        json({ systems })
        return
      }

      heading('Supported Proof Systems')

      table(
        ['System', 'Curve', 'Status'],
        systems.map(s => [s.name, s.curve, s.status])
      )

      divider()
      info('Features by System:')
      systems.forEach(s => {
        keyValue(`  ${s.name}`, s.features.join(', '))
      })
    })

  // ─── Compatibility Command ────────────────────────────────────────────────

  proof
    .command('compat')
    .description('Check compatibility between proof systems')
    .argument('<systems...>', 'Proof systems to check (e.g., noir halo2)')
    .option('--json', 'Output as JSON', false)
    .action(async (systems: string[], options) => {
      const format: OutputFormat = options.json ? 'json' : 'human'

      try {
        if (format === 'human') {
          heading('Proof System Compatibility')
        }

        // Create mock proofs for each system to test compatibility
        const mockProofs: SingleProof[] = systems.map((sys, i) => ({
          id: `mock_${sys}_${i}`,
          proof: '0x00',
          publicInputs: ['0x01'],
          metadata: {
            system: sys as ProofSystem,
            systemVersion: '1.0.0',
            circuitId: 'test',
            circuitVersion: '1.0.0',
            generatedAt: Date.now(),
            proofSizeBytes: 1,
          },
        }))

        const validator = createCrossSystemValidator()
        const report = validator.validate(mockProofs, {
          skipFieldCheck: false,
          skipCurveCheck: false,
        })

        const errors = report.checks.filter(c => !c.passed && c.severity === 'error')
        const warnings = report.checks.filter(c => !c.passed && c.severity === 'warning')
        const compatible = errors.length === 0

        if (format === 'json') {
          json({
            systems,
            compatible,
            errors: errors.map(e => ({ check: e.name, message: e.message })),
            warnings: warnings.map(w => ({ check: w.name, message: w.message })),
            report,
          })
          return
        }

        keyValue('Systems', systems.join(', '))
        keyValue('Compatible', compatible ? 'Yes' : 'No')

        if (compatible) {
          success('These proof systems can be composed together')
        } else {
          error('These proof systems are not directly compatible')
          divider()
          info('Issues:')
          errors.forEach(e => {
            error(`  - ${e.name}: ${e.message}`)
          })
        }

        if (warnings.length > 0) {
          divider()
          info('Warnings:')
          warnings.forEach(w => {
            info(`  ⚠ ${w.name}: ${w.message}`)
          })
        }

        if (!compatible) {
          process.exit(1)
        }
      } catch (err) {
        if (format === 'json') {
          json({ error: String(err) })
        } else {
          error(`Failed to check compatibility: ${err}`)
        }
        process.exit(1)
      }
    })

  return proof
}
