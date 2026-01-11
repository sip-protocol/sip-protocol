import { Command } from 'commander'
import prompts from 'prompts'
import chalk from 'chalk'
import ora from 'ora'
import {
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  encodeStealthMetaAddress,
  isEd25519Chain,
} from '@sip-protocol/sdk'
import type { ChainId } from '@sip-protocol/types'
import { PrivacyLevel } from '@sip-protocol/types'
import { setConfig, getConfig, getConfigPath } from '../utils/config'
import { success, info, heading, keyValue, warning, divider } from '../utils/output'

const CHAINS = [
  { title: 'Solana', value: 'solana', description: 'Fast, low-cost transactions' },
  { title: 'Ethereum', value: 'ethereum', description: 'EVM mainnet' },
  { title: 'NEAR', value: 'near', description: 'Sharded, scalable' },
  { title: 'Arbitrum', value: 'arbitrum', description: 'Ethereum L2' },
  { title: 'Base', value: 'base', description: 'Coinbase L2' },
]

const PRIVACY_LEVELS = [
  {
    title: 'Transparent',
    value: PrivacyLevel.TRANSPARENT,
    description: 'No privacy (like standard transactions)',
  },
  {
    title: 'Shielded',
    value: PrivacyLevel.SHIELDED,
    description: 'Full privacy - hidden sender, amount, recipient',
  },
  {
    title: 'Compliant',
    value: PrivacyLevel.COMPLIANT,
    description: 'Privacy with viewing keys for auditors',
  },
]

