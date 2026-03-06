# Jupiter UX Adaptation Design for SIP Mobile

**Date:** 2026-03-06
**Scope:** Structural (8-10 changes)
**Approach:** 3 tabs + sidebar (Jupiter clone navigation)
**Target:** sip-protocol/sip-mobile
**Reference:** Jupiter Mobile v2.31.0 on Solana Seeker (54 screenshots captured via ADB)

---

## Background

Reverse-engineered Jupiter Mobile's complete UX via ADB screenshots on Solana Seeker device. Identified key gaps between Jupiter's polished trading wallet and SIP Mobile's privacy wallet. This design adapts Jupiter's best UX patterns while preserving SIP's privacy-first identity.

### Research Summary

- 54 screenshots captured across all Jupiter screens
- Full UI pattern catalog documented in `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/jupiter-mobile-ux-research.md`
- Gap analysis completed across 7 categories (home, wallet management, send, receive, token detail, navigation, onboarding)

### Key Jupiter Patterns to Adopt

1. 3-tab navigation with sidebar for secondary features
2. Numpad input with MAX/75%/50%/CLEAR presets (shared by Send and Swap)
3. Hidden balances by default (****** pattern)
4. Token detail pages with chart + stats + actions
5. Emoji avatar for account personalization
6. Branded QR codes
7. Quick actions on home (Send/Receive/Scan icons)

### SIP Advantages to Preserve

- Privacy level selection on every send
- Stealth address generation with safety checks
- 5-slide educational onboarding
- Request amount QR codes
- Multi-provider privacy backends
- Viewing keys for compliance
- Seed Vault hardware security

---

## 1. Navigation Architecture

### Bottom Tabs (3)

| Tab | Icon | Purpose | Maps to Jupiter |
|-----|------|---------|-----------------|
| **Home** | House | Portfolio, balances, quick actions, token list | Account tab |
| **Privacy** | Shield | Scan, Claim, Viewing Keys, Compliance, Privacy Score | SIP unique (replaces Pro) |
| **Swap** | Arrows | Jupiter DEX with privacy toggle | Trade tab |

### Sidebar (avatar tap from Home)

Slides from left, partially transparent overlay (like Jupiter). Accessible from Home tab via avatar icon in top-left.

#### Sidebar Structure

```
+-------------------------------+
| [Avatar] Nickname             |
| 7xK9...3fGh [copy]  [Switch] |
|-------------------------------|
| ACCOUNT                       |
|   Manage                      |
|   History                     |
|   Viewing Keys                |
|   Security & Backup           |
|-------------------------------|
| NETWORK                       |
|   Network (Devnet)            |
|   RPC Provider (Helius)       |
|-------------------------------|
| ABOUT                         |
|   About SIP                   |
|   Documentation               |
|   Report Issue                |
|-------------------------------|
| [Get Help]       [Settings]   |
+-------------------------------+
```

### What Moves Where

| Current Location | New Location |
|-----------------|--------------|
| Send tab | Home quick action + full-screen push |
| Receive tab | Home quick action + full-screen push |
| Settings tab | Eliminated - items split to sidebar + Privacy tab |
| History (deep nav) | Sidebar (1 tap) |
| Accounts (Settings > Accounts) | Sidebar > Manage |
| Privacy features (scattered) | Privacy tab (consolidated) |

### File Changes

- `app/(tabs)/_layout.tsx` - Reduce to 3 tabs
- `app/(tabs)/send.tsx` - Move to `app/send.tsx` (stack screen)
- `app/(tabs)/receive.tsx` - Move to `app/receive.tsx` (stack screen)
- `app/(tabs)/settings.tsx` - Delete (redistribute to sidebar)
- New: `app/(tabs)/privacy.tsx` - Privacy hub tab
- New: `components/Sidebar.tsx` - Drawer component
- New: `components/SidebarProvider.tsx` - Context for sidebar state

---

## 2. Home Screen Overhaul

### Top Bar

```
[Avatar]  Wallet    [Search]  [Scan]
```

- Avatar (left) - tappable, opens sidebar
- "Wallet" label (center)
- Search icon - token search
- Scan icon - QR scanner

### Balance Area

```
        Main Wallet
         ******
       [eye toggle]

  [Send]  [Receive]  [Scan]
```

- Balance hidden by default (tap eye to reveal)
- Three quick action circle icons below balance
- Send/Receive push full-screen routes

### Unclaimed Banner (conditional)

