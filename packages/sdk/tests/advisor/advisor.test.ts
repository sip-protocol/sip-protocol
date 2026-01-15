/**
 * Privacy Advisor Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  AdvisoryContext,
  PrivacyAdvisoryReport,
} from '../../src/advisor'
import type { FullAnalysisResult, RiskLevel } from '../../src/surveillance'

// Mock LangChain modules BEFORE importing the advisor
const mockInvoke = vi.fn().mockResolvedValue({
  content: 'Your wallet has a privacy score of 45/100 (high risk). The main issues are address reuse and exchange exposure. I recommend using stealth addresses for future transactions.',
  usage_metadata: {
    input_tokens: 500,
    output_tokens: 100,
    total_tokens: 600,
  },
})

const mockStream = vi.fn().mockImplementation(async function* () {
  yield { content: 'Your wallet has a privacy score of 45/100.' }
  yield { content: ' The main issues are address reuse.' }
})

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: mockInvoke,
    stream: mockStream,
  })),
}))

vi.mock('@langchain/core/messages', () => ({
  HumanMessage: vi.fn().mockImplementation((content) => ({ content, role: 'user' })),
  SystemMessage: vi.fn().mockImplementation((content) => ({ content, role: 'system' })),
  AIMessage: vi.fn().mockImplementation((content) => ({ content, role: 'assistant' })),
}))

vi.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockImplementation((response) => response.content),
  })),
}))

// Now import the advisor after mocks are set up
import {
  PrivacyAdvisorAgent,
  createPrivacyAdvisor,
} from '../../src/advisor'

// Helper to create mock analysis result
function createMockAnalysisResult(
  overrides: Partial<FullAnalysisResult> = {}
): FullAnalysisResult {
  return {
    privacyScore: {
      overall: 45,
      breakdown: {
        addressReuse: 10,
        clusterExposure: 15,
        exchangeExposure: 10,
        temporalPatterns: 5,
        socialLinks: 5,
      },
      risk: 'high' as RiskLevel,
      recommendations: [
        {
          id: 'rec-1',
          severity: 'high' as RiskLevel,
          category: 'addressReuse',
          title: 'Reduce address reuse',
          description: 'Use stealth addresses to prevent transaction linking',
          action: 'Enable SIP Protocol for future transactions',
          potentialGain: 15,
        },
        {
          id: 'rec-2',
          severity: 'medium' as RiskLevel,
          category: 'exchangeExposure',
          title: 'Limit exchange exposure',
          description: 'Reduce interactions with KYC exchanges',
          action: 'Use DEXes with SIP privacy layer',
          potentialGain: 10,
        },
      ],
      analyzedAt: Date.now(),
      walletAddress: 'wallet123',
    },
    addressReuse: {
      receiveReuseCount: 10,
      sendReuseCount: 5,
      totalReuseCount: 15,
      scoreDeduction: 15,
      reusedAddresses: [],
    },
    cluster: {
      linkedAddressCount: 3,
      confidence: 0.7,
      scoreDeduction: 10,
      clusters: [],
    },
    exchangeExposure: {
      exchangeCount: 2,
      depositCount: 5,
      withdrawalCount: 3,
      scoreDeduction: 10,
      exchanges: [
        {
          name: 'Binance',
          type: 'cex',
          kycRequired: true,
          deposits: 3,
          withdrawals: 2,
          firstInteraction: Date.now() - 30 * 24 * 60 * 60 * 1000,
          lastInteraction: Date.now(),
        },
      ],
    },
    temporalPatterns: {
      patterns: [],
      scoreDeduction: 10,
    },
    socialLinks: {
      isDoxxed: false,
      partialExposure: false,
      scoreDeduction: 10,
      links: [],
    },
    sipComparison: {
      currentScore: 45,
      projectedScore: 75,
      improvement: 30,
      improvements: [
        {
          category: 'addressReuse',
          currentScore: 10,
          projectedScore: 25,
          reason: 'Stealth addresses prevent address reuse',
        },
      ],
    },
    transactionCount: 50,
    analysisDurationMs: 1500,
    ...overrides,
  }
}

describe('PrivacyAdvisorAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create agent with valid config', () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      expect(advisor).toBeInstanceOf(PrivacyAdvisorAgent)
    })

    it('should throw error without API key', () => {
      expect(() => {
        new PrivacyAdvisorAgent({
          openaiApiKey: '',
        })
      }).toThrow('OpenAI API key is required')
    })

    it('should accept custom model configuration', () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2048,
      })

      expect(advisor).toBeInstanceOf(PrivacyAdvisorAgent)
    })
  })

  describe('createPrivacyAdvisor', () => {
    it('should create agent via factory function', () => {
      const advisor = createPrivacyAdvisor({
        openaiApiKey: 'test-api-key',
      })

      expect(advisor).toBeInstanceOf(PrivacyAdvisorAgent)
    })
  })

  describe('analyze', () => {
    it('should generate response from analysis', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
      }

      const response = await advisor.analyze(context)

      expect(response.message).toBeDefined()
      expect(response.message.length).toBeGreaterThan(0)
    })

    it('should generate report with recommendations', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
      }

      const response = await advisor.analyze(context)

      expect(response.report).toBeDefined()
      expect(response.report?.walletAddress).toBe('wallet123')
      expect(response.report?.currentScore).toBe(45)
      expect(response.report?.riskLevel).toBe('high')
      expect(response.report?.recommendations.length).toBeGreaterThan(0)
    })

    it('should include SIP benefits in report', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
      }

      const response = await advisor.analyze(context)

      expect(response.report?.sipBenefits).toBeDefined()
      expect(response.report?.sipBenefits.projectedScore).toBe(75)
      expect(response.report?.sipBenefits.improvement).toBe(30)
      expect(response.report?.sipBenefits.features.length).toBeGreaterThan(0)
    })

    it('should include suggested questions', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
      }

      const response = await advisor.analyze(context)

      expect(response.suggestedQuestions).toBeDefined()
      expect(response.suggestedQuestions!.length).toBeGreaterThan(0)
    })

    it('should track token usage', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
      }

      const response = await advisor.analyze(context)

      expect(response.usage).toBeDefined()
      expect(response.usage?.promptTokens).toBe(500)
      expect(response.usage?.completionTokens).toBe(100)
      expect(response.usage?.totalTokens).toBe(600)
      expect(response.usage?.estimatedCost).toBeGreaterThan(0)
    })

    it('should handle user query', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
        userQuery: 'What should I fix first?',
      }

      const response = await advisor.analyze(context)

      expect(response.message).toBeDefined()
    })

    it('should respect user preferences', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const context: AdvisoryContext = {
        analysisResult: createMockAnalysisResult(),
        preferences: {
          preferAutomation: true,
          technicalLevel: 'beginner',
          focusAreas: ['privacy', 'convenience'],
        },
      }

      const response = await advisor.analyze(context)

      expect(response.message).toBeDefined()
    })
  })

  describe('chat', () => {
    it('should handle follow-up questions', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      // First, analyze
      await advisor.analyze({
        analysisResult: createMockAnalysisResult(),
      })

      // Then, chat
      const response = await advisor.chat('How do stealth addresses work?')

      expect(response.message).toBeDefined()
    })

    it('should maintain conversation history', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      await advisor.chat('Hello')
      await advisor.chat('How are you?')

      const history = advisor.getHistory()

      expect(history.length).toBe(4) // 2 user + 2 assistant messages
    })
  })

  describe('clearHistory', () => {
    it('should clear conversation history', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      await advisor.chat('Hello')
      expect(advisor.getHistory().length).toBe(2)

      advisor.clearHistory()
      expect(advisor.getHistory().length).toBe(0)
    })
  })

  describe('report generation', () => {
    it('should extract key risks from analysis', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const analysisResult = createMockAnalysisResult({
        addressReuse: {
          receiveReuseCount: 20,
          sendReuseCount: 15,
          totalReuseCount: 35,
          scoreDeduction: 20,
          reusedAddresses: [],
        },
      })

      const response = await advisor.analyze({ analysisResult })

      expect(response.report?.keyRisks).toBeDefined()
      expect(response.report?.keyRisks.length).toBeGreaterThan(0)

      const addressReuseRisk = response.report?.keyRisks.find(
        (r) => r.category === 'Address Reuse'
      )
      expect(addressReuseRisk).toBeDefined()
    })

    it('should flag critical risk for doxxed wallets', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const analysisResult = createMockAnalysisResult({
        socialLinks: {
          isDoxxed: true,
          partialExposure: true,
          scoreDeduction: 15,
          links: [
            {
              platform: 'ens',
              identifier: 'user.eth',
              confidence: 1.0,
            },
          ],
        },
      })

      const response = await advisor.analyze({ analysisResult })

      const identityRisk = response.report?.keyRisks.find(
        (r) => r.category === 'Identity Exposure'
      )
      expect(identityRisk).toBeDefined()
      expect(identityRisk?.severity).toBe('critical')
    })

    it('should prioritize recommendations by impact', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const response = await advisor.analyze({
        analysisResult: createMockAnalysisResult(),
      })

      const recommendations = response.report?.recommendations
      expect(recommendations).toBeDefined()
      expect(recommendations!.length).toBeGreaterThan(0)

      // Check recommendations are ordered by priority
      for (let i = 1; i < recommendations!.length; i++) {
        expect(recommendations![i].priority).toBeGreaterThanOrEqual(
          recommendations![i - 1].priority
        )
      }
    })

    it('should indicate which recommendations can be automated', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
      })

      const response = await advisor.analyze({
        analysisResult: createMockAnalysisResult(),
      })

      const recommendations = response.report?.recommendations
      expect(recommendations).toBeDefined()

      // Address reuse can be automated with stealth addresses
      const addressReuseRec = recommendations?.find(
        (r) => r.id === 'rec-1'
      )
      expect(addressReuseRec?.canAutomate).toBe(true)
    })
  })

  describe('cost estimation', () => {
    it('should estimate cost for gpt-4o-mini', async () => {
      const advisor = new PrivacyAdvisorAgent({
        openaiApiKey: 'test-api-key',
        model: 'gpt-4o-mini',
      })

      const response = await advisor.analyze({
        analysisResult: createMockAnalysisResult(),
      })

      // gpt-4o-mini: $0.00015/1K input, $0.0006/1K output
      // 500 input + 100 output tokens
      const expectedCost = (500 / 1000) * 0.00015 + (100 / 1000) * 0.0006
      expect(response.usage?.estimatedCost).toBeCloseTo(expectedCost, 6)
    })
  })
})

describe('Report Types', () => {
  it('should have valid recommendation structure', () => {
    const recommendation: PrivacyAdvisoryReport['recommendations'][0] = {
      id: 'test-1',
      priority: 1,
      title: 'Test Recommendation',
      explanation: 'Test explanation',
      actions: ['Step 1', 'Step 2'],
      expectedImprovement: 10,
      difficulty: 'easy',
      estimatedTime: '5-10 minutes',
      canAutomate: true,
    }

    expect(recommendation.id).toBe('test-1')
    expect(recommendation.priority).toBe(1)
    expect(recommendation.actions.length).toBe(2)
    expect(recommendation.canAutomate).toBe(true)
  })

  it('should have valid report structure', () => {
    const report: PrivacyAdvisoryReport = {
      walletAddress: 'wallet123',
      currentScore: 45,
      riskLevel: 'high',
      summary: 'Test summary',
      recommendations: [],
      keyRisks: [],
      sipBenefits: {
        projectedScore: 75,
        improvement: 30,
        features: ['Feature 1'],
      },
      generatedAt: Date.now(),
    }

    expect(report.walletAddress).toBe('wallet123')
    expect(report.currentScore).toBe(45)
    expect(report.sipBenefits.improvement).toBe(30)
  })
})
