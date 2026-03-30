# Sipher — Vision & Product Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Author:** RECTOR + CIPHER
**Tagline:** "Plug in. Go private."

---

## 1. Mission & Identity

### Mission

Every transaction is a right to privacy. Sipher makes that right default — for humans and agents alike.

### Identity

Sipher is SIP Protocol's flagship product. The universal privacy plug that gives any workflow — human or autonomous — access to the SIP privacy standard.

- **SIP Protocol** = the privacy standard (engine)
- **Sipher** = the flagship product (car)
- Relationship: like Uniswap Labs → Uniswap Protocol

### Tagline

**"Plug in. Go private."**

### Values

- Privacy is a right, not a feature
- Compliance without compromise (viewing keys, not backdoors)
- Works for humans AND agents — same engine, different interfaces
- Production-grade or don't ship

---

## 2. Target Users

### Primary (Phase 1): Crypto Natives

DeFi traders, DAO treasuries, whales, and power users who already feel the pain of public transaction history. They don't need convincing — they need a tool that works.

**Characteristics:**
- Understand wallet exposure and chain analysis risks
- Currently using no privacy tools (too complex, too risky, sanctioned)
- Willing to deposit into a privacy vault if the trust model is clear
- Value speed, reliability, and compliance safety

### Secondary (Phase 2+): Agents

Autonomous agents (trading bots, DeFi agents, OpenClaw-based agents) that execute transactions on behalf of users. Their transactions are equally public and equally exposed.

### Tertiary (Phase 3+): Institutions & Newcomers

- Institutions: compliance teams, DAO treasuries, payroll-in-crypto
- Newcomers: people who discover their transactions are public and want protection

---

## 3. Product Concept

### Two Modes, One Product

**Mode 1: Human Plug**
- Connect any wallet (Phantom, Backpack, Solflare — wallet-agnostic)
- Deposit funds into Sipher's PDA vault
- Interact via conversational agent (web chat, Telegram, X)
- Agent handles all privacy mechanics (stealth addresses, commitments, viewing keys)
- User never touches cryptographic primitives directly

**Mode 2: Agent Plug**
- SDK, REST API, MCP skill
- Any agent framework (OpenClaw, custom bots, autonomous traders) adds Sipher
- Gets SIP privacy integrated into their workflow
- Preserves and evolves current Sipher REST API capabilities (71 endpoints, 17 chains)

**Same engine underneath:** @sip-protocol/sdk → PDA vault → stealth addresses → Pedersen commitments → viewing keys

---

## 4. Architecture

### Package Separation

```
@sip-protocol/sdk     → Privacy primitives (stealth, Pedersen, viewing keys)
                         Existing. Does not change. The standard.

@sipher/sdk           → Agent + vault layer that USES @sip-protocol/sdk
                         New. The "plug" interface.
```

SIP SDK is the standard — low-level, framework-agnostic, used by anyone.
Sipher SDK is the product — opinionated, agent-aware, vault-integrated.
Sipher depends on SIP, not the other way around.

### System Architecture