Green banner when unclaimed payments exist. Tap navigates to Privacy > Claim.

### Privacy Stats Row

```
PnL  [lock] 3 private  [chart] Score 78%   >
```

Replaces Jupiter's PnL row with privacy-relevant metrics. Tap opens Privacy tab.

### Token List

Each row: icon + name + verified badge + 24h % change + hidden balance + ticker

- Tap row opens Token Detail page
- Balances respect hide toggle
- "Manage Tokens" link at bottom

### File Changes

- `app/(tabs)/index.tsx` - Rewrite home screen layout
- New: `components/BalanceCard.tsx` - Balance display with hide toggle
- New: `components/QuickActions.tsx` - Send/Receive/Scan icons
- New: `components/TokenRow.tsx` - Token list row (tappable)
- New: `components/PrivacyStatsRow.tsx` - Privacy metrics summary

---

## 3. NumpadInput Component

Shared reusable component for Send and Swap screens. Replaces TextInput + system keyboard.

### Layout

```
       [Token] SOL  v          <- token selector
          0                    <- large amount
        $0.00  [swap]          <- USD equiv + toggle
      [ 30.197 SOL ]           <- balance pill

      [ Enter Amount ]         <- CTA button

  +------+------+------+------+
  | MAX  |  1   |  2   |  3   |
  | 75%  |  4   |  5   |  6   |
  | 50%  |  7   |  8   |  9   |
  |CLEAR |  .   |  0   |  <x  |
  +------+------+------+------+
```

### Behavior

- MAX/75%/50% - calculate from balance, fill amount
- CLEAR - reset to 0
- Backspace - remove last digit
- CTA changes: "Enter Amount" -> "Send"/"Swap" when amount > 0
- USD toggle: tap swap icon to input in USD (converts real-time)
- Numpad always visible (no keyboard overlap)
- Decimal limited to token's decimals (9 for SOL, 6 for USDC)

### Component API

```typescript
interface NumpadInputProps {
  token: Token
  balance: number
  onAmountChange: (amount: number) => void
  ctaLabel: string              // "Send" or "Swap"
  ctaDisabledLabel?: string     // "Enter Amount"
  onCtaPress: () => void
  disabled?: boolean
}
```

### File Changes

- New: `components/NumpadInput.tsx` - Main numpad component
- New: `components/NumpadKey.tsx` - Individual key with haptic feedback
- `app/send.tsx` - Replace TextInput with NumpadInput
- `app/(tabs)/swap.tsx` - Replace "from" TextInput with NumpadInput

---

## 4. Token Detail Page

New screen at `app/token/[mint].tsx`. Opens when tapping any token row on Home.

### Layout

```
[<-]  [icon] SOL [verified]   [star] [share] [...]
      So11111...112  [copy]

      $87.25
      -$4.07  -4.4%

+----------+-----------+---------+----------+
| Mkt Cap  | Liquidity | Holders | Privacy  |
| $49.7B   | $646.2M   | 3.82M   | *****    |
+----------+-----------+---------+----------+

  Time  1H  1D  1W  1M  YTD
+--------------------------------+
|        Price Chart              |
+--------------------------------+

  Overview    Activity

+-- Position ----------- Share --+
|  ***** SOL          *****      |
|  ***** SOL         -25.4%     |
+--------------------------------+

===================================
  [Send]    [Sell]    [+ Buy]
===================================
```

### Key Decisions

- **Privacy Score** replaces Jupiter's "Org. Score" - shows token's privacy rating
- **Activity tab** instead of "Terminal"/"Live Feed" - user's tx history for this token
- **Chart library** - react-native-wagmi-charts (lightweight, Reanimated-based, Expo compatible)
- **Price data** - Jupiter Price API (already integrated)
- **Send** routes to Send pre-filled, **Sell/Buy** route to Swap pre-filled
- Balances respect hide toggle

### NOT Including (YAGNI)

- No "Earn with X" section
- No "Verified News" feed
- No Terminal/Live Feed tabs
- No perps/limit orders

### File Changes

- New: `app/token/[mint].tsx` - Token detail screen
- New: `components/PriceChart.tsx` - Chart with time filters
- New: `components/TokenStats.tsx` - Stats grid (Mkt Cap, Liquidity, etc.)
- New: `components/PositionCard.tsx` - User's position display

---

## 5. Hide Balance Toggle

### Behavior

