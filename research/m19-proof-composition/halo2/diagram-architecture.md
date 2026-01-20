# Halo2 Architecture Diagrams

## 1. High-Level System Overview

```
                              HALO2 PROOF SYSTEM
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   CIRCUIT LAYER                    COMMITMENT LAYER                     │
│  ┌─────────────────────┐          ┌─────────────────────┐              │
│  │    PLONKish         │          │   Inner Product     │              │
│  │   Arithmetization   │─────────▶│    Argument (IPA)   │              │
│  │                     │          │                     │              │
│  │  • Fixed columns    │          │  • Pedersen-based   │              │
│  │  • Advice columns   │          │  • No trusted setup │              │
│  │  • Instance columns │          │  • O(n) commitment  │              │
│  │  • Custom gates     │          │  • O(log n) open    │              │
│  └─────────────────────┘          └──────────┬──────────┘              │
│                                              │                          │
│                                              ▼                          │
│                              ┌─────────────────────────┐               │
│                              │    ACCUMULATION         │               │
│                              │       SCHEME            │               │
│                              │                         │               │
│                              │  • Deferred verify      │               │
│                              │  • Recursive compose    │               │
│                              │  • Pasta curve cycle    │               │
│                              └──────────┬──────────────┘               │
│                                         │                               │
│                                         ▼                               │
│                              ┌─────────────────────────┐               │
│                              │      FINAL PROOF        │               │
│                              │   (~1.5KB, trustless)   │               │
│                              └─────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. PLONKish Circuit Matrix

```
          COLUMNS
          ├────────────────────────────────────────────────────┤
          │                                                    │
          │  Instance    Advice     Advice     Fixed    Selector
          │  (public)   (witness)  (witness)  (const)   (gate)
          │
    R  0  │    x₀         a₀         b₀         c₀        s₀
    O     │    ▲          ▲          ▲          ▲         ▲
    W  1  │    │          │          │          │         │
    S     │  Verifier   Prover    Prover    Circuit   Circuit
       2  │  provides   provides  provides  defines   defines
          │
       .  │    ─────────────────────────────────────────────
       .  │              CONSTRAINT EXAMPLE:
       .  │              s₀ · (a₀ · b₀ - c₀) = 0
          │              (multiplication gate)
     n-1  │    xₙ₋₁       aₙ₋₁       bₙ₋₁       cₙ₋₁      sₙ₋₁
          │
          └────────────────────────────────────────────────────┘
                         n = 2^k rows (power of 2)
```

## 3. IPA Polynomial Commitment

```
    POLYNOMIAL                      COMMITMENT

    p(X) = a₀ + a₁X + a₂X² + ...   ──────────────▶   C = ⟨a, G⟩ + [r]W


    VECTOR FORM:

    a = [a₀, a₁, a₂, ..., aₙ₋₁]    coefficients
    G = [G₀, G₁, G₂, ..., Gₙ₋₁]    generators (public)
    r = random blinding factor
    W = blinding generator


    COMMITMENT COMPUTATION:

    C = a₀·G₀ + a₁·G₁ + a₂·G₂ + ... + aₙ₋₁·Gₙ₋₁ + r·W
        └──────────────────┬──────────────────────┘   └──┬──┘
                   inner product ⟨a,G⟩              blinding
```

## 4. Accumulation Scheme (Recursion)

```
    TRADITIONAL RECURSION              HALO2 ACCUMULATION
    (expensive)                        (efficient)

    ┌─────────┐                        ┌─────────┐
    │ Proof 1 │                        │ Proof 1 │
    └────┬────┘                        └────┬────┘
         │                                  │
         ▼                                  ▼
    ┌─────────────┐                   ┌──────────┐
    │ Verify in   │                   │Accumulate│──▶ Acc₁
    │ circuit     │                   └────┬─────┘
    │ (expensive) │                        │
    └─────────────┘                        ▼
         │                            ┌─────────┐
         ▼                            │ Proof 2 │
    ┌─────────┐                       └────┬────┘
    │ Proof 2 │                            │
    └────┬────┘                            ▼
         │                            ┌──────────┐
         ▼                            │Accumulate│──▶ Acc₂
    ┌─────────────┐                   │with Acc₁ │
    │ Verify in   │                   └────┬─────┘
    │ circuit     │                        │
    └─────────────┘                        ▼
         │                                 ...
         ▼                                  │
        ...                                 ▼
                                     ┌──────────────┐
    COST: O(n) per proof             │ FINAL VERIFY │
                                     │  (once only) │
                                     └──────────────┘

                                     COST: O(log n) amortized
