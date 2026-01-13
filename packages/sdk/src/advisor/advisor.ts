/**
 * Privacy Advisor Agent
 *
 * LangChain-powered AI agent that analyzes wallet privacy and provides
 * intelligent, contextual recommendations in plain English.
 *
 * @packageDocumentation
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'

import type {
  PrivacyAdvisorConfig,
  AdvisoryContext,
  AdvisorResponse,
  PrivacyAdvisoryReport,
  AdvisorRecommendation,
  AdvisorMessage,
  StreamCallback,
} from './types'
import type { FullAnalysisResult, RiskLevel } from '../surveillance/types'

/**
 * System prompt for the Privacy Advisor Agent
 */
const SYSTEM_PROMPT = `You are a Privacy Advisor for SIP Protocol, the privacy standard for Web3. Your role is to help users understand their wallet's privacy exposure and provide actionable recommendations.

## Your Principles:
1. **Clarity**: Explain complex privacy concepts in plain English
2. **Actionability**: Every recommendation should have clear, step-by-step actions
3. **Prioritization**: Focus on highest-impact improvements first
4. **Education**: Help users understand WHY something matters, not just WHAT to do
5. **Honesty**: Be direct about risks without causing unnecessary alarm

## Privacy Score Categories (100 points total):
- Address Reuse (0-25 points): Reusing addresses links your transactions
- Cluster Exposure (0-25 points): Common-input heuristic can link your wallets
- Exchange Exposure (0-20 points): CEX interactions create KYC-linked records
- Temporal Patterns (0-15 points): Regular timing reveals timezone/habits
- Social Links (0-15 points): ENS/SNS domains link identity to wallet

## Risk Levels:
- Critical (0-25): Severe privacy exposure, immediate action needed
- High (26-50): Significant risks, prioritize improvements
- Medium (51-75): Moderate exposure, room for improvement
- Low (76-100): Good privacy hygiene, maintain practices

## SIP Protocol Benefits:
- Stealth Addresses: One-time addresses prevent transaction linking
- Pedersen Commitments: Hide transaction amounts cryptographically
- Viewing Keys: Selective disclosure for compliance without sacrificing privacy

## Response Guidelines:
- Use bullet points and numbered lists for clarity
- Include specific, actionable steps
- Estimate time/difficulty for each recommendation
- Highlight what SIP Protocol can automate
- Suggest 2-3 follow-up questions to explore further`

/**
 * Schema for structured report generation
 */
const ReportSchema = z.object({
  summary: z.string().describe('2-3 sentence executive summary'),
  recommendations: z.array(z.object({
    id: z.string(),
    priority: z.number().min(1).max(10),
    title: z.string(),
    explanation: z.string(),
    actions: z.array(z.string()),
    expectedImprovement: z.number(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    estimatedTime: z.string(),
    canAutomate: z.boolean(),
  })),
  keyRisks: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
  })),
})

/**
 * PrivacyAdvisorAgent - AI-powered privacy recommendations
 *
 * @example
 * ```typescript
 * import { PrivacyAdvisorAgent, createSurveillanceAnalyzer } from '@sip-protocol/sdk'
 *
 * const analyzer = createSurveillanceAnalyzer({
 *   heliusApiKey: process.env.HELIUS_API_KEY!,
 * })
 *
 * const advisor = new PrivacyAdvisorAgent({
 *   openaiApiKey: process.env.OPENAI_API_KEY!,
 * })
 *
 * const analysis = await analyzer.analyze('7xK9...')
 * const response = await advisor.analyze({
 *   analysisResult: analysis,
 *   userQuery: 'What should I do first to improve my privacy?',
 * })
 *
 * console.log(response.message)
 * console.log(response.report?.recommendations)
 * ```
 */
export class PrivacyAdvisorAgent {
  private model: ChatOpenAI
  private config: Required<PrivacyAdvisorConfig>
  private conversationHistory: AdvisorMessage[] = []

  constructor(config: PrivacyAdvisorConfig) {
    if (!config.openaiApiKey) {
      throw new Error(
        'OpenAI API key is required. Get one at https://platform.openai.com'
      )
    }

    this.config = {
      openaiApiKey: config.openaiApiKey,
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 1024,
      verbose: config.verbose ?? false,
    }

    this.model = new ChatOpenAI({
      openAIApiKey: this.config.openaiApiKey,
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    })
  }

  /**
   * Analyze wallet privacy and generate recommendations
   *
   * @param context - Analysis context including surveillance results
   * @returns Advisor response with message and optional report
   */
  async analyze(context: AdvisoryContext): Promise<AdvisorResponse> {
    const { analysisResult, userQuery, preferences } = context

    // Build the analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(analysisResult, preferences)

    // Prepare messages
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(analysisPrompt),
    ]