export function createSetupCommand(): Command {
  return new Command('setup')
    .description('Interactive setup wizard for SIP Protocol')
    .option('--quick', 'Quick setup with defaults')
    .action(async (options) => {
      console.clear()
      console.log()
      console.log(chalk.bold.magenta('  ╔═══════════════════════════════════════════╗'))
      console.log(chalk.bold.magenta('  ║                                           ║'))
      console.log(chalk.bold.magenta('  ║') + chalk.bold.white('   🛡️  SIP Protocol Setup Wizard  🛡️   ') + chalk.bold.magenta('║'))
      console.log(chalk.bold.magenta('  ║                                           ║'))
      console.log(chalk.bold.magenta('  ╚═══════════════════════════════════════════╝'))
      console.log()
      console.log(chalk.gray('  Privacy layer for cross-chain transactions'))
      console.log()

      if (options.quick) {
        await quickSetup()
        return
      }

      // Step 1: Welcome and network selection
      console.log(chalk.cyan.bold('  Step 1 of 4: ') + chalk.white('Network Configuration'))
      console.log()

      const networkResponse = await prompts([
        {
          type: 'select',
          name: 'network',
          message: 'Which network do you want to use?',
          choices: [
            { title: 'Testnet / Devnet', value: 'testnet', description: 'For development and testing' },
            { title: 'Mainnet', value: 'mainnet', description: 'Production network' },
          ],
          initial: 0,
        },
      ])

      if (!networkResponse.network) {
        console.log(chalk.yellow('\n  Setup cancelled.'))
        return
      }

      // Step 2: Primary chain selection
      console.log()
      console.log(chalk.cyan.bold('  Step 2 of 4: ') + chalk.white('Primary Chain'))
      console.log()

      const chainResponse = await prompts([
        {
          type: 'select',
          name: 'chain',
          message: 'Which chain will you use primarily?',
          choices: CHAINS,
          initial: 0,
        },
      ])

      if (!chainResponse.chain) {
        console.log(chalk.yellow('\n  Setup cancelled.'))
        return
      }

      // Step 3: Privacy level
      console.log()
      console.log(chalk.cyan.bold('  Step 3 of 4: ') + chalk.white('Default Privacy Level'))
      console.log()

      const privacyResponse = await prompts([
        {
          type: 'select',
          name: 'privacy',
          message: 'What privacy level do you want by default?',
          choices: PRIVACY_LEVELS,
          initial: 1, // Default to shielded
        },
      ])

      if (!privacyResponse.privacy) {
        console.log(chalk.yellow('\n  Setup cancelled.'))
        return
      }

      // Step 4: Generate keys
      console.log()
      console.log(chalk.cyan.bold('  Step 4 of 4: ') + chalk.white('Key Generation'))
      console.log()

      const keyResponse = await prompts([
        {
          type: 'confirm',
          name: 'generateKeys',
          message: 'Generate stealth meta-address now?',
          initial: true,
        },
      ])

      // Save configuration
      const spinner = ora('Saving configuration...').start()

      try {
        setConfig('network', networkResponse.network)
        setConfig('primaryChain', chainResponse.chain)
        setConfig('defaultPrivacy', privacyResponse.privacy)

        spinner.succeed('Configuration saved')
      } catch (err) {
        spinner.fail('Failed to save configuration')
        console.error(err)
        process.exit(1)
      }

      // Generate keys if requested
      if (keyResponse.generateKeys) {
        console.log()
        const keySpinner = ora('Generating stealth meta-address...').start()

        try {
          const chain = chainResponse.chain as ChainId
          const useEd25519 = isEd25519Chain(chain)

          const metaAddress = useEd25519
            ? generateEd25519StealthMetaAddress(chain)
            : generateStealthMetaAddress(chain)

          keySpinner.succeed('Keys generated')
          console.log()

          // Display keys
          console.log(chalk.bold.green('  ✓ Stealth Meta-Address Generated'))
          console.log()
          console.log(chalk.gray('  ┌─────────────────────────────────────────────────┐'))
          console.log(chalk.gray('  │ ') + chalk.cyan('Chain:           ') + chalk.white(chain.padEnd(30)) + chalk.gray(' │'))
          console.log(chalk.gray('  │ ') + chalk.cyan('Curve:           ') + chalk.white((useEd25519 ? 'ed25519' : 'secp256k1').padEnd(30)) + chalk.gray(' │'))
          console.log(chalk.gray('  └─────────────────────────────────────────────────┘'))
          console.log()

          const encoded = encodeStealthMetaAddress(metaAddress.metaAddress)
          console.log(chalk.bold('  Encoded Meta-Address (share this):'))
          console.log(chalk.green(`  ${encoded}`))
          console.log()

          console.log(chalk.bold.yellow('  ⚠️  PRIVATE KEYS - Store securely!'))
          console.log()
          console.log(chalk.gray('  Spending Key: ') + chalk.dim(metaAddress.spendingPrivateKey))
          console.log(chalk.gray('  Viewing Key:  ') + chalk.dim(metaAddress.viewingPrivateKey))
          console.log()

          // Save keys to config
          setConfig('metaAddress', encoded)

        } catch (err) {
          keySpinner.fail('Failed to generate keys')
          console.error(err instanceof Error ? err.message : err)
        }
      }

      // Summary
      console.log()
      divider()
      console.log()
      console.log(chalk.bold.green('  🎉 Setup Complete!'))
      console.log()
      console.log(chalk.gray('  Configuration:'))
      console.log(chalk.gray('  ├─ Network:  ') + chalk.white(networkResponse.network))
      console.log(chalk.gray('  ├─ Chain:    ') + chalk.white(chainResponse.chain))
      console.log(chalk.gray('  ├─ Privacy:  ') + chalk.white(privacyResponse.privacy))
      console.log(chalk.gray('  └─ Config:   ') + chalk.dim(getConfigPath()))
      console.log()
      console.log(chalk.cyan('  Next steps:'))
      console.log(chalk.gray('  1. ') + chalk.white('sip keygen') + chalk.gray(' - Generate more stealth addresses'))
      console.log(chalk.gray('  2. ') + chalk.white('sip quote') + chalk.gray('  - Get a swap quote'))
      console.log(chalk.gray('  3. ') + chalk.white('sip scan') + chalk.gray('   - Scan for incoming payments'))
      console.log()
    })
}

async function quickSetup() {
  const spinner = ora('Quick setup with defaults...').start()

  try {
    // Set defaults
    setConfig('network', 'testnet')
    setConfig('primaryChain', 'solana')
    setConfig('defaultPrivacy', PrivacyLevel.SHIELDED)

    // Generate Solana keys
    const metaAddress = generateEd25519StealthMetaAddress('solana')
    const encoded = encodeStealthMetaAddress(metaAddress.metaAddress)
    setConfig('metaAddress', encoded)

    spinner.succeed('Quick setup complete')
    console.log()
    console.log(chalk.green('  ✓ Network: testnet'))
    console.log(chalk.green('  ✓ Chain: solana'))
    console.log(chalk.green('  ✓ Privacy: shielded'))
    console.log(chalk.green('  ✓ Keys generated'))
    console.log()
    console.log(chalk.bold('  Meta-Address:'))
    console.log(chalk.cyan(`  ${encoded}`))
    console.log()
    console.log(chalk.yellow('  ⚠️  Run ') + chalk.white('sip setup') + chalk.yellow(' for full interactive setup'))
    console.log()
  } catch (err) {
    spinner.fail('Quick setup failed')
    console.error(err)
    process.exit(1)
  }
}
