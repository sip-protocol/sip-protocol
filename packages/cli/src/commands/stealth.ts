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
  deriveStealthPrivateKey,
  deriveEd25519StealthPrivateKey,
  solanaAddressToEd25519PublicKey,
} from '@sip-protocol/sdk'
import type { StealthAddress, HexString, ChainId, StealthMetaAddress } from '@sip-protocol/types'
import { getConfig } from '../utils/config'
import { warning, keyValue, heading } from '../utils/output'

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
    .description('Derive spending key from stealth address (to claim funds)')
    .requiredOption('-a, --stealth-address <address>', 'Stealth address where funds were sent')
    .requiredOption('-e, --ephemeral <key>', 'Ephemeral public key from sender announcement')
    .requiredOption('-s, --spending-key <key>', 'Your spending private key (hex)')
    .requiredOption('-v, --viewing-key <key>', 'Your viewing private key (hex)')
    .option('-c, --chain <chain>', 'Chain (solana, ethereum, near)', 'solana')
    .action(async (options) => {
      heading('Derive Stealth Spending Key')

      warning('This is for advanced users. Keep your derived private key secure!')
      console.log()

      const spinner = ora('Deriving stealth private key...').start()

      try {
        const chain = options.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)

        // Normalize keys to hex format
        const spendingKey = normalizeHexKey(options.spendingKey)
        const viewingKey = normalizeHexKey(options.viewingKey)
        const ephemeralKey = normalizeHexKey(options.ephemeral)

        // Convert stealth address to hex public key for SDK
        let stealthPubKeyHex: HexString
        if (useEd25519 && chain === 'solana') {
          stealthPubKeyHex = solanaAddressToEd25519PublicKey(options.stealthAddress)
        } else if (options.stealthAddress.startsWith('0x')) {
          stealthPubKeyHex = options.stealthAddress as HexString
        } else {
          throw new Error('Stealth address must be base58 (Solana) or hex (0x...)')
        }

        // Construct stealth address object
        const stealthAddressObj: StealthAddress = {
          address: stealthPubKeyHex,
          ephemeralPublicKey: ephemeralKey as HexString,
          viewTag: 0, // Not needed for derivation
        }

        // Derive the private key
        const recovery = useEd25519
          ? deriveEd25519StealthPrivateKey(
              stealthAddressObj,
              spendingKey as HexString,
              viewingKey as HexString
            )
          : deriveStealthPrivateKey(
              stealthAddressObj,
              spendingKey as HexString,
              viewingKey as HexString
            )

        spinner.succeed('Stealth private key derived')
        console.log()

        keyValue('Chain', chain)
        keyValue('Curve', useEd25519 ? 'ed25519' : 'secp256k1')
        console.log()

        console.log(chalk.bold.green('  Derived Private Key (use to claim funds):'))
        console.log(chalk.cyan(`  ${recovery.privateKey}`))
        console.log()

        console.log(chalk.bold('  Stealth Address:'))
        console.log(chalk.gray(`  ${recovery.stealthAddress}`))
        console.log()

        warning('Never share your private key! Use it to sign transactions claiming your funds.')
        console.log()

        info('Next steps:')
        console.log(chalk.gray('  1. Import this key into a wallet or use SDK to claim'))
        console.log(chalk.gray('  2. Transfer funds from stealth address to your main wallet'))
        console.log(chalk.gray('  3. Securely delete this private key after claiming'))
        console.log()

      } catch (err) {
        spinner.fail('Failed to derive stealth key')
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })

  return cmd
}

function info(message: string): void {
  console.log(chalk.blue('ℹ'), message)
}

/**
 * Normalize a hex key - ensure it has 0x prefix
 */
function normalizeHexKey(key: string): string {
  if (key.startsWith('0x')) {
    return key
  }
  return `0x${key}`
}
