/**
 * Executors Module
 *
 * Transaction execution strategies for different scenarios.
 *
 * @packageDocumentation
 */

export {
  SolanaSameChainExecutor,
  createSameChainExecutor,
  isSameChainSupported,
  getSupportedSameChainChains,
  type SameChainExecutor,
  type SameChainTransferParams,
  type SameChainTransferResult,
  type SolanaSameChainConfig,
} from './same-chain'