- New `hideBalances` boolean in `useSettingsStore` (persisted via AsyncStorage)
- Eye icon on Home balance area toggles it
- Default: **hidden** on first launch (privacy wallet should default to private)
- When hidden: all amounts show `******` globally:
  - Home balance
  - Token list balances
  - Token detail position
  - Send balance pill
  - Swap balances

### File Changes

- `stores/settings.ts` - Add `hideBalances` field + `toggleHideBalances` action
- All balance display components - Respect `hideBalances` state

---

## 6. Branded QR Code

### Change

Add SIP shield logo to center of QR code on Receive screen. Use `react-native-qrcode-svg`'s `logo` prop (library already in use).

- White padding around logo for scan reliability
- Logo size: ~20% of QR code width

### File Changes

- `app/receive.tsx` - Add `logo` and `logoSize` props to QRCode component
- Need: SIP logo asset as PNG in `assets/`

---

## 7. Account Avatar/Emoji

### Change

Add `emoji` field to `StoredAccount` type. Default: random emoji from curated wallet set.

Curated set (16 emojis): wallet-themed, fun, distinct at small sizes.

### Display Locations

- Sidebar header (large)
- Home top-left avatar button (medium)
- Manage Account screen (large, tappable to change)

### File Changes

- `types/index.ts` - Add `emoji` field to `StoredAccount`
- `stores/wallet.ts` - Default emoji on account creation, update emoji action
- New: `components/AccountAvatar.tsx` - Reusable avatar component
- `app/settings/accounts.tsx` - Show emoji in account cards

---

## 8. Send Screen Refactor

### Changes

- Replace TextInput + system keyboard with `<NumpadInput>` component
- Add **Address / Stealth** toggle tabs at top (like Jupiter's Address / Magic Link)
- Add clock icon for recent addresses (from contacts store)
- Privacy level selector stays (SIP advantage)
- Confirmation modal stays (SIP's progress steps are better than Jupiter's inline)
- Screen moves from tab to stack push (`app/send.tsx`)

### File Changes

- `app/send.tsx` (moved from `app/(tabs)/send.tsx`) - Refactored with NumpadInput
- Reuse `<NumpadInput>` component

---

## 9. History Promotion

### Changes

- Accessible from sidebar (1 tap from anywhere)
- Also accessible from Home via link below privacy stats row
- Keep existing filter/search functionality
- Screen moves from deep nav to `app/history/index.tsx` (stack push from sidebar)

### File Changes

- Sidebar links to existing history screen
- Home adds "View History >" link

---

## Summary of All New/Modified Files

### New Files (~12)

```
components/
  Sidebar.tsx
  SidebarProvider.tsx
  NumpadInput.tsx
  NumpadKey.tsx
  BalanceCard.tsx
  QuickActions.tsx
  TokenRow.tsx
  PrivacyStatsRow.tsx
  PriceChart.tsx
  TokenStats.tsx
  PositionCard.tsx
  AccountAvatar.tsx

app/
  token/[mint].tsx
  send.tsx (moved from tabs)
  receive.tsx (moved from tabs)
  (tabs)/privacy.tsx
```

### Modified Files (~8)

```
app/(tabs)/_layout.tsx    - 3 tabs
app/(tabs)/index.tsx      - Home overhaul
app/(tabs)/swap.tsx       - NumpadInput
stores/settings.ts        - hideBalances
stores/wallet.ts          - emoji field
types/index.ts            - StoredAccount emoji
app/settings/accounts.tsx - Avatar display
app/receive.tsx           - Branded QR
```

### Deleted Files (~2)

```
app/(tabs)/send.tsx       - Moved to app/send.tsx
app/(tabs)/settings.tsx   - Eliminated
```

---

## Testing Strategy

- Unit tests for NumpadInput (amount calculations, MAX/75%/50%, decimal limits)
- Unit tests for hideBalances store logic
- Unit tests for Sidebar navigation links
- Component tests for TokenRow, BalanceCard, AccountAvatar
- Integration test for Send flow with NumpadInput
- Snapshot tests for Token Detail page layout
- Target: maintain 80%+ coverage on new code

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Navigation refactor breaks deep links | Map old routes to new locations, test all navigation paths |
| Numpad UX unfamiliar to users | Same pattern as Jupiter (1.1M users), proven in production |
| Chart library performance | react-native-wagmi-charts is lightweight, Reanimated-based |
| Price API rate limits | Jupiter Price API already integrated, add caching layer |
| Large diff size | Break into sequential PRs: navigation first, then screens, then polish |
