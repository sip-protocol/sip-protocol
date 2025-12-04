import { Command } from 'commander'
import { checkStealthAddress, checkEd25519StealthAddress, isEd25519Chain } from '@sip-protocol/sdk'
import type { ChainId } from '@sip-protocol/types'
import { success, keyValue, heading, info, warning, table } from '../utils/output'

export function createScanCommand(): Command {
  return new Command('scan')
    .description('Scan for stealth payments')
    .requiredOption('-c, --chain <chain>', 'Chain to scan (ethereum, solana, near)')
    .requiredOption('-s, --spending-key <key>', 'Your spending private key (hex)')
    .requiredOption('-v, --viewing-key <key>', 'Your viewing private key (hex)')
    .option('-a, --addresses <addresses...>', 'Specific addresses to check')
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
            let result: any

            if (useEd25519) {
              // Ed25519 chains (Solana, NEAR)
              result = checkEd25519StealthAddress(
                address,
                options.spendingKey,
                options.viewingKey
              )
            } else {
              // secp256k1 chains (EVM)
              result = checkStealthAddress(
                address,
                options.spendingKey,
                options.viewingKey
              )
            }

            results.push({
              address,
              isMine: result.isMine,
              privateKey: result.isMine ? result.stealthPrivateKey : undefined,
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
