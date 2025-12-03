import { Command } from 'commander'
import { createSIP } from '@sip-protocol/sdk'
import { PrivacyLevel } from '@sip-protocol/types'
import type { ChainId } from '@sip-protocol/types'
import { getConfig } from '../utils/config'
import { success, keyValue, heading, spinner, formatAmount, table } from '../utils/output'

export function createQuoteCommand(): Command {
  return new Command('quote')
    .description('Get swap quote')
    .argument('<from-chain>', 'Source chain (e.g., ethereum, solana)')
    .argument('<to-chain>', 'Destination chain')
    .argument('<amount>', 'Amount to swap')
    .option('-t, --token <symbol>', 'Token symbol (default: native token)')
    .option('-p, --privacy <level>', 'Privacy level (transparent|shielded|compliant)')
    .action(async (fromChain: string, toChain: string, amountStr: string, options) => {
      try {
        heading('Get Swap Quote')

        const config = getConfig()
        const amount = BigInt(amountStr)
        const privacy = (options.privacy || config.defaultPrivacy) as PrivacyLevel

        const sip = createSIP({ network: config.network })

        const spin = spinner('Fetching quotes...')

        // Create intent
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
        })

        // Get quotes
        const quotes = await sip.getQuotes(intent)
        spin.succeed(`Found ${quotes.length} quote(s)`)

        if (quotes.length === 0) {
          console.log('\nNo quotes available')
          return
        }

        // Display quotes in table
        console.log()
        const headers = ['Solver', 'Output Amount', 'Fee', 'Rate', 'Time']
        const rows = quotes.map(q => [
          q.solver,
          formatAmount(q.outputAmount),
          q.fee ? formatAmount(BigInt(q.fee)) : 'N/A',
          q.rate ? q.rate.toFixed(6) : 'N/A',
          q.estimatedTime || 'N/A',
        ])

        table(headers, rows)

        // Show best quote details
        const best = quotes[0]
        console.log()
        success('Best quote:')
        keyValue('Solver', best.solver)
        keyValue('Output Amount', formatAmount(best.outputAmount))
        keyValue('Estimated Time', best.estimatedTime || 'Unknown')
      } catch (err) {
        console.error('Failed to get quote:', err)
        process.exit(1)
      }
    })
}
