import { Command } from 'commander'
import {
  checkStealthAddress,
  checkEd25519StealthAddress,
  deriveStealthPrivateKey,
  deriveEd25519StealthPrivateKey,
  isEd25519Chain,
  parseStealthAddress
} from '@sip-protocol/sdk'
import type { ChainId, HexString } from '@sip-protocol/types'
import { success, heading, info, warning, table } from '../utils/output'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Result from checking a stealth address
 */
interface StealthCheckResult {
  isMine: boolean
  stealthPrivateKey?: HexString
}

/**
 * Output format type
 */
type OutputFormat = 'json' | 'text'

/**
 * Format scan results as text for file export
 */
function formatScanResultsAsText(
  results: Array<{ address: string; privateKey?: string; chain: string }>,
  exportedAt: string
): string {
  const lines = [
    `# SIP Scan Results`,
    `# Exported: ${exportedAt}`,
    `# Found: ${results.length} stealth payment(s)`,
    ``,
  ]

  for (const r of results) {
    lines.push(`## Address: ${r.address}`)
    lines.push(`CHAIN=${r.chain}`)
    if (r.privateKey) {
      lines.push(`PRIVATE_KEY=${r.privateKey}`)
    }
    lines.push(``)
  }

  lines.push(`# WARNING: Delete this file after importing keys to your wallet!`)
  return lines.join('\n')
}

export function createScanCommand(): Command {
  return new Command('scan')
    .description('Scan for stealth payments')
    .requiredOption('-c, --chain <chain>', 'Chain to scan (ethereum, solana, near)')
    .requiredOption('-s, --spending-key <key>', 'Your spending private key (hex)')
    .requiredOption('-v, --viewing-key <key>', 'Your viewing private key (hex)')
    .option('-a, --addresses <addresses...>', 'Specific addresses to check')
    .option('-o, --output-file <path>', 'Output file for private keys (required to export keys)')
    .option('-f, --format <format>', 'Output format: json or text', 'json')
    .action(async (options) => {
      try {
        heading('Scan for Stealth Payments')

        const chain = options.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)

        info(`Scanning ${chain} for stealth payments...`)
        info(`Using ${useEd25519 ? 'ed25519' : 'secp256k1'} curve`)

        if (!options.addresses || options.addresses.length === 0) {
          console.error('No addresses provided. Specify addresses with -a flag.')
          console.error('Example: sip scan -c ethereum -s 0x... -v 0x... -a 0xabc... 0xdef...')
          process.exit(1)
        }

        const results: Array<{
          address: string
          isMine: boolean
          privateKey?: string
        }> = []

        // Check each address
        for (const address of options.addresses) {
          try {
            // Parse the stealth address (must include ephemeral public key)
            const stealthAddr = parseStealthAddress(address)
            let result: StealthCheckResult

            if (useEd25519) {
              // Ed25519 chains (Solana, NEAR)
              const isMine = checkEd25519StealthAddress(
                stealthAddr,
                options.spendingKey,
                options.viewingKey
              )

              if (isMine) {
                const derivedKey = deriveEd25519StealthPrivateKey(
                  stealthAddr,
                  options.spendingKey,
                  options.viewingKey
                )
                result = { isMine: true, stealthPrivateKey: derivedKey.privateKey }
              } else {
                result = { isMine: false }
              }
            } else {
              // secp256k1 chains (EVM)
              const isMine = checkStealthAddress(
                stealthAddr,
                options.spendingKey,
                options.viewingKey
              )

              if (isMine) {
                const derivedKey = deriveStealthPrivateKey(
                  stealthAddr,
                  options.spendingKey,
                  options.viewingKey
                )
                result = { isMine: true, stealthPrivateKey: derivedKey.privateKey }
              } else {
                result = { isMine: false }
              }
            }

            results.push({
              address,
              isMine: result.isMine,
              privateKey: result.stealthPrivateKey,
            })
          } catch (err) {
            results.push({
              address,
              isMine: false,
            })
          }
        }

        // Display results
        console.log()
        const foundCount = results.filter(r => r.isMine).length
        success(`Scanned ${results.length} address(es), found ${foundCount} stealth payment(s)`)

        if (foundCount > 0) {
          console.log()
          // SECURITY: Never display private keys in terminal output
          const headers = ['Address', 'Match']
          const rows = results
            .filter(r => r.isMine)
            .map(r => [
              r.address.slice(0, 16) + '...' + r.address.slice(-8),
              'Yes',
            ])

          table(headers, rows)

          console.log()

          // Only export keys to file with secure permissions
          if (options.outputFile) {
            const outputPath = path.resolve(options.outputFile)
            const format = (options.format || 'json') as OutputFormat
            const exportedAt = new Date().toISOString()
            const exportData = results
              .filter(r => r.isMine)
              .map(r => ({
                address: r.address,
                privateKey: r.privateKey,
                chain: options.chain,
              }))

            const content = format === 'json'
              ? JSON.stringify(exportData.map(d => ({ ...d, exportedAt })), null, 2)
              : formatScanResultsAsText(exportData, exportedAt)

            // Write with restricted permissions (owner read/write only)
            fs.writeFileSync(outputPath, content, {
              mode: 0o600,
              encoding: 'utf-8',
            })

            success(`Private keys exported to: ${outputPath}`)
            warning('SECURITY: Delete this file after importing keys to your wallet!')
            warning('SECURITY: File permissions set to 600 (owner only)')
          } else {
            info('Private keys not exported (use --output-file to export securely)')
            warning('Keys are NOT displayed in terminal for security reasons')
          }
        } else {
          info('No stealth payments found')
        }
      } catch (err) {
        console.error('Failed to scan:', err)
        process.exit(1)
      }
    })
}
