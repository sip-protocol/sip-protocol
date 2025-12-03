import { Command } from 'commander'
import { createSIP } from '@sip-protocol/sdk'
import { PrivacyLevel } from '@sip-protocol/types'
import type { ChainId } from '@sip-protocol/types'
import { getConfig } from '../utils/config'
import { success, keyValue, heading, spinner, formatAmount, formatHash, info } from '../utils/output'

export function createSwapCommand(): Command {
  return new Command('swap')
    .description('Execute swap')
    .argument('<from-chain>', 'Source chain (e.g., ethereum, solana)')
    .argument('<to-chain>', 'Destination chain')
    .argument('<amount>', 'Amount to swap')
    .option('-t, --token <symbol>', 'Token symbol (default: native token)')
    .option('-p, --privacy <level>', 'Privacy level (transparent|shielded|compliant)')
    .option('-r, --recipient <address>', 'Recipient address (optional)')
    .option('--solver <id>', 'Specific solver to use')
    .action(async (fromChain: string, toChain: string, amountStr: string, options) => {
      try {
        heading('Execute Swap')

        const config = getConfig()
        const amount = BigInt(amountStr)
        const privacy = (options.privacy || config.defaultPrivacy) as PrivacyLevel

        const sip = createSIP({ network: config.network })

        // Create intent
        info('Creating shielded intent...')
        const intent = await sip.createIntent({
          input: {
            chain: fromChain as ChainId,
            token: options.token || 'native',
            amount,
          },
          output: {
            chain: toChain as ChainId,
            token: options.token || 'native',
          },
          privacy,
          recipient: options.recipient,
        })

        success('Intent created')
        keyValue('Intent ID', formatHash(intent.id))

        // Get quotes
        const spin = spinner('Fetching quotes...')
        const quotes = await sip.getQuotes(intent)
        spin.succeed(`Found ${quotes.length} quote(s)`)

        if (quotes.length === 0) {
          console.error('\nNo quotes available')
          process.exit(1)
        }

        // Select quote
        const selectedQuote = options.solver
          ? quotes.find(q => q.solver === options.solver)
          : quotes[0]

        if (!selectedQuote) {
          console.error(`\nSolver not found: ${options.solver}`)
          process.exit(1)
        }

        info(`Using solver: ${selectedQuote.solver}`)
        keyValue('Output Amount', formatAmount(selectedQuote.outputAmount))

        // Execute swap
        const executeSpin = spinner('Executing swap...')
        const result = await sip.execute(intent, selectedQuote)
        executeSpin.succeed('Swap executed')

        success('Swap completed successfully')
        keyValue('Transaction Hash', formatHash(result.transactionHash))
        keyValue('Output Amount', formatAmount(result.outputAmount))
        keyValue('Status', result.status)

        if (result.receipt) {
          keyValue('Block', result.receipt.blockNumber?.toString() || 'Pending')
        }
      } catch (err) {
        console.error('Failed to execute swap:', err)
        process.exit(1)
      }
    })
}