```
+--------------------------------------------------+
|  SIPHER — "Plug in. Go private."                  |
+--------------------------------------------------+
|                                                    |
|  +---------------+    +---------------+           |
|  | Human Plug    |    | Agent Plug    |           |
|  | Web Chat      |    | SDK / API     |           |
|  | Telegram      |    | MCP Skill     |           |
|  | X / Discord   |    | OpenClaw      |           |
|  +-------+-------+    +-------+-------+           |
|          |                     |                    |
|          +----------+----------+                    |
|                     v                               |
|  +------------------------------------------+     |
|  | Pi SDK Agent Core                         |     |
|  | pi-ai (multi-provider LLM)                |     |
|  | pi-agent-core (tool loop, state, stream)  |     |
|  | Model-agnostic: Claude, GPT, Gemini, etc  |     |
|  +---------------------+--------------------+     |
|                         v                           |
|  +------------------------------------------+     |
|  | @sipher/sdk                               |     |
|  | Vault operations, policy engine,          |     |
|  | multi-platform adapters                   |     |
|  +---------------------+--------------------+     |
|                         v                           |
|  +------------------------------------------+     |
|  | @sip-protocol/sdk                         |     |
|  | Stealth addresses, Pedersen commitments,  |     |
|  | Viewing keys, encryption                  |     |
|  +---------------------+--------------------+     |
|                         v                           |
|  +------------------------------------------+     |
|  | PDA Vault (On-chain Solana Program)       |     |
|  | Single vault = natural mixer              |     |
|  | Auto-refund (configurable, default 24h)   |     |
|  | Multi-token (any SPL token)               |     |
|  | Fee collection (configurable)             |     |
|  | Compliance-ready (viewing key hooks)      |     |
|  +------------------------------------------+     |
|                                                    |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  SIP PROTOCOL — THE PRIVACY STANDARD              |
|  Chain-agnostic · Settlement-agnostic              |
|  7,500+ tests · Mainnet deployed                   |
+--------------------------------------------------+
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Agent framework | Pi SDK (pi-ai, pi-agent-core, pi-web-ui) | Model-agnostic, OpenClaw-compatible, composable |
| Privacy engine | @sip-protocol/sdk | Production-proven, 7,500+ tests |
| On-chain vault | Solana program (Anchor/native) | PDA-controlled, non-custodial |
| Web interface | pi-web-ui + wallet adapter | Chat-first UX |
| Language | TypeScript | Ecosystem consistency |
| Testing | Vitest | Ecosystem consistency |

---

## 5. PDA Vault Design

### Core Concept

A single program-controlled vault (PDA) where all users deposit. The vault acts as a natural mixer — funds from many users pool together, breaking the on-chain link between depositor and eventual recipient.

**Critical:** No private key. The vault is a PDA controlled by the Sipher program. SIP team never has custody.

### Vault Operations

| Operation | Description |
|-----------|-------------|
| **Deposit** | User sends any SPL token to the vault PDA. Amount recorded in deposit PDA account. |
| **Private Send** | Vault sends to a stealth address. Pedersen commitment hides amount. Viewing key generated. |
| **Private Swap** | Route through Jupiter to stealth output ATA. Already proven on mainnet. |
| **Refund** | User requests refund OR auto-refund triggers after configurable timeout (default 24h). |
| **Withdraw** | User claims funds from stealth address (existing SIP claim flow). |

### Auto-Refund Mechanism

- Configurable per-deposit timeout (default: 24 hours)
- If no action taken on deposited funds within timeout, program automatically returns to depositor
- User can also request immediate refund at any time
- Signal to users and regulators: "We don't hold your funds"
- Implemented as a cranked instruction (anyone can trigger after timeout expires)

### Token Support

- Accept any SPL token (SOL wrapped as WSOL)
- Users pay token account rent on first deposit of a new token type
- Token accounts persist for reuse (not closed on refund unless user requests)
- Rent refund available if user explicitly closes their token account

### Fee Model

- **Recommended:** 0.1% per private transaction (10x cheaper than competitors)
- **Alternative:** 0% up to $10K volume per wallet, then 0.1% (growth hook)
- Fee collected in the transacted token
- Fee accumulates in a separate PDA, withdrawable by program authority
- Configurable by program authority (can adjust post-launch)

---

## 6. Agent Interface (Pi SDK)

### SIP Tools (registered in pi-agent-core)

```typescript
// Core privacy tools the agent can execute
const sipTools = {
  deposit:     { /* Accept token deposit into vault */ },
  send:        { /* Private send via stealth address */ },
  swap:        { /* Private swap via Jupiter + stealth */ },
  refund:      { /* Return deposited funds to user */ },
  balance:     { /* Check vault balance for user */ },
  scan:        { /* Scan for incoming stealth payments */ },
  claim:       { /* Claim received stealth payment */ },
  viewingKey:  { /* Generate/export viewing key for compliance */ },
  history:     { /* Show private transaction history */ },
  status:      { /* Vault status, refund timer, etc */ },
}
```

### Conversation Examples

```
User: "Send 100 USDC to 0xAbc privately"
Sipher: Stealth address generated for 0xAbc.
        Sending 100 USDC from your vault balance.
        TX: 4Hc3v...5s5c
        Viewing key saved. Share it with auditors if needed.

User: "What's in my vault?"
Sipher: Your vault balance:
        · 450 USDC
        · 2.3 SOL
        · 10,000 BONK
        Auto-refund in: 18h 42m

User: "Swap 1 SOL to USDC privately"
Sipher: Routing via Jupiter. Best quote: 1 SOL → 142.50 USDC
        Output goes to a stealth address.
        Confirm? [Yes / No]
