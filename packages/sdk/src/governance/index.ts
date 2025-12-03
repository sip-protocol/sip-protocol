/**
 * Governance module for SIP Protocol
 *
 * Provides private voting functionality for DAO governance
 */

export {
  PrivateVoting,
  createPrivateVoting,
} from './private-vote'

export type {
  EncryptedVote,
  RevealedVote,
  CastVoteParams,
  EncryptedTally,
  TallyResult,
  DecryptionShare,
} from './private-vote'
