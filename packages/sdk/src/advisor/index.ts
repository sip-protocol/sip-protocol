/**
 * Privacy Advisor Module
 *
 * LangChain-powered AI agent for intelligent privacy recommendations.
 *
 * @packageDocumentation
 */

export { PrivacyAdvisorAgent, createPrivacyAdvisor } from './advisor'

export type {
  // Core types
  AdvisorRole,
  AdvisorMessage,
  AdvisorStatus,
  // Configuration
  PrivacyAdvisorConfig,
  AdvisoryContext,
  // Response types
  AdvisorResponse,
  PrivacyAdvisoryReport,
  AdvisorRecommendation,
  // Utilities
  ToolResult,
  StreamCallback,
} from './types'