```

### Multi-Platform Adapters

| Platform | Adapter | Status |
|----------|---------|--------|
| Web chat | pi-web-ui | Phase 1 |
| Telegram | Custom adapter (pi-agent-core event routing) | Phase 2 |
| X/Twitter | X API v2 + agent adapter | Phase 2 |
| Discord | Custom adapter | Phase 2 |
| SDK/API | REST + WebSocket | Phase 2 (evolve current Sipher API) |
| MCP Skill | Tool definitions export | Phase 2 |

---

## 7. Compliance Layer

### Viewing Keys (SIP Native)

Every private transaction generates a viewing key. Users can:
- Keep it private (full privacy)
- Share with auditors (compliant privacy)
- Export for tax reporting

### Privacy Pools / Association Sets (Phase 3)

Inspired by Vitalik Buterin et al.'s Privacy Pools paper and 0xbow implementation:
- Users can prove their deposit belongs to a "clean" association set
- ZK proof of non-association with sanctioned addresses
- Compatible with existing regulatory frameworks
- Addresses the Tornado Cash legal precedent directly

### Positioning

"Compliant privacy, not a dark pool."
- Tornado Cash: privacy with zero compliance → sanctioned
- Cloak: privacy with zero compliance → risky
- Sipher: privacy with viewing keys + association sets → sustainable

---

## 8. Competitive Landscape

### Direct Competitors (Colosseum Corpus)

| Project | Approach | Prize/Acc | What Sipher Does Differently |
|---------|----------|-----------|------------------------------|
| Cloak | Pool mixing + miner anonymity | 3rd Stablecoins, C4 Acc | Compliance (viewing keys), agent interface, multi-token |
| Solana Mixer | Fixed-denomination ZK mixer | None | Any amount, any token, agent-first, auto-refund |
| Encifher | Encrypted DeFi actions | 3rd DeFi | Universal plug (not DeFi-only), agent + human |
| Blackpool/DARKLAKE | ZK DEX (MEV-focused) | 2nd DeFi, C2 Acc | Privacy middleware (not just DEX), compliance |
| Bagel | Stealth address wallet | 5th Stablecoins | Agent-first, vault mixer, multi-platform |

### Sipher's Moat (Stacked)

No single feature is unique. The combination is:
1. Viewing keys (compliance) — nobody else has this
2. PDA vault (natural mixer) — non-custodial, program-controlled
3. Any token, any amount — vs fixed denominations
4. Auto-refund — trust signal, custody minimization
5. Agent-first (Pi SDK) — conversational UX
6. Dual-mode (human + agent plug) — universal interface
7. Production SIP SDK underneath — 7,500+ tests, mainnet program

### Cluster Data

260 projects in "Solana Privacy and Identity Management" cluster. Privacy is crowded. Agent + privacy intersection is nearly empty.

---

## 9. Roadmap

### Phase 1 — Foundation (Frontier Hackathon window: Apr 6 - May 11, 2026)

- [ ] PDA vault program (deposit, withdraw, auto-refund, fee collection)
- [ ] @sipher/sdk core (vault operations, tool definitions)
- [ ] Pi SDK agent with SIP tools
- [ ] Web chat interface (pi-web-ui + wallet connect)
- [ ] Private send via stealth address
- [ ] Private swap via Jupiter + stealth output
- [ ] Viewing key generation
- [ ] Basic refund flow (manual + auto-refund timer)

### Phase 2 — Multi-Platform (Q2 2026)

- [ ] Telegram bot adapter
- [ ] X/Twitter agent integration
- [ ] REST API (evolve current Sipher 71 endpoints)
- [ ] MCP skill export (agent plug)
- [ ] Discord adapter
- [ ] Transaction history + privacy score

### Phase 3 — Advanced Privacy (Q3 2026)

- [ ] Privacy Pools / association sets (0xbow-style)
- [ ] Policy engine (automated privacy rules)
- [ ] Multi-chain vault (EVM chains via SIP EVM contracts)
- [ ] Privacy analytics dashboard
- [ ] Enterprise compliance suite (bulk viewing keys, audit export)

### Phase 4 — Standard Adoption (Q4 2026+)

- [ ] OpenClaw native integration
- [ ] Wallet SDK (embed Sipher in Phantom/Backpack)
- [ ] SIP-EIP standard proposal backed by Sipher volume data
- [ ] Multi-chain agent (EVM, NEAR, Bitcoin)
- [ ] Governance token / incentive model

---

## 10. Success Metrics

### North Star

SIP standard adoption, measured by transaction volume flowing through Sipher.

### Phase 1 Targets

| Metric | Target |
|--------|--------|
| Vault TVL | $10K+ in deposits |
| Private transactions | 100+ |
| Unique wallets | 50+ |
| Hackathon result | Prize or accelerator selection |

### Long-term Targets (12 months)

| Metric | Target |
|--------|--------|
| Monthly volume | $1M+ in private transactions |
| MAU | 1,000+ unique wallets |
| Agent integrations | 10+ agents using Sipher plug |
| Chains supported | 3+ (Solana, Ethereum, 1 L2) |

---

## 11. Open Questions

1. **Fee model finalization** — 0.1% flat vs tiered vs free-tier-then-paid?
2. **Vault vanity address** — specific vanity pattern? (e.g., `S1PHER...`)
3. **Privacy Pools timeline** — Phase 3, but should association set research start earlier?
4. **Token allowlist** — accept ALL SPL tokens from day 1, or curated list?
5. **Sipher repo structure** — revamp existing `sip-protocol/sipher` repo or new repo?
6. **Legal review** — at what point do we need a legal opinion on the mixer model?

---

## 12. References

- [Privacy Pools paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364) — Vitalik Buterin et al.
- [a16z: Privacy-Protecting Regulatory Solutions](https://a16zcrypto.com/posts/article/privacy-protecting-regulatory-solutions-using-zero-knowledge-proofs-full-paper) — Burleson, Korver, Boneh
- [a16z: Agency by Design](https://a16zcrypto.com/posts/article/agency-by-design) — agent sovereignty framework
- [Pi SDK monorepo](https://github.com/badlogic/pi-mono) — agent framework
- [How to Build with PI](https://nader.substack.com/p/how-to-build-a-custom-agent-framework) — Nader Dabit
- [Chainalysis: Tornado Cash Sanctions](https://www.chainalysis.com/) — regulatory context
- [Colosseum Frontier](https://colosseum.com/frontier) — hackathon (Apr 6 - May 11, 2026)
