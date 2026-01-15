import { Command } from 'commander'
import {
  generateStealthMetaAddress,
  generateEd25519StealthMetaAddress,
  isEd25519Chain,
  encodeStealthMetaAddress,
} from '@sip-protocol/sdk'
import type { ChainId, StealthMetaAddress, HexString } from '@sip-protocol/types'
import { success, keyValue, heading, warning } from '../utils/output'

/**
 * Result of generating a stealth meta-address
 */
interface StealthMetaAddressResult {
  metaAddress: StealthMetaAddress
  spendingPrivateKey: HexString
  viewingPrivateKey: HexString
}

export function createKeygenCommand(): Command {
  return new Command('keygen')
    .description('Generate stealth meta-address')
    .option('-c, --chain <chain>', 'Target chain (ethereum, solana, near)', 'ethereum')
    .option('--spending-key <key>', 'Spending private key (hex)')
    .option('--viewing-key <key>', 'Viewing private key (hex)')
    .action(async (options) => {
      try {
        heading('Generate Stealth Meta-Address')

        const chain = options.chain as ChainId
        const useEd25519 = isEd25519Chain(chain)

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

        keyValue('Spending Public Key', spendingPubKey)
        keyValue('Viewing Public Key', viewingPubKey)

        // Encode to SIP format
        const encoded = encodeStealthMetaAddress(result.metaAddress)
        keyValue('Encoded Address', encoded)

        console.log()
        warning('PRIVATE KEYS - Keep these secure!')
        keyValue('Spending Private Key', spendingPrivKey)
        keyValue('Viewing Private Key', viewingPrivKey)
      } catch (err) {
        console.error('Failed to generate keys:', err)
        process.exit(1)
      }
    })
}
