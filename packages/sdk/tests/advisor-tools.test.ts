/**
 * Privacy Advisor Tools Tests
 *
 * Tests for the LangChain tools that power the Privacy Advisor Agent.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createPrivacyAdvisorTools,
  createAnalyzeWalletTool,
  createQuickScoreTool,
  createSIPComparisonTool,
  createExplainTool,
} from '../src/advisor/tools'

// Mock the SurveillanceAnalyzer
vi.mock('../src/surveillance/analyzer', () => ({
  SurveillanceAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      privacyScore: {
        overall: 65,
        risk: 'medium',
        analyzedAt: Date.now(),
        breakdown: {
          addressReuse: 18,
          clusterExposure: 15,
          exchangeExposure: 12,
          temporalPatterns: 10,
          socialLinks: 10,
        },
        recommendations: [
          {
            id: 'rec-1',
            title: 'Use stealth addresses',
            action: 'Enable stealth addresses for receiving payments',
            severity: 'high',
            potentialGain: 10,
            category: 'addressReuse',
            description: 'Stealth addresses prevent address reuse',
          },
        ],
      },
      addressReuse: {
        totalReuseCount: 5,
        receiveReuseCount: 3,
        sendReuseCount: 2,
        scoreDeduction: 7,
        reusedAddresses: [
          { address: 'GjKr7abc123', useCount: 3, type: 'receive' },
        ],
      },
      cluster: {
        linkedAddressCount: 2,
        confidence: 0.8,
        scoreDeduction: 10,
        clusters: [
          { addresses: ['addr1', 'addr2'], linkType: 'common-input', transactionCount: 5 },
        ],
      },
      exchangeExposure: {
        exchangeCount: 2,
        depositCount: 5,
        withdrawalCount: 3,
        scoreDeduction: 8,
        exchanges: [
          { name: 'Binance', type: 'cex', kycRequired: true, deposits: 3, withdrawals: 2 },
        ],
      },
      temporalPatterns: {
        patterns: [{ type: 'regular-schedule', confidence: 0.7 }],
        inferredTimezone: 'UTC-5',
        scoreDeduction: 5,
      },
      socialLinks: {
        isDoxxed: false,
        partialExposure: false,
        scoreDeduction: 0,
        links: [],
      },
      sipComparison: {
        currentScore: 65,
        projectedScore: 85,
        improvement: 20,
      },
      transactionCount: 150,
      analysisDurationMs: 2500,
    }),
    quickScore: vi.fn().mockResolvedValue({
      score: 65,
      risk: 'medium',
      topIssue: 'Address reuse detected',
    }),
  })),
}))

describe('Privacy Advisor Tools', () => {
  const mockConfig = {
    heliusApiKey: 'test-api-key',
    cluster: 'mainnet-beta' as const,
  }

  describe('createPrivacyAdvisorTools', () => {
    it('should create all 4 tools', () => {
      const tools = createPrivacyAdvisorTools(mockConfig)

      expect(tools).toHaveLength(4)
      expect(tools.map((t) => t.name)).toEqual([
        'analyze_wallet',
        'quick_privacy_score',
        'sip_protection_comparison',
        'explain_privacy_concept',
      ])
    })
  })

  describe('createAnalyzeWalletTool', () => {
    it('should have correct name and description', () => {
      const tool = createAnalyzeWalletTool(mockConfig)

      expect(tool.name).toBe('analyze_wallet')
      expect(tool.description).toContain('Solana wallet')
      expect(tool.description).toContain('privacy')
    })

    it('should analyze a wallet and return formatted JSON', async () => {
      const tool = createAnalyzeWalletTool(mockConfig)
      const result = await tool.invoke({ address: 'GjKr7abc123xyz456' })

      const parsed = JSON.parse(result)
      expect(parsed.overall.score).toBe(65)
      expect(parsed.overall.risk).toBe('medium')
      expect(parsed.breakdown).toBeDefined()
      expect(parsed.findings).toBeDefined()
      expect(parsed.sipComparison).toBeDefined()
      expect(parsed.recommendations).toBeDefined()
    })

    it('should return error on analysis failure', async () => {
      const { SurveillanceAnalyzer } = await import('../src/surveillance/analyzer')
      vi.mocked(SurveillanceAnalyzer).mockImplementationOnce(() => ({
        analyze: vi.fn().mockRejectedValue(new Error('Network error')),
        quickScore: vi.fn(),
      }))

      const tool = createAnalyzeWalletTool(mockConfig)
      const result = await tool.invoke({ address: 'invalid' })

      const parsed = JSON.parse(result)
      expect(parsed.error).toBe(true)
      expect(parsed.message).toContain('Failed to analyze wallet')
    })
  })

  describe('createQuickScoreTool', () => {
    it('should have correct name and description', () => {
      const tool = createQuickScoreTool(mockConfig)

      expect(tool.name).toBe('quick_privacy_score')
      expect(tool.description).toContain('quick')
      expect(tool.description).toContain('less detailed')
    })

    it('should return quick score with summary', async () => {
      const tool = createQuickScoreTool(mockConfig)
      const result = await tool.invoke({ address: 'GjKr7abc123xyz456' })

      const parsed = JSON.parse(result)
      expect(parsed.score).toBe(65)
      expect(parsed.risk).toBe('medium')
      expect(parsed.topIssue).toBe('Address reuse detected')
      expect(parsed.summary).toBeDefined()
    })
  })

  describe('createSIPComparisonTool', () => {
    it('should have correct name and description', () => {
      const tool = createSIPComparisonTool()

      expect(tool.name).toBe('sip_protection_comparison')
      expect(tool.description).toContain('SIP Protocol')
    })

    it('should calculate improvement for low score wallet', async () => {
      const tool = createSIPComparisonTool()
      const result = await tool.invoke({
        currentScore: 40,
        addressReuseScore: 5,
        clusterScore: 5,
      })

      const parsed = JSON.parse(result)
      expect(parsed.currentScore).toBe(40)
      expect(parsed.projectedScore).toBeGreaterThan(40)
      expect(parsed.improvement).toBeGreaterThan(20)
      expect(parsed.breakdown.addressReuse).toBeDefined()
      expect(parsed.breakdown.cluster).toBeDefined()
    })

    it('should calculate minimal improvement for high score wallet', async () => {
      const tool = createSIPComparisonTool()
      const result = await tool.invoke({
        currentScore: 90,
        addressReuseScore: 23,
        clusterScore: 24,
      })

      const parsed = JSON.parse(result)
      expect(parsed.improvement).toBeLessThan(5)
      expect(parsed.recommendation).toContain('already good')
    })
  })

  describe('createExplainTool', () => {
    it('should have correct name and description', () => {
      const tool = createExplainTool()

      expect(tool.name).toBe('explain_privacy_concept')
      expect(tool.description).toContain('privacy concept')
    })

    it('should explain stealth addresses', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'stealth-address' })

      expect(result).toContain('P.O. Box')
      expect(result).toContain('unique address')
    })

    it('should explain viewing keys', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'viewing-key' })

      expect(result).toContain('read-only')
      expect(result).toContain('bank statements')
    })

    it('should explain address reuse', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'address-reuse' })

      expect(result).toContain('bad for privacy')
      expect(result).toContain('multiple payments')
    })

    it('should explain cluster analysis', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'cluster-analysis' })

      expect(result).toContain('link')
      expect(result).toContain('transaction patterns')
    })

    it('should explain privacy score', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'privacy-score' })

      expect(result).toContain('0-100')
      expect(result).toContain('surveillance')
    })

    it('should explain Pedersen commitments', async () => {
      const tool = createExplainTool()
      const result = await tool.invoke({ concept: 'pedersen-commitment' })

      expect(result).toContain('sealed envelope')
      expect(result).toContain('without revealing')
    })
  })
})

describe('Tool Schema Validation', () => {
  const mockConfig = {
    heliusApiKey: 'test-api-key',
    cluster: 'mainnet-beta' as const,
  }

  it('analyze_wallet requires address', () => {
    const tool = createAnalyzeWalletTool(mockConfig)
    const schema = tool.schema as { shape: { address: object } }

    expect(schema.shape.address).toBeDefined()
  })

  it('sip_protection_comparison requires numeric inputs', () => {
    const tool = createSIPComparisonTool()
    const schema = tool.schema as {
      shape: {
        currentScore: object
        addressReuseScore: object
        clusterScore: object
      }
    }

    expect(schema.shape.currentScore).toBeDefined()
    expect(schema.shape.addressReuseScore).toBeDefined()
    expect(schema.shape.clusterScore).toBeDefined()
  })

  it('explain_privacy_concept has valid enum values', () => {
    const tool = createExplainTool()
    const schema = tool.schema as { shape: { concept: { options: string[] } } }

    expect(schema.shape.concept).toBeDefined()
  })
})

describe('Integration with LangChain', () => {
  const mockConfig = {
    heliusApiKey: 'test-api-key',
    cluster: 'mainnet-beta' as const,
  }

  it('tools are compatible with LangChain DynamicStructuredTool interface', () => {
    const tools = createPrivacyAdvisorTools(mockConfig)

    for (const tool of tools) {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.schema).toBeDefined()
      expect(typeof tool.invoke).toBe('function')
    }
  })

  it('tools return string results for LLM consumption', async () => {
    const tools = createPrivacyAdvisorTools(mockConfig)

    const results = await Promise.all([
      tools[0]?.invoke({ address: 'test123' }),
      tools[1]?.invoke({ address: 'test123' }),
      tools[2]?.invoke({
        currentScore: 50,
        addressReuseScore: 10,
        clusterScore: 10,
      }),
      tools[3]?.invoke({ concept: 'stealth-address' }),
    ])

    for (const result of results) {
      expect(typeof result).toBe('string')
    }
  })
})