```

## 5. Pasta Curve Cycle

```
                    PALLAS CURVE                      VESTA CURVE

                    y² = x³ + 5                       y² = x³ + 5
                    over Fp                           over Fq

                    ┌───────────┐                    ┌───────────┐
                    │           │                    │           │
                    │  PALLAS   │◀───────────────────│   VESTA   │
                    │           │   Fq = scalar      │           │
                    │ Base: Fp  │   field of Pallas  │ Base: Fq  │
                    │ Scalar:Fq │                    │ Scalar:Fp │
                    │           │───────────────────▶│           │
                    └───────────┘   Fp = scalar      └───────────┘
                                    field of Vesta


    RECURSION PATTERN:

    Round 1: Prove on Pallas  ──▶  commitment lives on Vesta
    Round 2: Prove on Vesta   ──▶  commitment lives on Pallas
    Round 3: Prove on Pallas  ──▶  commitment lives on Vesta
    ...

    This cycle enables efficient recursive proof composition!
```

## 6. Custom Gates

```
    STANDARD GATE (multiplication):

    ┌─────┬─────┬─────┬─────┐
    │  a  │  b  │  c  │  s  │
    ├─────┼─────┼─────┼─────┤
    │  3  │  4  │ 12  │  1  │  ◀── s · (a · b - c) = 1 · (3·4 - 12) = 0 ✓
    │  2  │  5  │ 10  │  1  │  ◀── s · (a · b - c) = 1 · (2·5 - 10) = 0 ✓
    │  x  │  y  │  z  │  0  │  ◀── s · (a · b - c) = 0 · (...) = 0 ✓ (disabled)
    └─────┴─────┴─────┴─────┘


    CUSTOM GATE (2-bit range check):

    ┌─────┬─────────┐
    │  a  │ s_range │
    ├─────┼─────────┤
    │  0  │    1    │  ◀── s · a(a-1)(a-2)(a-3) = 1 · 0·(-1)·(-2)·(-3) = 0 ✓
    │  2  │    1    │  ◀── s · a(a-1)(a-2)(a-3) = 1 · 2·1·0·(-1) = 0 ✓
    │  5  │    1    │  ◀── s · a(a-1)(a-2)(a-3) = 1 · 5·4·3·2 = 120 ✗ FAIL
    └─────┴─────────┘

    Custom gates enable efficient range checks, lookups, etc.
```

## 7. Proof Composition for SIP

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SIP COMPOSED PROOF                               │
│                                                                         │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │  SIP VALIDITY   │  │  ZCASH PRIVACY  │  │ MINA SUCCINCT   │        │
│   │    (Noir)       │  │    (Halo2)      │  │   (Kimchi)      │        │
│   │                 │  │                 │  │                 │        │
│   │ • Amount valid  │  │ • Sender hidden │  │ • Light client  │        │
│   │ • Intent auth   │  │ • Amount hidden │  │ • State proof   │        │
│   │ • Nullifier ok  │  │ • Shielded pool │  │ • Verification  │        │
│   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘        │
│            │                    │                    │                  │
│            │         ┌──────────┴──────────┐         │                  │
│            │         │                     │         │                  │
│            └────────▶│  HALO2 ACCUMULATOR  │◀────────┘                  │
│                      │                     │                            │
│                      │  • Combines proofs  │                            │
│                      │  • Single verify    │                            │
│                      │  • Trustless        │                            │
│                      └──────────┬──────────┘                            │
│                                 │                                       │
│                                 ▼                                       │
│                      ┌─────────────────────┐                           │
│                      │   COMPOSED PROOF    │                           │
│                      │                     │                           │
│                      │  Privacy + Validity │                           │
│                      │  + Light Client     │                           │
│                      │  = UNIQUE MOAT      │                           │
│                      └─────────────────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8. Verification Flow

```
                         HALO2 VERIFICATION FLOW

    INPUT: Proof π, Public input x, Verification key vk

    ┌─────────────────────────────────────────────────────────────┐
    │ 1. RECONSTRUCT POLYNOMIAL EVALUATIONS                       │
    │    • Parse commitments from proof                           │
    │    • Extract evaluation points                              │
    └────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ 2. COMBINE COMMITMENTS                                      │
    │    • Challenge-weighted linear combination                  │
    │    • Multi-scalar multiplication                            │
    └────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ 3. CHECK VANISHING POLYNOMIAL                               │
    │    • Schwartz-Zippel lemma                                  │
    │    • Constraint satisfaction at random point                │
    └────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ 4. VERIFY FINAL EQUATION                                    │
    │                                                             │
    │    Σ[u_(j-1)]·Lⱼ + P' + Σ[uⱼ]·Rⱼ = [c]·G'₀ + [c·b₀·z]·U + [f]·W │
    │                                                             │
    └────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ OUTPUT: Accept / Reject                                     │
    └─────────────────────────────────────────────────────────────┘
```
