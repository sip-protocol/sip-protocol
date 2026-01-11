import { Command } from 'commander'
import prompts from 'prompts'
import chalk from 'chalk'
import ora from 'ora'
import { generateViewingKey } from '@sip-protocol/sdk'
import { getConfig, setConfig } from '../utils/config'
import { success, keyValue, heading, warning } from '../utils/output'

export function createViewingKeyCommand(): Command {
  const cmd = new Command('viewing-key')
    .alias('vk')
    .description('Manage viewing keys for selective disclosure')

  // Generate subcommand
  cmd
    .command('generate')
    .alias('gen')
    .description('Generate a new viewing key')
    .option('-p, --path <path>', 'Key derivation path (e.g., "payments/2024")')
    .option('-i, --interactive', 'Interactive mode')
    .action(async (options) => {
      heading('Generate Viewing Key')

      let path = options.path

      // Interactive mode
      if (options.interactive || !path) {
        const response = await prompts([
          {
            type: 'text',
            name: 'path',
            message: 'Enter a label or path for this viewing key:',
            initial: `audit/${Date.now()}`,
            validate: (value) => value.length > 0 ? true : 'Path is required',
          },
          {
            type: 'text',
            name: 'description',
            message: 'Description (optional):',
          },
        ])

        if (!response.path) {
          console.log(chalk.yellow('Cancelled.'))
          return
        }

        path = response.path
      }

      const spinner = ora('Generating viewing key...').start()

      try {
        const viewingKey = generateViewingKey(path)

        spinner.succeed('Viewing key generated')
        console.log()

        keyValue('Path', viewingKey.path)
        keyValue('Hash', viewingKey.hash)
        console.log()

        console.log(chalk.bold.green('  Viewing Key (share with auditors):'))
        console.log(chalk.cyan(`  ${viewingKey.key}`))
        console.log()

        console.log(chalk.bold('  Key Hash (for verification):'))
        console.log(chalk.gray(`  ${viewingKey.hash}`))
        console.log()

        warning('Share the viewing key with authorized parties only.')
        console.log(chalk.gray('  They can view transactions but cannot spend funds.'))
        console.log()

        // Offer to save
        const saveResponse = await prompts([
          {
            type: 'confirm',
            name: 'save',
            message: 'Save this viewing key to config?',
            initial: false,
          },
        ])

        if (saveResponse.save) {
          const existingKeys = (getConfig('viewingKeys') as Record<string, string>) || {}
          existingKeys[path] = viewingKey.key
          setConfig('viewingKeys', existingKeys)
          success('Viewing key saved to config')
        }

      } catch (err) {
        spinner.fail('Failed to generate viewing key')
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
      }
    })

  // List subcommand
  cmd
    .command('list')
    .alias('ls')
    .description('List saved viewing keys')
    .action(async () => {
      heading('Saved Viewing Keys')

      const keys = (getConfig('viewingKeys') as Record<string, string>) || {}
      const entries = Object.entries(keys)

      if (entries.length === 0) {
        console.log(chalk.gray('  No viewing keys saved.'))
        console.log(chalk.gray('  Run: sip viewing-key generate -i'))
        console.log()
        return
      }

      console.log()
      entries.forEach(([path, key]) => {
        console.log(chalk.cyan(`  ${path}`))
        console.log(chalk.gray(`    ${key.slice(0, 20)}...${key.slice(-10)}`))
        console.log()
      })
    })

  // Share subcommand
  cmd
    .command('share')
    .description('Create a shareable viewing key disclosure')
    .option('-p, --path <path>', 'Viewing key path to share')
    .option('-e, --expires <date>', 'Expiration date (ISO format)')
    .option('-s, --scope <scope>', 'Scope of disclosure (all, treasury, payments)')
    .action(async (options) => {
      heading('Create Viewing Key Disclosure')

      const keys = (getConfig('viewingKeys') as Record<string, string>) || {}
      const entries = Object.entries(keys)

      if (entries.length === 0) {
        console.log(chalk.yellow('  No viewing keys saved.'))
        console.log(chalk.gray('  Run: sip viewing-key generate -i first'))
        console.log()
        return
      }

      const response = await prompts([
        {
          type: 'select',
          name: 'path',
          message: 'Select viewing key to share:',
          choices: entries.map(([path]) => ({ title: path, value: path })),
        },
        {
          type: 'select',
          name: 'scope',
          message: 'Disclosure scope:',
          choices: [
            { title: 'All transactions', value: 'all' },
            { title: 'Treasury only', value: 'treasury' },
            { title: 'Payments only', value: 'payments' },
            { title: 'Custom time range', value: 'custom' },
          ],
        },
        {
          type: 'text',
          name: 'recipient',
          message: 'Recipient (auditor, regulator, etc.):',
        },
      ])

      if (!response.path) {
        console.log(chalk.yellow('Cancelled.'))
        return
      }

      const key = keys[response.path]

      console.log()
      console.log(chalk.bold.green('  📋 Viewing Key Disclosure'))
      console.log()
      console.log(chalk.gray('  ┌─────────────────────────────────────────────────┐'))
      console.log(chalk.gray('  │ ') + chalk.cyan('Path:      ') + chalk.white(response.path.padEnd(36)) + chalk.gray(' │'))
      console.log(chalk.gray('  │ ') + chalk.cyan('Scope:     ') + chalk.white(response.scope.padEnd(36)) + chalk.gray(' │'))
      console.log(chalk.gray('  │ ') + chalk.cyan('Recipient: ') + chalk.white((response.recipient || 'Not specified').padEnd(36)) + chalk.gray(' │'))
      console.log(chalk.gray('  └─────────────────────────────────────────────────┘'))
      console.log()
      console.log(chalk.bold('  Viewing Key:'))
      console.log(chalk.cyan(`  ${key}`))
      console.log()
      console.log(chalk.gray('  The recipient can use this key to view transactions'))
      console.log(chalk.gray('  matching the specified scope, but cannot spend funds.'))
      console.log()
    })

  return cmd
}
