import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import { ed25519 } from '@noble/curves/ed25519'
import { utf8ToBytes } from '@noble/hashes/utils'

export interface Signer {
  signMessage(message: Uint8Array): Promise<Uint8Array>
}

export interface DerivedStealthKeys {
  spending: Uint8Array         // 32-byte ed25519 pubkey
  viewing: Uint8Array          // 32-byte ed25519 pubkey
  spendingPrivate: Uint8Array  // 32-byte seed (keep secret)
  viewingPrivate: Uint8Array   // 32-byte seed (keep secret)
}

export function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/\.$/, '')
}

export function deriveSeed(
  signature: Uint8Array,
  info: 'spending' | 'viewing',
): Uint8Array {
  // HKDF-SHA256(ikm=signature, salt=undefined, info=<utf8>, length=32)
  return hkdf(sha256, signature, undefined, info, 32)
}

export async function deriveStealthKeys(
  wallet: Signer,
  domain: string,
): Promise<DerivedStealthKeys> {
  const normalized = normalizeDomain(domain)
  const message = utf8ToBytes(`sip-stealth-v1:${normalized}`)
  const signature = await wallet.signMessage(message)

  const spendingPrivate = deriveSeed(signature, 'spending')
  const viewingPrivate = deriveSeed(signature, 'viewing')

  return {
    spending: ed25519.getPublicKey(spendingPrivate),
    viewing: ed25519.getPublicKey(viewingPrivate),
    spendingPrivate,
    viewingPrivate,
  }
}
