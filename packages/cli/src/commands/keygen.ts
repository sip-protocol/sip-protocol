import { Command } from 'commander'
import {
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  isEd25519Chain,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'
import type { ChainId, StealthMetaAddress, HexString } from '@sip-protocol/types'
import { success, keyValue, heading, warning, info } from '../utils/output'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Result of generating a stealth meta-address
 */
interface StealthMetaAddressResult {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
}

/**
 * Output format type
 */
type OutputFormat = 'json' | 'text'

/**
 * Keygen export data structure
 */
interface KeygenExportData {
  chain: string
  spendingPublicKey: string
  viewingPublicKey: string
  spendingPrivateKey: string
  viewingPrivateKey: string
  metaAddress: string
  generatedAt: string
}

/**
 * Format keys as text for file export
 */
function formatKeysAsText(data: KeygenExportData): string {
  return [
    `# SIP Stealth Meta-Address Keys`,
    `# Generated: ${data.generatedAt}`,
    `# Chain: ${data.chain}`,
    ``,
    `## Public Keys (safe to share)`,
    `SPENDING_PUBLIC_KEY=${data.spendingPublicKey}`,
    `VIEWING_PUBLIC_KEY=${data.viewingPublicKey}`,
    `META_ADDRESS=${data.metaAddress}`,
    ``,
    `## Private Keys (KEEP SECRET!)`,
    `SPENDING_PRIVATE_KEY=${data.spendingPrivateKey}`,
    `VIEWING_PRIVATE_KEY=${data.viewingPrivateKey}`,
    ``,
    `# WARNING: Delete this file after securely storing the keys!`,
  ].join('\n')
}

export function createKeygenCommand(): Command {
  return new Command('keygen')
    .description('Generate stealth meta-address')
    .option('-c, --chain <chain>', 'Target chain (ethereum, solana, near)', 'ethereum')
    .option('--spending-key <key>', 'Spending private key (hex)')
    .option('--viewing-key <key>', 'Viewing private key (hex)')
    .option('-o, --output-file <path>', 'Output file for keys (enables secure export)')
    .option('-f, --format <format>', 'Output format: json or text', 'json')
    .action(async (options) => {
      try {
        heading('Generate Stealth Meta-Address')

        const chain = options.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)
        const format = (options.format || 'json') as OutputFormat

        let result: StealthMetaAddressResult

        if (useEd25519) {
          // Generate ed25519 meta-address (Solana, NEAR)
          if (options.spendingKey || options.viewingKey) {
            warning('Ed25519 chains do not support custom keys in CLI yet')
          }
          result = generateEd25519StealthMetaAddress(chain)
        } else {
          // Generate secp256k1 meta-address (EVM chains)
          result = generateStealthMetaAddress(chain)
        }

        success('Stealth meta-address generated')
        keyValue('Chain', chain)

        // Both functions return the same structure
        const spendingPubKey = result.metaAddress.spendingKey
        const viewingPubKey = result.metaAddress.viewingKey
        const spendingPrivKey = result.spendingPrivateKey
        const viewingPrivKey = result.viewingPrivateKey

        // Encode to SIP format
        const encoded = encodeStealthMetaAddress(result.metaAddress)

        // Always show public information in terminal
        keyValue('Spending Public Key', spendingPubKey)
        keyValue('Viewing Public Key', viewingPubKey)
        keyValue('Encoded Address', encoded)

        console.log()

        if (options.outputFile) {
          // Export keys to file with secure permissions
          const outputPath = path.resolve(options.outputFile)

          // Ensure parent directory exists
          const dir = path.dirname(outputPath)
          if (dir !== '.' && dir !== '/') {
            fs.mkdirSync(dir, { recursive: true })
          }

          const exportData: KeygenExportData = {
            chain,
            spendingPublicKey: spendingPubKey,
            viewingPublicKey: viewingPubKey,
            spendingPrivateKey: spendingPrivKey,
            viewingPrivateKey: viewingPrivKey,
            metaAddress: encoded,
            generatedAt: new Date().toISOString(),
          }

          const content = format === 'json'
            ? JSON.stringify(exportData, null, 2)
            : formatKeysAsText(exportData)

          // Write with restricted permissions (owner read/write only)
          fs.writeFileSync(outputPath, content, {
            mode: 0o600,
            encoding: 'utf-8',
          })

          success(`Keys exported to: ${outputPath}`)
          warning('SECURITY: File permissions set to 600 (owner only)')
          warning('SECURITY: Delete this file after securely storing the keys!')
          info('Private keys NOT displayed in terminal for security')
        } else {
          // Interactive mode - show private keys in terminal (legacy behavior)
          warning('PRIVATE KEYS - Keep these secure!')
          keyValue('Spending Private Key', spendingPrivKey)
          keyValue('Viewing Private Key', viewingPrivKey)
          console.log()
          info('TIP: Use --output-file for secure key export:')
          info('  sip keygen --chain solana --output-file ./keys.json')
        }
      } catch (err) {
        console.error('Failed to generate keys:', err)
        process.exit(1)
      }
    })
}
