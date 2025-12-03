import { Command } from 'commander'
import { commit, verifyOpening } from '@sip-protocol/sdk'
import { success, keyValue, heading, info } from '../utils/output'

export function createCommitCommand(): Command {
  return new Command('commit')
    .description('Create Pedersen commitment')
    .argument('<amount>', 'Amount to commit')
    .option('-b, --blinding <factor>', 'Blinding factor (hex, optional)')
    .option('--verify', 'Verify the commitment after creation')
    .action(async (amountStr: string, options) => {
      try {
        heading('Create Pedersen Commitment')

        const amount = BigInt(amountStr)
        info(`Committing amount: ${amount}`)

        // Create commitment
        const commitment = options.blinding
          ? commit(amount, options.blinding)
          : commit(amount)

        success('Commitment created')
        keyValue('Commitment', commitment.commitment)
        keyValue('Blinding Factor', commitment.blinding)
        keyValue('Amount', amount.toString())

        // Optionally verify
        if (options.verify) {
          console.log()
          info('Verifying commitment...')
          const isValid = verifyOpening(commitment.commitment, amount, commitment.blinding)
          if (isValid) {
            success('Commitment verified successfully')
          } else {
            console.error('Commitment verification failed')
            process.exit(1)
          }
        }
      } catch (err) {
        console.error('Failed to create commitment:', err)
        process.exit(1)
      }
    })
}
