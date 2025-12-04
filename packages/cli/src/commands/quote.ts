import { Command } from 'commander'
import { createSIP, NATIVE_TOKENS } from '@sip-protocol/sdk'
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

        const sip = createSIP(config.network)

        const spin = spinner('Fetching quotes...')

        // Get native tokens for chains
        const inputAsset = NATIVE_TOKENS[fromChain as ChainId] || {
          chain: fromChain as ChainId,
          symbol: options.token || 'native',
          address: null,
          decimals: 18,
        }
        const outputAsset = NATIVE_TOKENS[toChain as ChainId] || {
          chain: toChain as ChainId,
          symbol: options.token || 'native',
          address: null,
          decimals: 18,
        }

        // Create intent
        const intent = await sip.createIntent({
          input: {
            asset: inputAsset,
            amount,
          },
          output: {
            asset: outputAsset,
            minAmount: 0n, // Accept any amount for quote discovery
            maxSlippage: 0.05, // 5% slippage tolerance
          },
          privacy,
        })

        // Get quotes
        const quotes = await sip.getQuotes(intent)
        spin.succeed(`Found ${quotes.length} quote(s)`)

        if (quotes.length === 0) {
          console.error('\nNo quotes available')
          process.exit(1)
        }

        // Display quotes in table
        console.log()
        const headers = ['Solver', 'Output Amount', 'Fee', 'Time (s)']
        const rows = quotes.map(q => [
          q.solverId,
          formatAmount(q.outputAmount),
          formatAmount(q.fee),
          q.estimatedTime.toString(),
        ])

        table(headers, rows)

        // Show best quote details
        const best = quotes[0]
        console.log()
        success('Best quote:')
        keyValue('Solver', best.solverId)
        keyValue('Output Amount', formatAmount(best.outputAmount))
        keyValue('Estimated Time', `${best.estimatedTime}s`)
      } catch (err) {
        console.error('Failed to get quote:', err)
        process.exit(1)
      }
    })
}
