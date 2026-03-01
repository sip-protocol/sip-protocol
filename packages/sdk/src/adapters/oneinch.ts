/**
 * 1inch Aggregator Adapter for SIP Protocol
 *
 * Generates swap calldata for privacy-preserving EVM swaps via 1inch aggregator.
 * SIP adds stealth addresses as the swap recipient, breaking the on-chain identity link.
 *
 * ## Privacy Model
 *
 * 1inch swaps are routed through 200+ DEX pools for best price. SIP enhances privacy by:
 * - Setting `destReceiver` to a stealth address (recipient unlinkable)
 * - SIPSwapRouter validates calldata on-chain before forwarding to 1inch
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────┐
 * │  1INCH + SIP PRIVACY FLOW                                    │
 * │                                                              │
 * │  1. SDK: Generate stealth address for output                 │
 * │  2. SDK: Call 1inch API (destReceiver = stealth)             │
 * │  3. SDK: Submit calldata to SIPSwapRouter                    │
 * │  4. Contract: Validate calldata, deduct fee, forward         │
 * │  5. 1inch Router → DEX pools → stealth address               │
 * │                                                              │
 * │  Result: Best-price swap, recipient unlinkable               │
 * └──────────────────────────────────────────────────────────────┘
 * ```
 *
 * @see https://portal.1inch.dev
 */

export interface OneInchQuote {
  toAmount: string
  estimatedGas: string
  protocols: Array<{ name: string; part: number }>
}

export interface OneInchSwapData {
  tx: {
    to: string
    data: string
    value: string
    gas: number
  }
  toAmount: string
}

export interface OneInchSwapParams {
  src: string
  dst: string
  amount: string
  from: string
  destReceiver: string
  slippage: number
  disableEstimate?: boolean
}

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
}

const ONEINCH_ROUTER = '0x111111125421cA6dc452d289314280a0f8842A65'
const API_BASE = 'https://api.1inch.dev/swap/v6.0'

export class OneInchAdapter {
  private apiKey: string
  private chainId: number

  constructor(apiKey: string, chain: string | number) {
    this.apiKey = apiKey
    this.chainId = typeof chain === 'number' ? chain : CHAIN_IDS[chain]
    if (!this.chainId) throw new Error(`Unsupported chain: ${chain}`)
  }

  get routerAddress(): string {
    return ONEINCH_ROUTER
  }

  async getQuote(params: {
    src: string
    dst: string
    amount: string
  }): Promise<OneInchQuote> {
    const url = new URL(`${API_BASE}/${this.chainId}/quote`)
    url.searchParams.set('src', params.src)
    url.searchParams.set('dst', params.dst)
    url.searchParams.set('amount', params.amount)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getSwapCalldata(params: OneInchSwapParams): Promise<OneInchSwapData> {
    const url = new URL(`${API_BASE}/${this.chainId}/swap`)
    url.searchParams.set('src', params.src)
    url.searchParams.set('dst', params.dst)
    url.searchParams.set('amount', params.amount)
    url.searchParams.set('from', params.from)
    url.searchParams.set('destReceiver', params.destReceiver)
    url.searchParams.set('slippage', params.slippage.toString())
    url.searchParams.set('disableEstimate', (params.disableEstimate ?? true).toString())

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  static supportedChains(): string[] {
    return Object.keys(CHAIN_IDS)
  }
}
