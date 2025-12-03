import { Command } from 'commander'
import { MockProofProvider } from '@sip-protocol/sdk'
import type { ProofResult } from '@sip-protocol/sdk'
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

        const proofResult: ProofResult = {
          proof: proofHex,
          publicInputs,
          framework: 'mock',
        }

        const spin = spinner('Verifying proof...')
        const provider = new MockProofProvider()
        await provider.initialize()

        let isValid = false
        switch (options.type) {
          case 'funding':
            isValid = await provider.verifyFundingProof(proofResult)
            break
          case 'validity':
            isValid = await provider.verifyValidityProof(proofResult)
            break
          case 'fulfillment':
            isValid = await provider.verifyFulfillmentProof(proofResult)
            break
          default:
            throw new Error(`Unknown proof type: ${options.type}`)
        }

        spin.stop()

        if (isValid) {
          success('Proof is valid')
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
