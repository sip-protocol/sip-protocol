/**
 * Privacy Advisor Module
 *
 * LangChain-powered AI agent for intelligent privacy recommendations.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { PrivacyAdvisorAgent, createPrivacyAdvisorTools } from '@sip-protocol/sdk'
 *
 * // Create advisor (simple chat mode)
 * const advisor = new PrivacyAdvisorAgent({
 *   openaiApiKey: process.env.OPENAI_API_KEY!,
 * })
 *
 * // Or use tools for a full agent
 * const tools = createPrivacyAdvisorTools({
 *   heliusApiKey: process.env.HELIUS_API_KEY!,
 * })
 * ```
 */

// Main agent
export { PrivacyAdvisorAgent, createPrivacyAdvisor } from './advisor'

// LangChain tools (for building custom agents)
export {
  createPrivacyAdvisorTools,
  createAnalyzeWalletTool,
  createQuickScoreTool,
  createSIPComparisonTool,
  createExplainTool,
} from './tools'

export type { ToolsConfig } from './tools'

// Types
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
