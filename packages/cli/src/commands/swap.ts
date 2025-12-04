import { Command } from 'commander'
import { createSIP, NATIVE_TOKENS } from '@sip-protocol/sdk'
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
    .option('-s, --slippage <percent>', 'Slippage tolerance in percent (default: 5)', parseFloat)
    .option('--solver <id>', 'Specific solver to use')
    .action(async (fromChain: string, toChain: string, amountStr: string, options) => {
      try {
        heading('Execute Swap')

        const config = getConfig()
        const amount = BigInt(amountStr)
        const privacy = (options.privacy || config.defaultPrivacy) as PrivacyLevel

        const sip = createSIP(config.network)

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

        // Calculate slippage tolerance (default 5%, range 0-100)
        const slippagePercent = Math.min(Math.max(options.slippage ?? 5, 0), 100)
        const slippageTolerance = slippagePercent / 100

        // Create intent
        info('Creating shielded intent...')
        info(`Slippage tolerance: ${slippagePercent}%`)
        const intent = await sip.createIntent({
          input: {
            asset: inputAsset,
            amount,
          },
          output: {
            asset: outputAsset,
            minAmount: 0n, // Accept any amount
            maxSlippage: slippageTolerance, // User-configurable slippage
          },
          privacy,
          recipientMetaAddress: options.recipient,
        })

        success('Intent created')
        keyValue('Intent ID', formatHash(intent.intentId))

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
          ? quotes.find(q => q.solverId === options.solver)
          : quotes[0]

        if (!selectedQuote) {
          console.error(`\nSolver not found: ${options.solver}`)
          process.exit(1)
        }

        info(`Using solver: ${selectedQuote.solverId}`)
        keyValue('Output Amount', formatAmount(selectedQuote.outputAmount))

        // Execute swap
        const executeSpin = spinner('Executing swap...')
        const result = await sip.execute(intent, selectedQuote)
        executeSpin.succeed('Swap executed')

        success('Swap completed successfully')
        if (result.txHash) {
          keyValue('Transaction Hash', formatHash(result.txHash))
        }
        if (result.outputAmount) {
          keyValue('Output Amount', formatAmount(result.outputAmount))
        }
        keyValue('Status', result.status)
      } catch (err) {
        console.error('Failed to execute swap:', err)
        process.exit(1)
      }
    })
}
