/**
 * Bitcoin Module
 *
 * Provides Bitcoin privacy features including:
 * - BIP-340 Schnorr signatures
 * - BIP-341 Taproot outputs
 * - BIP-352 Silent Payments
 */

export {
  // BIP-340 Schnorr signatures
  schnorrSign,
  schnorrVerify,
  schnorrSignHex,
  schnorrVerifyHex,
  // BIP-341 Taproot
  getXOnlyPublicKey,
  computeTweakedKey,
  createTaprootOutput,
  createKeySpendOnlyOutput,
  taprootAddress,
  decodeTaprootAddress,
  isValidTaprootAddress,
} from './taproot'

export type {
  TaprootOutput,
  TapScript,
  BitcoinNetwork,
} from './taproot'

export {
  // BIP-352 Silent Payments
  generateSilentPaymentAddress,
  parseSilentPaymentAddress,
  createSilentPaymentOutput,
  scanForPayments,
  deriveSpendingKey,
  isValidSilentPaymentAddress,
  hexToPrivateKey,
  hexToPublicKey,
} from './silent-payments'

export type {
  SilentPaymentAddress,
  ParsedSilentPaymentAddress,
  SenderInput,
  SilentPaymentOutput,
  OutputToScan,
  ReceivedPayment,
} from './silent-payments'