    // Add conversation history if present
    if (context.conversationHistory) {
      for (const msg of context.conversationHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content))
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content))
        }
      }
    }

    // Add user query if present
    if (userQuery) {
      messages.push(new HumanMessage(userQuery))
    } else {
      messages.push(new HumanMessage(
        'Please analyze this wallet and provide a comprehensive privacy report with prioritized recommendations.'
      ))
    }

    // Generate response
    const response = await this.model.invoke(messages)
    const parser = new StringOutputParser()
    const content = await parser.invoke(response)

    // Track usage
    const usage = response.usage_metadata ? {
      promptTokens: response.usage_metadata.input_tokens,
      completionTokens: response.usage_metadata.output_tokens,
      totalTokens: response.usage_metadata.total_tokens,
      estimatedCost: this.estimateCost(
        response.usage_metadata.input_tokens,
        response.usage_metadata.output_tokens
      ),
    } : undefined

    // Generate structured report
    const report = this.generateReport(analysisResult, content)

    // Generate suggested follow-up questions
    const suggestedQuestions = this.generateSuggestedQuestions(analysisResult)

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: userQuery || 'Analyze my wallet privacy', timestamp: Date.now() },
      { role: 'assistant', content, timestamp: Date.now() }
    )

    return {
      message: content,
      report,
      suggestedQuestions,
      usage,
    }
  }

  /**
   * Chat with the advisor about privacy (follow-up questions)
   *
   * @param message - User message
   * @param context - Optional analysis context for new analysis
   * @returns Advisor response
   */
  async chat(message: string, context?: AdvisoryContext): Promise<AdvisorResponse> {
    const messages = [new SystemMessage(SYSTEM_PROMPT)]

    // Add analysis context if provided
    if (context?.analysisResult) {
      const analysisPrompt = this.buildAnalysisPrompt(
        context.analysisResult,
        context.preferences
      )
      messages.push(new HumanMessage(analysisPrompt))
      messages.push(new AIMessage('I\'ve analyzed the wallet data. What would you like to know?'))
    }

    // Add conversation history
    for (const msg of this.conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content))
      }
    }

    // Add current message
    messages.push(new HumanMessage(message))

    // Generate response
    const response = await this.model.invoke(messages)
    const parser = new StringOutputParser()
    const content = await parser.invoke(response)

    // Track usage
    const usage = response.usage_metadata ? {
      promptTokens: response.usage_metadata.input_tokens,
      completionTokens: response.usage_metadata.output_tokens,
      totalTokens: response.usage_metadata.total_tokens,
      estimatedCost: this.estimateCost(
        response.usage_metadata.input_tokens,
        response.usage_metadata.output_tokens
      ),
    } : undefined

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: message, timestamp: Date.now() },
      { role: 'assistant', content, timestamp: Date.now() }
    )

    return {
      message: content,
      usage,
    }
  }

  /**
   * Stream a response for real-time UI updates
   *
   * @param context - Analysis context
   * @param onChunk - Callback for each streamed chunk
   * @returns Final advisor response
   */
  async stream(
    context: AdvisoryContext,
    onChunk: StreamCallback
  ): Promise<AdvisorResponse> {
    const { analysisResult, userQuery, preferences } = context

    // Build the analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(analysisResult, preferences)

    // Prepare messages
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(analysisPrompt),
    ]

    if (userQuery) {
      messages.push(new HumanMessage(userQuery))
    } else {
      messages.push(new HumanMessage(
        'Please analyze this wallet and provide a comprehensive privacy report with prioritized recommendations.'
      ))
    }

    // Stream response
    let fullContent = ''
    const stream = await this.model.stream(messages)

    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : ''
      fullContent += text
      onChunk(text)
    }

    // Generate report from full content
    const report = this.generateReport(analysisResult, fullContent)
    const suggestedQuestions = this.generateSuggestedQuestions(analysisResult)

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: userQuery || 'Analyze my wallet privacy', timestamp: Date.now() },
      { role: 'assistant', content: fullContent, timestamp: Date.now() }
    )

    return {
      message: fullContent,
      report,
      suggestedQuestions,
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
  }

  /**
   * Get conversation history
   */
  getHistory(): AdvisorMessage[] {
    return [...this.conversationHistory]
  }

  /**
   * Build analysis prompt from surveillance data
   */
  private buildAnalysisPrompt(
    result: FullAnalysisResult,
    preferences?: AdvisoryContext['preferences']
  ): string {
    const { privacyScore, addressReuse, cluster, exchangeExposure, temporalPatterns, socialLinks, sipComparison } = result

    let prompt = `## Wallet Privacy Analysis Data

**Wallet**: ${privacyScore.walletAddress}
**Overall Score**: ${privacyScore.overall}/100
**Risk Level**: ${privacyScore.risk.toUpperCase()}
**Transactions Analyzed**: ${result.transactionCount}

### Score Breakdown:
- Address Reuse: ${privacyScore.breakdown.addressReuse}/25 points
- Cluster Exposure: ${privacyScore.breakdown.clusterExposure}/25 points
- Exchange Exposure: ${privacyScore.breakdown.exchangeExposure}/20 points
- Temporal Patterns: ${privacyScore.breakdown.temporalPatterns}/15 points
- Social Links: ${privacyScore.breakdown.socialLinks}/15 points

### Detailed Findings:

**Address Reuse**:
- Receive reuse count: ${addressReuse.receiveReuseCount}
- Send reuse count: ${addressReuse.sendReuseCount}
- Total reuse: ${addressReuse.totalReuseCount}
- Score deduction: -${addressReuse.scoreDeduction} points

**Cluster Detection (CIOH)**:
- Linked addresses found: ${cluster.linkedAddressCount}
- Confidence: ${(cluster.confidence * 100).toFixed(0)}%
- Clusters detected: ${cluster.clusters.length}
- Score deduction: -${cluster.scoreDeduction} points

**Exchange Exposure**:
- Exchanges interacted: ${exchangeExposure.exchangeCount}
- Total deposits: ${exchangeExposure.depositCount}
- Total withdrawals: ${exchangeExposure.withdrawalCount}
- Score deduction: -${exchangeExposure.scoreDeduction} points
${exchangeExposure.exchanges.length > 0 ? `- Exchanges: ${exchangeExposure.exchanges.map(e => `${e.name} (${e.type}, KYC: ${e.kycRequired})`).join(', ')}` : ''}

**Temporal Patterns**:
- Patterns detected: ${temporalPatterns.patterns.length}
${temporalPatterns.inferredTimezone ? `- Inferred timezone: ${temporalPatterns.inferredTimezone}` : ''}
- Score deduction: -${temporalPatterns.scoreDeduction} points

**Social Links**:
- Is doxxed: ${socialLinks.isDoxxed ? 'YES' : 'No'}
- Partial exposure: ${socialLinks.partialExposure ? 'Yes' : 'No'}
- Links found: ${socialLinks.links.length}
- Score deduction: -${socialLinks.scoreDeduction} points

### SIP Protocol Projection:
- Current score: ${sipComparison.currentScore}/100
- Projected with SIP: ${sipComparison.projectedScore}/100
- Potential improvement: +${sipComparison.improvement} points`

    // Add user preferences if specified
    if (preferences) {
      prompt += '\n\n### User Preferences:'
      if (preferences.preferAutomation) {
        prompt += '\n- Prefers automated solutions over manual steps'
      }
      if (preferences.technicalLevel) {
        prompt += `\n- Technical level: ${preferences.technicalLevel}`
      }
      if (preferences.focusAreas?.length) {
        prompt += `\n- Focus areas: ${preferences.focusAreas.join(', ')}`
      }
    }

    return prompt
  }

  /**
   * Generate structured report from analysis and LLM response
   */
  private generateReport(
    result: FullAnalysisResult,
    llmResponse: string
  ): PrivacyAdvisoryReport {
    const { privacyScore, sipComparison } = result

    // Extract recommendations from existing privacy score
    const recommendations: AdvisorRecommendation[] = privacyScore.recommendations
      .slice(0, 5)
      .map((rec, index) => ({
        id: rec.id,
        priority: index + 1,
        title: rec.title,
        explanation: rec.description,
        actions: [rec.action],
        expectedImprovement: rec.potentialGain,
        difficulty: this.mapSeverityToDifficulty(rec.severity),
        estimatedTime: this.estimateTime(rec.category),
        canAutomate: this.canAutomate(rec.category),
      }))

    // Extract key risks
    const keyRisks = this.extractKeyRisks(result)

    // Generate summary from LLM response (first 2-3 sentences)
    const summaryMatch = llmResponse.match(/^(.+?\..*?\..*?\.)/s)
    const summary = summaryMatch
      ? summaryMatch[1].replace(/\n/g, ' ').trim()
      : `Your wallet has a privacy score of ${privacyScore.overall}/100 (${privacyScore.risk} risk). ${
          privacyScore.recommendations[0]
            ? `Top priority: ${privacyScore.recommendations[0].title}.`
            : 'Review the recommendations below to improve your privacy.'
        }`

    return {
      walletAddress: privacyScore.walletAddress,
      currentScore: privacyScore.overall,
      riskLevel: privacyScore.risk,
      summary,
      recommendations,
      keyRisks,
      sipBenefits: {
        projectedScore: sipComparison.projectedScore,
        improvement: sipComparison.improvement,
        features: [
          'Stealth addresses for unlinkable transactions',
          'Pedersen commitments for hidden amounts',
          'Viewing keys for selective compliance disclosure',
        ],
      },
      generatedAt: Date.now(),
    }
  }

  /**
   * Extract key risks from analysis
   */
  private extractKeyRisks(result: FullAnalysisResult): PrivacyAdvisoryReport['keyRisks'] {
    const risks: PrivacyAdvisoryReport['keyRisks'] = []

    if (result.addressReuse.scoreDeduction > 10) {
      risks.push({
        category: 'Address Reuse',
        description: `Found ${result.addressReuse.totalReuseCount} instances of address reuse, allowing observers to link your transactions together.`,
        severity: result.addressReuse.scoreDeduction > 20 ? 'critical' : 'high',
      })
    }

    if (result.cluster.linkedAddressCount > 0) {
      risks.push({
        category: 'Wallet Clustering',
        description: `${result.cluster.linkedAddressCount} addresses are linked to your wallet through common-input heuristics.`,
        severity: result.cluster.scoreDeduction > 15 ? 'high' : 'medium',
      })
    }

    if (result.exchangeExposure.exchangeCount > 0) {
      const kycExchanges = result.exchangeExposure.exchanges.filter(e => e.kycRequired)
      if (kycExchanges.length > 0) {
        risks.push({
          category: 'Exchange Exposure',
          description: `Interacted with ${kycExchanges.length} KYC-required exchange(s), creating a link between your identity and on-chain activity.`,
          severity: kycExchanges.length > 2 ? 'high' : 'medium',
        })
      }
    }

    if (result.socialLinks.isDoxxed) {
      risks.push({
        category: 'Identity Exposure',
        description: 'Your wallet is publicly linked to your identity through social profiles or naming services.',
        severity: 'critical',
      })
    }

    if (result.temporalPatterns.patterns.length > 0) {
      risks.push({
        category: 'Behavioral Patterns',
        description: `Detected ${result.temporalPatterns.patterns.length} timing pattern(s) that could reveal your timezone or habits.`,
        severity: 'low',
      })
    }

    return risks
  }

  /**
   * Generate suggested follow-up questions
   */
  private generateSuggestedQuestions(result: FullAnalysisResult): string[] {
    const questions: string[] = []

    if (result.privacyScore.overall < 50) {
      questions.push('What\'s the single most impactful thing I can do right now?')
    }

    if (result.exchangeExposure.exchangeCount > 0) {
      questions.push('How can I reduce my exchange exposure going forward?')
    }

    if (result.addressReuse.totalReuseCount > 5) {
      questions.push('How do stealth addresses prevent address reuse?')
    }

    questions.push('How would using SIP Protocol improve my privacy?')
    questions.push('What privacy practices should I adopt for the future?')

    return questions.slice(0, 3)
  }

  /**
   * Map severity to difficulty
   */
  private mapSeverityToDifficulty(severity: RiskLevel): 'easy' | 'medium' | 'hard' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'medium'
      case 'medium':
        return 'easy'
      case 'low':
        return 'easy'
      default:
        return 'medium'
    }
  }

  /**
   * Estimate time to implement recommendation
   */
  private estimateTime(category: string): string {
    switch (category) {
      case 'addressReuse':
        return '5-10 minutes'
      case 'clusterExposure':
        return '15-30 minutes'
      case 'exchangeExposure':
        return '1-2 hours'
      case 'temporalPatterns':
        return 'Ongoing practice'
      case 'socialLinks':
        return '30-60 minutes'
      default:
        return '10-20 minutes'
    }
  }

  /**
   * Check if SIP can automate this recommendation
   */
  private canAutomate(category: string): boolean {
    switch (category) {
      case 'addressReuse':
        return true // Stealth addresses
      case 'clusterExposure':
        return true // Stealth addresses prevent clustering
      case 'exchangeExposure':
        return false // User behavior
      case 'temporalPatterns':
        return false // User behavior
      case 'socialLinks':
        return false // User decision
      default:
        return false
    }
  }

  /**
   * Estimate cost based on model and token usage
   */
  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Pricing as of 2024 (in USD per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
    }

    const modelPricing = pricing[this.config.model] ?? pricing['gpt-4o-mini']

    return (
      (inputTokens / 1000) * modelPricing.input +
      (outputTokens / 1000) * modelPricing.output
    )
  }
}

/**
 * Create a new PrivacyAdvisorAgent instance
 *
 * @param config - Agent configuration
 * @returns PrivacyAdvisorAgent instance
 *
 * @example
 * ```typescript
 * const advisor = createPrivacyAdvisor({
 *   openaiApiKey: 'your-api-key',
 *   model: 'gpt-4o-mini', // Cost-efficient default
 * })
 *
 * const response = await advisor.analyze({
 *   analysisResult: await analyzer.analyze('wallet-address'),
 * })
 * ```
 */
export function createPrivacyAdvisor(
  config: PrivacyAdvisorConfig
): PrivacyAdvisorAgent {
  return new PrivacyAdvisorAgent(config)
}
