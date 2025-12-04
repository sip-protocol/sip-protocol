import { Command } from 'commander'
import { PrivacyLevel } from '@sip-protocol/types'
import { setConfig, getConfigPath, resetConfig } from '../utils/config'
import { success, info, heading } from '../utils/output'

export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize SIP configuration')
    .option('-n, --network <network>', 'Network (mainnet|testnet)', 'testnet')
    .option('-p, --privacy <level>', 'Default privacy level', 'transparent')
    .option('--reset', 'Reset configuration to defaults')
    .action(async (options) => {
      try {
        heading('Initialize SIP Protocol')

        if (options.reset) {
          resetConfig()
          success('Configuration reset to defaults')
        }

        // Validate privacy level
        const privacy = options.privacy as PrivacyLevel
        if (!Object.values(PrivacyLevel).includes(privacy)) {
          throw new Error(`Invalid privacy level: ${privacy}`)
        }

        // Set configuration
        setConfig('network', options.network)
        setConfig('defaultPrivacy', privacy)

        success('SIP initialized successfully')
        info(`Network: ${options.network}`)
        info(`Default Privacy: ${privacy}`)
        info(`Config file: ${getConfigPath()}`)
      } catch (err) {
        console.error('Failed to initialize:', err)
        process.exit(1)
      }
    })
}
