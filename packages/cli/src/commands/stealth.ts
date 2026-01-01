import { Command } from 'commander'
import prompts from 'prompts'
import chalk from 'chalk'
import ora from 'ora'
import {
  generateStealthAddress,
  generateEd25519StealthAddress,
  decodeStealthMetaAddress,
  isEd25519Chain,
  ed25519PublicKeyToSolanaAddress,
  ed25519PublicKeyToNearAddress,
  publicKeyToEthAddress,
} from '@sip-protocol/sdk'
import type { ChainId, StealthMetaAddress } from '@sip-protocol/types'
import { getConfig } from '../utils/config'
import { success, warning, keyValue, heading } from '../utils/output'

export function createStealthCommand(): Command {
  const cmd = new Command('stealth')
    .description('Generate one-time stealth addresses')

  // Generate subcommand
  cmd
    .command('generate')
    .alias('gen')
    .description('Generate a one-time stealth address from a meta-address')
    .option('-m, --meta <address>', 'Recipient meta-address (or use saved)')
    .option('-c, --chain <chain>', 'Target chain (auto-detected from meta-address)')
    .option('-i, --interactive', 'Interactive mode')
    .action(async (options) => {
      heading('Generate Stealth Address')

      let metaAddressStr = options.meta

      // Interactive mode
      if (options.interactive || !metaAddressStr) {
        const savedMeta = getConfig('metaAddress') as string | undefined

        const response = await prompts([
          {
            type: 'text',
            name: 'meta',
            message: 'Enter recipient meta-address:',
            initial: savedMeta || '',
            validate: (value) => value.startsWith('sip:') ? true : 'Must be a valid SIP meta-address (sip:...)',
          },
        ])

        if (!response.meta) {
          console.log(chalk.yellow('Cancelled.'))
          return
        }

        metaAddressStr = response.meta
      }

      const spinner = ora('Generating stealth address...').start()

      try {
        // Decode meta-address
        const metaAddress = decodeStealthMetaAddress(metaAddressStr)
        const chain = metaAddress.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)

        // Generate stealth address
        const result = useEd25519
          ? generateEd25519StealthAddress(metaAddress as StealthMetaAddress)
          : generateStealthAddress(metaAddress as StealthMetaAddress)

        const stealthPubKey = result.stealthAddress.address
        const ephemeralPubKey = result.stealthAddress.ephemeralPublicKey

        // Convert to chain-specific address format
        let chainAddress: string
        if (useEd25519) {
          if (chain === 'solana') {
            chainAddress = ed25519PublicKeyToSolanaAddress(stealthPubKey as `0x${string}`)
          } else if (chain === 'near') {
            chainAddress = ed25519PublicKeyToNearAddress(stealthPubKey as `0x${string}`)
          } else {
            chainAddress = stealthPubKey
          }
        } else {
          chainAddress = publicKeyToEthAddress(stealthPubKey as `0x${string}`)
        }

        spinner.succeed('Stealth address generated')
        console.log()

        keyValue('Chain', chain)
        keyValue('Curve', useEd25519 ? 'ed25519' : 'secp256k1')
        console.log()

        console.log(chalk.bold.green('  One-Time Address (send funds here):'))
        console.log(chalk.cyan(`  ${chainAddress}`))
        console.log()

        console.log(chalk.bold('  Ephemeral Public Key (publish for recipient):'))
        console.log(chalk.gray(`  ${ephemeralPubKey}`))
        console.log()

        warning('The ephemeral key must be published so the recipient can find and claim funds.')

      } catch (err) {
        spinner.fail('Failed to generate stealth address')
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })

  // Derive subcommand (for recipients to derive spending key)
  cmd
    .command('derive')
    .description('Derive spending key from stealth address')
    .requiredOption('-e, --ephemeral <key>', 'Ephemeral public key from sender')
    .requiredOption('-s, --spending-key <key>', 'Your spending private key')
    .requiredOption('-v, --viewing-key <key>', 'Your viewing private key')
    .option('-c, --chain <chain>', 'Chain (solana, ethereum, near)', 'solana')
    .action(async (options) => {
      heading('Derive Stealth Spending Key')

      warning('This feature is for advanced users.')
      info('Use your viewing key to scan for payments, then derive the spending key.')
      console.log()

      // This would require implementing deriveEd25519StealthAddress or similar
      console.log(chalk.yellow('  Not yet implemented in CLI.'))
      console.log(chalk.gray('  Use the SDK directly:'))
      console.log()
      console.log(chalk.white('    import { deriveEd25519StealthAddress } from "@sip-protocol/sdk"'))
      console.log()
    })

  return cmd
}

function info(message: string): void {
  console.log(chalk.blue('ℹ'), message)
}
