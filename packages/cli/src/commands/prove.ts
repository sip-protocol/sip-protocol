import { Command } from 'commander'
import { MockProofProvider } from '@sip-protocol/sdk'
import type { FundingProofParams, ValidityProofParams } from '@sip-protocol/sdk'
import { success, keyValue, heading, info, spinner } from '../utils/output'

export function createProveCommand(): Command {
  const prove = new Command('prove')
    .description('Generate ZK proof')

  // Funding proof
  prove
    .command('funding')
    .description('Generate funding proof')
    .requiredOption('-b, --balance <amount>', 'Current balance')
    .requiredOption('-m, --minimum <amount>', 'Minimum required')
    .option('-a, --asset <id>', 'Asset identifier', 'ETH')
    .option('-u, --user <address>', 'User address', '0x0000000000000000000000000000000000000000')
    .action(async (options) => {
      try {
        heading('Generate Funding Proof')

        // Create dummy signature and blinding factor
        const blindingFactor = new Uint8Array(32)
        const ownershipSignature = new Uint8Array(64)

        const params: FundingProofParams = {
          balance: BigInt(options.balance),
          minimumRequired: BigInt(options.minimum),
          blindingFactor,
          assetId: options.asset,
          userAddress: options.user,
          ownershipSignature,
        }

        const spin = spinner('Generating proof...')
        const provider = new MockProofProvider()
        await provider.initialize()
        const result = await provider.generateFundingProof(params)
        spin.succeed('Proof generated')

        success('Funding proof created')
        keyValue('Proof', typeof result.proof === 'string' ? result.proof : JSON.stringify(result.proof))
        keyValue('Public Inputs', JSON.stringify(result.publicInputs))
        keyValue('Framework', result.framework)
      } catch (err) {
        console.error('Failed to generate proof:', err)
        process.exit(1)
      }
    })

  // Validity proof
  prove
    .command('validity')
    .description('Generate validity proof')
    .requiredOption('-i, --intent <hash>', 'Intent hash')
    .requiredOption('-s, --sender <address>', 'Sender address')
    .action(async (options) => {
      try {
        heading('Generate Validity Proof')

        // Create dummy Uint8Arrays
        const senderBlinding = new Uint8Array(32)
        const senderSecret = new Uint8Array(32)
        const authorizationSignature = new Uint8Array(64)
        const nonce = new Uint8Array(32)

        const params: ValidityProofParams = {
          intentHash: options.intent,
          senderAddress: options.sender,
          senderBlinding,
          senderSecret,
          authorizationSignature,
          nonce,
          timestamp: Date.now(),
        }

        const spin = spinner('Generating proof...')
        const provider = new MockProofProvider()
        await provider.initialize()
        const result = await provider.generateValidityProof(params)
        spin.succeed('Proof generated')

        success('Validity proof created')
        keyValue('Proof', typeof result.proof === 'string' ? result.proof : JSON.stringify(result.proof))
        keyValue('Public Inputs', JSON.stringify(result.publicInputs))
        keyValue('Framework', result.framework)
      } catch (err) {
        console.error('Failed to generate proof:', err)
        process.exit(1)
      }
    })

  return prove
}
