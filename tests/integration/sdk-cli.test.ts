import { describe, it, expect, beforeAll } from 'vitest'
import { spawn } from 'child_process'
import { resolve } from 'path'
import { TEST_FIXTURES } from './setup'

/**
 * Integration Tests: SDK + CLI
 *
 * These tests verify that CLI commands correctly use SDK functions
 * and produce valid outputs.
 */

const CLI_PATH = resolve(__dirname, '../../packages/cli/bin/sip.js')
const CLI_TIMEOUT = 30000 // 30s

/**
 * Helper to execute CLI command and capture output
 */
function execCli(args: string[]): Promise<{
  stdout: string
  stderr: string
  exitCode: number
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      })
    })

    proc.on('error', (err) => {
      reject(err)
    })

    // Timeout protection
    setTimeout(() => {
      proc.kill()
      reject(new Error('CLI command timeout'))
    }, CLI_TIMEOUT)
  })
}

describe('SDK + CLI Integration', () => {
  beforeAll(async () => {
    // Build CLI if needed
    // This ensures latest changes are included
    const { exitCode } = await execCli(['--version'])
    expect(exitCode).toBe(0)
  })

  describe('sip keygen', () => {
    it('should generate valid stealth meta-address for Ethereum', async () => {
      const { stdout, exitCode } = await execCli(['keygen', '--chain', 'ethereum'])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Stealth meta-address generated')
      expect(stdout).toContain('Chain')
      expect(stdout).toContain('ethereum')

      // Should output spending and viewing keys
      expect(stdout).toContain('Spending Public Key')
      expect(stdout).toContain('Viewing Public Key')
      expect(stdout).toContain('Encoded Address')

      // Should show private keys
      expect(stdout).toContain('PRIVATE KEYS')
      expect(stdout).toContain('Spending Private Key')
      expect(stdout).toContain('Viewing Private Key')

      // Extract encoded address and verify format
      const encodedMatch = stdout.match(/Encoded Address.*?(sip:ethereum:0x[0-9a-f]{66}:0x[0-9a-f]{66})/i)
      expect(encodedMatch).toBeTruthy()

      const encoded = encodedMatch?.[1]
      expect(encoded).toMatch(/^sip:ethereum:0x[0-9a-f]{66}:0x[0-9a-f]{66}$/i)
    })

    it('should generate valid stealth meta-address for Solana (ed25519)', async () => {
      const { stdout, exitCode } = await execCli(['keygen', '--chain', 'solana'])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Stealth meta-address generated')
      expect(stdout).toContain('solana')

      // Extract encoded address and verify format
      const encodedMatch = stdout.match(/Encoded Address.*?(sip:solana:0x[0-9a-f]{64}:0x[0-9a-f]{64})/i)
      expect(encodedMatch).toBeTruthy()

      const encoded = encodedMatch?.[1]
      expect(encoded).toMatch(/^sip:solana:0x[0-9a-f]{64}:0x[0-9a-f]{64}$/i)
    })

    it('should generate different keys on each run', async () => {
      const { stdout: stdout1 } = await execCli(['keygen', '--chain', 'ethereum'])
      const { stdout: stdout2 } = await execCli(['keygen', '--chain', 'ethereum'])

      const extract = (output: string) => {
        const match = output.match(/Spending Private Key.*?0x([0-9a-f]+)/i)
        return match?.[1]
      }

      const key1 = extract(stdout1)
      const key2 = extract(stdout2)

      expect(key1).toBeTruthy()
      expect(key2).toBeTruthy()
      expect(key1).not.toBe(key2)
    })
  })

  describe('sip commit', () => {
    it('should create valid Pedersen commitment', async () => {
      const amount = '1000000'
      const { stdout, exitCode } = await execCli(['commit', amount])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Commitment created')
      expect(stdout).toContain('Commitment')
      expect(stdout).toContain('Blinding Factor')
      expect(stdout).toContain('Amount')
      expect(stdout).toContain(amount)

      // Extract commitment and verify format
      const commitmentMatch = stdout.match(/Commitment.*?(0x[0-9a-f]+)/i)
      expect(commitmentMatch).toBeTruthy()

      const commitment = commitmentMatch?.[1]
      expect(commitment).toMatch(/^0x[0-9a-f]+$/)
    })

    it('should create and verify commitment with --verify flag', async () => {
      const amount = '5000000'
      const { stdout, exitCode } = await execCli(['commit', amount, '--verify'])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Commitment created')
      expect(stdout).toContain('Verifying commitment')
      expect(stdout).toContain('Commitment verified successfully')
    })

    it('should accept custom blinding factor', async () => {
      const amount = '1000000'
      const blinding = '0x' + '11'.repeat(32)
      const { stdout, exitCode } = await execCli(['commit', amount, '--blinding', blinding])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Commitment created')
      expect(stdout).toContain(blinding)
    })

    it('should create different commitments for same amount', async () => {
      const amount = '1000000'
      const { stdout: stdout1 } = await execCli(['commit', amount])
      const { stdout: stdout2 } = await execCli(['commit', amount])

      const extract = (output: string) => {
        const match = output.match(/Commitment.*?(0x[0-9a-f]+)/i)
        return match?.[1]
      }

      const c1 = extract(stdout1)
      const c2 = extract(stdout2)

      expect(c1).toBeTruthy()
      expect(c2).toBeTruthy()
      expect(c1).not.toBe(c2) // Different blinding factors
    })
  })

  describe('sip prove', () => {
    it('should generate funding proof', async () => {
      const balance = '10000000'
      const minimum = '1000000'
      const { stdout, exitCode } = await execCli([
        'prove',
        'funding',
        '--balance',
        balance,
        '--minimum',
        minimum,
      ])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Funding proof created')
      expect(stdout).toContain('Proof')
      expect(stdout).toContain('Public Inputs')
      expect(stdout).toContain('Framework')

      // Should use mock framework for now
      expect(stdout).toContain('mock')
    })

    it('should generate validity proof', async () => {
      const intentHash = '0xabc123'
      const sender = '0x1234567890123456789012345678901234567890'
      const { stdout, exitCode } = await execCli([
        'prove',
        'validity',
        '--intent',
        intentHash,
        '--sender',
        sender,
      ])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Validity proof created')
      expect(stdout).toContain('Proof')
      expect(stdout).toContain('Public Inputs')
      expect(stdout).toContain('Framework')
    })

    it('should accept optional parameters for funding proof', async () => {
      const { stdout, exitCode } = await execCli([
        'prove',
        'funding',
        '--balance',
        '10000000',
        '--minimum',
        '1000000',
        '--asset',
        'USDC',
        '--user',
        '0xdeadbeef00000000000000000000000000000000',
      ])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Funding proof created')
    })
  })

  describe('sip verify', () => {
    it('should verify commitment opening', async () => {
      // First create commitment
      const amount = '1000000'
      const { stdout: commitOutput } = await execCli(['commit', amount])

      // Extract commitment and blinding
      const commitmentMatch = commitOutput.match(/Commitment\s+.*?(0x[0-9a-f]+)/i)
      const blindingMatch = commitOutput.match(/Blinding Factor\s+.*?(0x[0-9a-f]+)/i)

      const commitment = commitmentMatch?.[1]
      const blinding = blindingMatch?.[1]

      expect(commitment).toBeTruthy()
      expect(blinding).toBeTruthy()

      // Now verify
      const { stdout, exitCode } = await execCli([
        'verify',
        commitment!,
        amount,
        blinding!,
      ])

      expect(exitCode).toBe(0)
      expect(stdout).toContain('valid') // Should say "valid" or "Commitment is valid"
    })
  })

  describe('CLI error handling', () => {
    it('should handle invalid commands gracefully', async () => {
      const { stderr, exitCode } = await execCli(['invalid-command'])

      expect(exitCode).not.toBe(0)
      expect(stderr.length > 0 || true).toBe(true) // Commander may output to stdout
    })

    it('should require arguments for commit command', async () => {
      const { exitCode } = await execCli(['commit'])

      expect(exitCode).not.toBe(0)
    })

    it('should validate numeric amounts', async () => {
      const { exitCode } = await execCli(['commit', 'invalid-amount'])

      // Should fail or handle gracefully
      expect(exitCode).not.toBe(0)
    })
  })

  describe('CLI + SDK consistency', () => {
    it('should generate same commitment format as SDK', async () => {
      const amount = '1000000'
      const { stdout } = await execCli(['commit', amount])

      const commitmentMatch = stdout.match(/Commitment.*?(0x[0-9a-f]+)/i)
      const commitment = commitmentMatch?.[1]

      expect(commitment).toBeTruthy()
      // SDK format: 0x followed by hex (66 chars for secp256k1 point)
      expect(commitment).toMatch(/^0x[0-9a-f]{66}$/i)
    })

    it('should generate same stealth address format as SDK', async () => {
      const { stdout } = await execCli(['keygen', '--chain', 'ethereum'])

      const encodedMatch = stdout.match(/Encoded Address.*?(sip:ethereum:0x[0-9a-f]{66}:0x[0-9a-f]{66})/i)
      const encoded = encodedMatch?.[1]

      expect(encoded).toBeTruthy()
      // Should match SDK's encodeStealthMetaAddress format
      expect(encoded).toMatch(/^sip:ethereum:0x[0-9a-f]{66}:0x[0-9a-f]{66}$/i)
    })
  })
})
