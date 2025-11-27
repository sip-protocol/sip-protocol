/**
 * Solver Module
 *
 * Provides solver implementations and utilities for SIP Protocol.
 */

export { MockSolver, createMockSolver } from './mock-solver'
export type { MockSolverConfig } from './mock-solver'

// Re-export solver types from types package
export type {
  Solver,
  SolverCapabilities,
  SolverVisibleIntent,
  SolverQuote,
  SIPSolver,
  FulfillmentStatus,
  FulfillmentRequest,
  FulfillmentCommitment,
  FulfillmentProof,
  SwapRoute,
  SwapRouteStep,
  SolverEvent,
  SolverEventListener,
} from '@sip-protocol/types'
