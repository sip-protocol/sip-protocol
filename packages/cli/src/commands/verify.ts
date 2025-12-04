import { Command } from 'commander'
import { MockProofProvider } from '@sip-protocol/sdk'
import type { ZKProof } from '@sip-protocol/types'
import { success, error, heading, info, spinner } from '../utils/output'

export function createVerifyCommand(): Command {
  return new Command('verify')
    .description('Verify ZK proof')
    .argument('<proof>', 'Proof to verify (hex string)')
    .option('-t, --type <type>', 'Proof type (funding|validity|fulfillment)', 'funding')
    .option('-p, --public-inputs <json>', 'Public inputs (JSON array)')
    .action(async (proofHex: string, options) => {
      try {
        heading('Verify ZK Proof')

        info(`Proof type: ${options.type}`)
        info(`Proof: ${proofHex.slice(0, 20)}...`)

        const publicInputs = options.publicInputs
          ? JSON.parse(options.publicInputs)
          : []

        // Ensure proof is hex string format
        const proofHexStr = proofHex.startsWith('0x') ? proofHex : `0x${proofHex}`

        const zkProof: ZKProof = {
          type: options.type as 'funding' | 'validity' | 'fulfillment',
          proof: proofHexStr as `0x${string}`,
          publicInputs,
        }

        const spin = spinner('Verifying proof...')
        const provider = new MockProofProvider({ silent: true })
        await provider.initialize()

        // MockProofProvider uses single verifyProof method for all proof types
        const isValid = await provider.verifyProof(zkProof)

        spin.stop()

        if (isValid) {
          success(`Proof is valid (type: ${options.type})`)
        } else {
          error('Proof is invalid')
          process.exit(1)
        }
      } catch (err) {
        console.error('Failed to verify proof:', err)
        process.exit(1)
      }
    })
}
