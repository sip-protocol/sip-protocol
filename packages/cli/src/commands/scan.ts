import { Command } from 'commander'
import {
  checkStealthAddress,
  checkEd25519StealthAddress,
  deriveStealthPrivateKey,
  deriveEd25519StealthPrivateKey,
  isEd25519Chain,
} from '@sip-protocol/sdk'
import type { ChainId, StealthAddress, HexString } from '@sip-protocol/types'
import { success, heading, info, warning, table } from '../utils/output'

/**
 * Result of scanning a stealth address
 */
interface ScanResult {
  address: string
  isMine: boolean
  privateKey?: string
}

/**
 * Input format for stealth address data
 * Format: "address:ephemeralPublicKey:viewTag"
 */
interface ParsedStealthData {
  address: HexString
  ephemeralPublicKey: HexString
  viewTag: number
}

/**
 * Parse stealth address data from CLI input
 * Expected format: "address:ephemeralPublicKey:viewTag"
 */
function parseStealthData(input: string): ParsedStealthData {
  const parts = input.split(':')
  if (parts.length !== 3) {
    throw new Error(
      `Invalid stealth data format. Expected "address:ephemeralPublicKey:viewTag", got "${input}"`
    )
  }

  const [address, ephemeralPublicKey, viewTagStr] = parts
  const viewTag = parseInt(viewTagStr, 10)

  if (isNaN(viewTag) || viewTag < 0 || viewTag > 255) {
    throw new Error(`Invalid viewTag: ${viewTagStr}. Must be a number between 0-255`)
  }

  return {
    address: address as HexString,
    ephemeralPublicKey: ephemeralPublicKey as HexString,
    viewTag,
  }
}

export function createScanCommand(): Command {
  return new Command('scan')
    .description('Scan for stealth payments')
    .requiredOption('-c, --chain <chain>', 'Chain to scan (ethereum, solana, near)')
    .requiredOption('-s, --spending-key <key>', 'Your spending private key (hex)')
    .requiredOption('-v, --viewing-key <key>', 'Your viewing private key (hex)')
    .option('-a, --addresses <addresses...>', 'Stealth data to check (format: address:ephemeralKey:viewTag)')
    .action(async (options) => {
      try {
        heading('Scan for Stealth Payments')

        const chain = options.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)

        info(`Scanning ${chain} for stealth payments...`)
        info(`Using ${useEd25519 ? 'ed25519' : 'secp256k1'} curve`)

        if (!options.addresses || options.addresses.length === 0) {
          console.error('No addresses provided. Specify addresses with -a flag.')
          console.error('Format: address:ephemeralPublicKey:viewTag')
          console.error('Example: sip scan -c ethereum -s 0x... -v 0x... -a 0xaddr:0xephemeral:42')
          process.exit(1)
        }

        const results: ScanResult[] = []

        // Check each stealth address
        for (const input of options.addresses) {
          try {
            const stealthData = parseStealthData(input)
            const stealthAddress: StealthAddress = {
              address: stealthData.address,
              ephemeralPublicKey: stealthData.ephemeralPublicKey,
              viewTag: stealthData.viewTag,
            }

            let isMine: boolean
            let privateKey: string | undefined

            if (useEd25519) {
              // Ed25519 chains (Solana, NEAR)
              isMine = checkEd25519StealthAddress(
                stealthAddress,
                options.spendingKey as HexString,
                options.viewingKey as HexString
              )
              if (isMine) {
                const recovery = deriveEd25519StealthPrivateKey(
                  stealthAddress,
                  options.spendingKey as HexString,
                  options.viewingKey as HexString
                )
                privateKey = recovery.privateKey
              }
            } else {
              // secp256k1 chains (EVM)
              isMine = checkStealthAddress(
                stealthAddress,
                options.spendingKey as HexString,
                options.viewingKey as HexString
              )
              if (isMine) {
                const recovery = deriveStealthPrivateKey(
                  stealthAddress,
                  options.spendingKey as HexString,
                  options.viewingKey as HexString
                )
                privateKey = recovery.privateKey
              }
            }

            results.push({
              address: stealthData.address,
              isMine,
              privateKey,
            })
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            console.error(`Error processing ${input}: ${errorMessage}`)
            results.push({
              address: input,
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
          const headers = ['Address', 'Match', 'Private Key']
          const rows = results
            .filter(r => r.isMine)
            .map(r => [
              r.address.slice(0, 10) + '...',
              'Yes',
              r.privateKey ? r.privateKey.slice(0, 10) + '...' : 'N/A',
            ])

          table(headers, rows)

          console.log()
          warning('Store the private keys securely to access these funds')
        } else {
          info('No stealth payments found')
        }
      } catch (err) {
        console.error('Failed to scan:', err)
        process.exit(1)
      }
    })
}
