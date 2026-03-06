# Jupiter UX Adaptation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adapt Jupiter Mobile's best UX patterns into SIP Mobile — 3-tab navigation with sidebar, numpad input, token detail pages, hide balance, and polish.

**Architecture:** Restructure from 5 tabs to 3 tabs (Home/Privacy/Swap) + sidebar drawer. Send and Receive become stack-pushed screens from Home quick actions. New shared NumpadInput component replaces TextInput for amounts. Token detail page added at `app/token/[mint].tsx`.

**Tech Stack:** Expo Router 6, NativeWind 4, Zustand 5, Phosphor icons, react-native-qrcode-svg, react-native-wagmi-charts (new), Vitest

**Design Doc:** `docs/plans/2026-03-06-jupiter-ux-adaptation-design.md`

**Target Repo:** `/Users/rector/local-dev/sip-mobile`

---

## Task Sequence

| # | Task | Depends On | PR |
|---|------|------------|----|
| 1 | Store & type foundations | — | PR1 |
| 2 | AccountAvatar component | 1 | PR1 |
| 3 | NumpadInput component | — | PR2 |
| 4 | Sidebar component | 1, 2 | PR3 |
| 5 | Navigation restructure (3 tabs) | 4 | PR4 |
| 6 | Home screen overhaul | 1, 5 | PR5 |
| 7 | Send screen refactor | 3, 5 | PR6 |
| 8 | Token detail page | 1, 5 | PR7 |
| 9 | Polish (branded QR, swap numpad, history link) | 3, 5 | PR8 |

---

### Task 1: Store & Type Foundations

**Files:**
- Modify: `/Users/rector/local-dev/sip-mobile/src/types/index.ts`
- Modify: `/Users/rector/local-dev/sip-mobile/src/stores/settings.ts`
- Modify: `/Users/rector/local-dev/sip-mobile/src/stores/wallet.ts`
- Test: `/Users/rector/local-dev/sip-mobile/tests/stores/settings.test.ts`
- Test: `/Users/rector/local-dev/sip-mobile/tests/stores/wallet.test.ts`

**Step 1: Add `emoji` field to StoredAccount type**

In `src/types/index.ts`, find the `StoredAccount` interface and add:

```typescript
export interface StoredAccount {
  id: string
  address: string
  nickname: string
  emoji: string           // <-- ADD: emoji avatar for account personalization
  providerType: string
  chain: ChainType
  createdAt: number
  lastUsedAt: number
}
```

**Step 2: Add `hideBalances` to settings store**

In `src/stores/settings.ts`, add to the state interface and initial state:

```typescript
// Add to state interface
hideBalances: boolean

// Add to initial state
hideBalances: true,  // Privacy wallet defaults to hidden

// Add action
toggleHideBalances: () => set((state) => ({ hideBalances: !state.hideBalances })),
```

Add `hideBalances` to the `partialize` function so it persists.

**Step 3: Add emoji utilities to wallet store**

In `src/stores/wallet.ts`, add:

```typescript
const WALLET_EMOJIS = [
  "\u{1F60E}", "\u{1F525}", "\u{1F680}", "\u{1F31F}", "\u{1F48E}",
  "\u{1F3AF}", "\u{26A1}", "\u{1F30A}", "\u{1F340}", "\u{1F9E0}",
  "\u{1F3C6}", "\u{2728}", "\u{1F4AB}", "\u{1F308}", "\u{1F381}", "\u{1F6E1}"
]

export const getRandomEmoji = () =>
  WALLET_EMOJIS[Math.floor(Math.random() * WALLET_EMOJIS.length)]
```

Update `addAccount` action to include default emoji:

```typescript
addAccount: (account: Omit<StoredAccount, 'emoji'> & { emoji?: string }) =>
  set((state) => ({
    accounts: [...state.accounts, {
      ...account,
      emoji: account.emoji || getRandomEmoji(),
    }],
  })),
```

Add `updateAccountEmoji` action:

```typescript
updateAccountEmoji: (id: string, emoji: string) =>
  set((state) => ({
    accounts: state.accounts.map((a) =>
      a.id === id ? { ...a, emoji } : a
    ),
  })),
```

**Step 4: Write tests for hideBalances**

In `tests/stores/settings.test.ts`, add:

```typescript
describe("hideBalances", () => {
  it("should default to true (privacy wallet)", () => {
    const { hideBalances } = useSettingsStore.getState()
    expect(hideBalances).toBe(true)
  })

  it("should toggle hide balances", () => {
    const { toggleHideBalances } = useSettingsStore.getState()
    toggleHideBalances()
    expect(useSettingsStore.getState().hideBalances).toBe(false)
    toggleHideBalances()
    expect(useSettingsStore.getState().hideBalances).toBe(true)
  })
})
```

**Step 5: Write tests for account emoji**

In `tests/stores/wallet.test.ts`, add:

```typescript
describe("account emoji", () => {
  it("should assign random emoji on account creation", () => {
    const { addAccount } = useWalletStore.getState()
    addAccount({
      id: "test_1",
      address: "7xK9abc123",
      nickname: "Test",
      providerType: "native",
      chain: "solana",
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    })
    const account = useWalletStore.getState().accounts.find((a) => a.id === "test_1")
    expect(account?.emoji).toBeTruthy()
    expect(account?.emoji.length).toBeGreaterThan(0)
  })

  it("should update account emoji", () => {
    const { updateAccountEmoji } = useWalletStore.getState()
    updateAccountEmoji("test_1", "\u{1F680}")
    const account = useWalletStore.getState().accounts.find((a) => a.id === "test_1")
    expect(account?.emoji).toBe("\u{1F680}")
  })
})
```

**Step 6: Run tests**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/stores/settings.test.ts tests/stores/wallet.test.ts`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/types/index.ts src/stores/settings.ts src/stores/wallet.ts tests/stores/settings.test.ts tests/stores/wallet.test.ts
git commit -m "feat: add hideBalances toggle and account emoji support

Foundation for Jupiter UX adaptation — hideBalances defaults to true
(privacy wallet), account emoji for personalization."
```

---

### Task 2: AccountAvatar Component

**Files:**
- Create: `/Users/rector/local-dev/sip-mobile/src/components/AccountAvatar.tsx`
- Modify: `/Users/rector/local-dev/sip-mobile/src/components/index.ts`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/AccountAvatar.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react-native"
import { AccountAvatar } from "@/components/AccountAvatar"

describe("AccountAvatar", () => {
  it("renders emoji at default size", () => {
    const { getByText } = render(<AccountAvatar emoji="\u{1F680}" />)
    expect(getByText("\u{1F680}")).toBeTruthy()
  })

  it("renders at small size", () => {
    const { getByText } = render(<AccountAvatar emoji="\u{1F525}" size="sm" />)
    expect(getByText("\u{1F525}")).toBeTruthy()
  })

  it("renders at large size", () => {
    const { getByText } = render(<AccountAvatar emoji="\u{26A1}" size="lg" />)
    expect(getByText("\u{26A1}")).toBeTruthy()
  })

  it("renders fallback when no emoji", () => {
    const { getByText } = render(<AccountAvatar emoji="" />)
    expect(getByText("\u{1F464}")).toBeTruthy()
  })
})
```

**Step 2: Run test — expect FAIL**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/AccountAvatar.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement AccountAvatar**

Create `src/components/AccountAvatar.tsx`:

```typescript
import { View, Text, TouchableOpacity } from "react-native"

interface AccountAvatarProps {
  emoji: string
  size?: "sm" | "md" | "lg"
  onPress?: () => void
}

const SIZES = {
  sm: { container: "w-8 h-8 rounded-lg", text: "text-lg" },
  md: { container: "w-10 h-10 rounded-xl", text: "text-xl" },
  lg: { container: "w-16 h-16 rounded-2xl", text: "text-3xl" },
}

export function AccountAvatar({ emoji, size = "md", onPress }: AccountAvatarProps) {
  const s = SIZES[size]
  const displayEmoji = emoji || "\u{1F464}"

  const content = (
    <View className={`${s.container} bg-dark-800 items-center justify-center`}>
      <Text className={s.text}>{displayEmoji}</Text>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel="Account avatar">
        {content}
      </TouchableOpacity>
    )
  }

  return content
}
```

**Step 4: Export from barrel**

Add to `src/components/index.ts`:

```typescript
export { AccountAvatar } from "./AccountAvatar"
```

**Step 5: Run test — expect PASS**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/AccountAvatar.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/AccountAvatar.tsx src/components/index.ts tests/components/AccountAvatar.test.tsx
git commit -m "feat: add AccountAvatar component with emoji display"
```

---

### Task 3: NumpadInput Component

**Files:**
- Create: `/Users/rector/local-dev/sip-mobile/src/components/NumpadInput.tsx`
- Modify: `/Users/rector/local-dev/sip-mobile/src/components/index.ts`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/NumpadInput.test.tsx`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react-native"
import { NumpadInput } from "@/components/NumpadInput"

const defaultProps = {
  token: { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111", decimals: 9, logoUri: "" },
  balance: 30.197937674,
  onAmountChange: vi.fn(),
  ctaLabel: "Send",
  ctaDisabledLabel: "Enter Amount",
  onCtaPress: vi.fn(),
}

describe("NumpadInput", () => {
  it("renders with zero amount and disabled CTA", () => {
    const { getByText } = render(<NumpadInput {...defaultProps} />)
    expect(getByText("0")).toBeTruthy()
    expect(getByText("Enter Amount")).toBeTruthy()
  })

  it("enters digits", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("5"))
    expect(onAmountChange).toHaveBeenCalledWith(5)
  })

  it("handles decimal input", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("1"))
    fireEvent.press(getByText("."))
    fireEvent.press(getByText("5"))
    expect(onAmountChange).toHaveBeenLastCalledWith(1.5)
  })

  it("calculates MAX from balance", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("MAX"))
    expect(onAmountChange).toHaveBeenCalledWith(30.197937674)
  })

  it("calculates 75% from balance", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("75%"))
    const expected = Math.floor(30.197937674 * 0.75 * 1e9) / 1e9
    expect(onAmountChange).toHaveBeenCalledWith(expected)
  })

  it("calculates 50% from balance", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("50%"))
    const expected = Math.floor(30.197937674 * 0.5 * 1e9) / 1e9
    expect(onAmountChange).toHaveBeenCalledWith(expected)
  })

  it("clears amount", () => {
    const onAmountChange = vi.fn()
    const { getByText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("5"))
    fireEvent.press(getByText("CLEAR"))
    expect(onAmountChange).toHaveBeenLastCalledWith(0)
  })

  it("handles backspace", () => {
    const onAmountChange = vi.fn()
    const { getByText, getByLabelText } = render(
      <NumpadInput {...defaultProps} onAmountChange={onAmountChange} />
    )
    fireEvent.press(getByText("1"))
    fireEvent.press(getByText("2"))
    fireEvent.press(getByLabelText("Backspace"))
    expect(onAmountChange).toHaveBeenLastCalledWith(1)
  })

  it("shows CTA label when amount > 0", () => {
    const { getByText } = render(<NumpadInput {...defaultProps} />)
    fireEvent.press(getByText("5"))
    expect(getByText("Send")).toBeTruthy()
  })

  it("shows balance pill", () => {
    const { getByText } = render(<NumpadInput {...defaultProps} />)
    expect(getByText(/30\.197/)).toBeTruthy()
  })

  it("limits decimals to token decimals", () => {
    const onAmountChange = vi.fn()
    const props = {
      ...defaultProps,
      token: { ...defaultProps.token, decimals: 2 },
      onAmountChange,
    }
    const { getByText } = render(<NumpadInput {...props} />)
    fireEvent.press(getByText("1"))
    fireEvent.press(getByText("."))
    fireEvent.press(getByText("2"))
    fireEvent.press(getByText("3"))
    fireEvent.press(getByText("4")) // should be ignored (max 2 decimals)
    expect(onAmountChange).toHaveBeenLastCalledWith(1.23)
  })

  it("prevents amount exceeding balance", () => {
    const onAmountChange = vi.fn()
    const props = { ...defaultProps, balance: 5, onAmountChange }
    const { getByText } = render(<NumpadInput {...props} />)
    fireEvent.press(getByText("9"))
    fireEvent.press(getByText("9"))
    // Should cap or allow (validation in parent) — numpad allows entry, CTA validates
    expect(onAmountChange).toHaveBeenCalled()
  })
})
```

**Step 2: Run test — expect FAIL**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/NumpadInput.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement NumpadInput**

Create `src/components/NumpadInput.tsx`:

```typescript
import { useState, useCallback } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { BackspaceIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useSettingsStore } from "@/stores/settings"
import { hapticLight } from "@/utils/haptics"
import type { TokenInfo } from "@/types"

interface NumpadInputProps {
  token: TokenInfo
  balance: number
  onAmountChange: (amount: number) => void
  ctaLabel: string
  ctaDisabledLabel?: string
  onCtaPress: () => void
  disabled?: boolean
}

export function NumpadInput({
  token,
  balance,
  onAmountChange,
  ctaLabel,
  ctaDisabledLabel = "Enter Amount",
  onCtaPress,
  disabled = false,
}: NumpadInputProps) {
  const [display, setDisplay] = useState("0")
  const { hideBalances } = useSettingsStore()

  const parseAmount = useCallback((str: string): number => {
    const num = parseFloat(str)
    return isNaN(num) ? 0 : num
  }, [])

  const updateDisplay = useCallback(
    (newDisplay: string) => {
      setDisplay(newDisplay)
      onAmountChange(parseAmount(newDisplay))
    },
    [onAmountChange, parseAmount]
  )

  const handleDigit = useCallback(
    (digit: string) => {
      hapticLight()
      setDisplay((prev) => {
        let next: string
        if (prev === "0" && digit !== ".") {
          next = digit
        } else if (digit === "." && prev.includes(".")) {
          return prev
        } else {
          // Check decimal limit
          if (prev.includes(".")) {
            const decimals = prev.split(".")[1]
            if (decimals && decimals.length >= token.decimals) return prev
          }
          next = prev + digit
        }
        onAmountChange(parseAmount(next))
        return next
      })
    },
    [token.decimals, onAmountChange, parseAmount]
  )

  const handleBackspace = useCallback(() => {
    hapticLight()
    setDisplay((prev) => {
      const next = prev.length <= 1 ? "0" : prev.slice(0, -1)
      onAmountChange(parseAmount(next))
      return next
    })
  }, [onAmountChange, parseAmount])

  const handleClear = useCallback(() => {
    hapticLight()
    updateDisplay("0")
  }, [updateDisplay])

  const handlePreset = useCallback(
    (pct: number) => {
      hapticLight()
      const raw = balance * pct
      const factor = Math.pow(10, token.decimals)
      const truncated = Math.floor(raw * factor) / factor
      const str = truncated.toString()
      setDisplay(str)
      onAmountChange(truncated)
    },
    [balance, token.decimals, onAmountChange]
  )

  const amount = parseAmount(display)
  const hasAmount = amount > 0

  return (
    <View className="flex-1">
      {/* Token & Amount Display */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="flex-row items-center mb-4">
          <Text className="text-white text-lg font-semibold">{token.symbol}</Text>
        </View>

        <Text className="text-white text-5xl font-bold mb-2">
          {display}
        </Text>

        {/* Balance Pill */}
        <View className="bg-dark-800 px-4 py-1.5 rounded-full mt-2">
          <Text className="text-dark-400 text-sm">
            {hideBalances ? "******" : `${balance} ${token.symbol}`}
          </Text>
        </View>
      </View>

      {/* CTA Button */}
      <View className="px-6 mb-3">
        <TouchableOpacity
          className={`py-4 rounded-2xl items-center ${
            hasAmount && !disabled ? "bg-brand-600" : "bg-dark-800"
          }`}
          onPress={hasAmount ? onCtaPress : undefined}
          disabled={!hasAmount || disabled}
          accessibilityRole="button"
          accessibilityLabel={hasAmount ? ctaLabel : ctaDisabledLabel}
        >
          <Text
            className={`text-lg font-semibold ${
              hasAmount && !disabled ? "text-white" : "text-dark-500"
            }`}
          >
            {hasAmount ? ctaLabel : ctaDisabledLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Numpad Grid */}
      <View className="px-2 pb-2">
        {[
          [{ label: "MAX", action: () => handlePreset(1) }, "1", "2", "3"],
          [{ label: "75%", action: () => handlePreset(0.75) }, "4", "5", "6"],
          [{ label: "50%", action: () => handlePreset(0.5) }, "7", "8", "9"],
          [{ label: "CLEAR", action: handleClear }, ".", "0", { label: "backspace", action: handleBackspace }],
        ].map((row, ri) => (
          <View key={ri} className="flex-row">
            {row.map((key, ki) => {
              if (typeof key === "string") {
                return (
                  <TouchableOpacity
                    key={ki}
                    className="flex-1 py-3 items-center justify-center"
                    onPress={() => handleDigit(key)}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                  >
                    <Text className="text-white text-2xl font-medium">{key}</Text>
                  </TouchableOpacity>
                )
              }
              if (key.label === "backspace") {
                return (
                  <TouchableOpacity
                    key={ki}
                    className="flex-1 py-3 items-center justify-center"
                    onPress={key.action}
                    accessibilityRole="button"
                    accessibilityLabel="Backspace"
                  >
                    <BackspaceIcon size={24} color={ICON_COLORS.white} />
                  </TouchableOpacity>
                )
              }
              return (
                <TouchableOpacity
                  key={ki}
                  className="flex-1 py-3 items-center justify-center"
                  onPress={key.action}
                  accessibilityRole="button"
                  accessibilityLabel={key.label}
                >
                  <Text className="text-brand-400 text-base font-semibold">{key.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}
```

**Step 4: Export from barrel**

Add to `src/components/index.ts`:

```typescript
export { NumpadInput } from "./NumpadInput"
```

**Step 5: Run tests — expect PASS**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/NumpadInput.test.tsx`
Expected: PASS (all 11 tests)

**Step 6: Commit**

```bash
git add src/components/NumpadInput.tsx src/components/index.ts tests/components/NumpadInput.test.tsx
git commit -m "feat: add NumpadInput component with presets

Shared numpad for Send and Swap screens. Supports MAX/75%/50%/CLEAR
presets, decimal limiting per token, backspace, and balance pill.
Adapted from Jupiter Mobile's numpad UX pattern."
```

---

### Task 4: Sidebar Component

**Files:**
- Create: `/Users/rector/local-dev/sip-mobile/src/components/Sidebar.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/SidebarProvider.tsx`
- Modify: `/Users/rector/local-dev/sip-mobile/src/components/index.ts`
- Modify: `/Users/rector/local-dev/sip-mobile/app/_layout.tsx`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/Sidebar.test.tsx`

**Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react-native"
import { Sidebar } from "@/components/Sidebar"

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), navigate: vi.fn() },
}))

vi.mock("@/stores/wallet", () => ({
  useWalletStore: () => ({
    accounts: [{ id: "1", address: "7xK9abc", nickname: "Main", emoji: "\u{1F680}", providerType: "native", chain: "solana", createdAt: 0, lastUsedAt: 0 }],
    activeAccountId: "1",
  }),
  formatAddress: (addr: string) => addr.slice(0, 4) + "..." + addr.slice(-4),
}))

vi.mock("@/stores/settings", () => ({
  useSettingsStore: () => ({
    network: "devnet",
    rpcProvider: "helius",
  }),
}))

describe("Sidebar", () => {
  it("renders account info", () => {
    const { getByText } = render(<Sidebar visible={true} onClose={vi.fn()} />)
    expect(getByText("Main")).toBeTruthy()
    expect(getByText("\u{1F680}")).toBeTruthy()
  })

  it("renders menu sections", () => {
    const { getByText } = render(<Sidebar visible={true} onClose={vi.fn()} />)
    expect(getByText("Manage")).toBeTruthy()
    expect(getByText("History")).toBeTruthy()
    expect(getByText("Viewing Keys")).toBeTruthy()
    expect(getByText("Security & Backup")).toBeTruthy()
  })

  it("renders network section", () => {
    const { getByText } = render(<Sidebar visible={true} onClose={vi.fn()} />)
    expect(getByText("Network")).toBeTruthy()
    expect(getByText("RPC Provider")).toBeTruthy()
  })

  it("calls onClose when backdrop pressed", () => {
    const onClose = vi.fn()
    const { getByLabelText } = render(<Sidebar visible={true} onClose={onClose} />)
    fireEvent.press(getByLabelText("Close sidebar"))
    expect(onClose).toHaveBeenCalled()
  })

  it("does not render when not visible", () => {
    const { queryByText } = render(<Sidebar visible={false} onClose={vi.fn()} />)
    expect(queryByText("Manage")).toBeNull()
  })
})
```

**Step 2: Run test — expect FAIL**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/Sidebar.test.tsx`

**Step 3: Create SidebarProvider**

Create `src/components/SidebarProvider.tsx`:

```typescript
import { createContext, useContext, useState, useCallback } from "react"
import type { ReactNode } from "react"

interface SidebarContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
```

**Step 4: Implement Sidebar**

Create `src/components/Sidebar.tsx`:

```typescript
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native"
import { router } from "expo-router"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { AccountAvatar } from "./AccountAvatar"
import { ICON_COLORS } from "@/constants/icons"
import {
  UserCircleIcon,
  ClockIcon,
  KeyIcon,
  ShieldCheckIcon,
  GlobeIcon,
  CellSignalFullIcon,
  InfoIcon,
  BookOpenIcon,
  BugIcon,
  GearIcon,
  QuestionIcon,
} from "phosphor-react-native"
import * as Clipboard from "expo-clipboard"
import { hapticLight } from "@/utils/haptics"

interface SidebarProps {
  visible: boolean
  onClose: () => void
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  detail?: string
  onPress: () => void
}

export function Sidebar({ visible, onClose }: SidebarProps) {
  const { accounts, activeAccountId } = useWalletStore()
  const { network, rpcProvider } = useSettingsStore()
  const activeAccount = accounts.find((a) => a.id === activeAccountId)

  if (!visible || !activeAccount) return null

  const navigate = (path: string) => {
    onClose()
    setTimeout(() => router.push(path as any), 150)
  }

  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(activeAccount.address)
    hapticLight()
  }

  const accountSection: MenuItem[] = [
    { icon: <UserCircleIcon size={22} color={ICON_COLORS.inactive} />, label: "Manage", onPress: () => navigate("/settings/accounts") },
    { icon: <ClockIcon size={22} color={ICON_COLORS.inactive} />, label: "History", onPress: () => navigate("/history") },
    { icon: <KeyIcon size={22} color={ICON_COLORS.inactive} />, label: "Viewing Keys", onPress: () => navigate("/settings/viewing-keys") },
    { icon: <ShieldCheckIcon size={22} color={ICON_COLORS.inactive} />, label: "Security & Backup", onPress: () => navigate("/settings/backup") },
  ]

  const networkSection: MenuItem[] = [
    { icon: <GlobeIcon size={22} color={ICON_COLORS.inactive} />, label: "Network", detail: network, onPress: () => navigate("/settings") },
    { icon: <CellSignalFullIcon size={22} color={ICON_COLORS.inactive} />, label: "RPC Provider", detail: rpcProvider, onPress: () => navigate("/settings") },
  ]

  const aboutSection: MenuItem[] = [
    { icon: <InfoIcon size={22} color={ICON_COLORS.inactive} />, label: "About SIP", onPress: () => navigate("/settings") },
    { icon: <BookOpenIcon size={22} color={ICON_COLORS.inactive} />, label: "Documentation", onPress: () => navigate("/settings") },
    { icon: <BugIcon size={22} color={ICON_COLORS.inactive} />, label: "Report Issue", onPress: () => navigate("/settings") },
  ]

  const renderSection = (title: string, items: MenuItem[]) => (
    <View className="mb-4">
      <Text className="text-dark-500 text-xs font-semibold uppercase tracking-wider px-5 mb-2">
        {title}
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          className="flex-row items-center px-5 py-3"
          onPress={item.onPress}
        >
          {item.icon}
          <Text className="text-white text-base ml-3 flex-1">{item.label}</Text>
          {item.detail && (
            <Text className="text-dark-500 text-sm capitalize">{item.detail}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  )

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 flex-row">
        {/* Sidebar Panel */}
        <View className="w-[280px] bg-dark-950 flex-1 pt-14">
          <ScrollView className="flex-1">
            {/* Profile Header */}
            <View className="px-5 pb-4 mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center flex-1">
                  <AccountAvatar emoji={activeAccount.emoji} size="md" />
                  <Text className="text-white text-lg font-semibold ml-3">
                    {activeAccount.nickname}
                  </Text>
                </View>
                <TouchableOpacity
                  className="bg-brand-600 px-3 py-1 rounded-lg"
                  onPress={() => navigate("/settings/accounts")}
                >
                  <Text className="text-white text-sm font-medium">Switch</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity className="flex-row items-center mt-1" onPress={handleCopyAddress}>
                <Text className="text-dark-400 text-sm">
                  {formatAddress(activeAccount.address)}
                </Text>
                <Text className="text-dark-500 text-xs ml-1">📋</Text>
              </TouchableOpacity>
            </View>

            {renderSection("Account", accountSection)}
            {renderSection("Network", networkSection)}
            {renderSection("About", aboutSection)}
          </ScrollView>

          {/* Bottom Bar */}
          <View className="flex-row border-t border-dark-800 px-5 py-3">
            <TouchableOpacity className="flex-1 flex-row items-center" onPress={() => navigate("/settings")}>
              <QuestionIcon size={18} color={ICON_COLORS.inactive} />
              <Text className="text-dark-400 text-sm ml-1">Get help</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 flex-row items-center justify-end" onPress={() => navigate("/settings")}>
              <GearIcon size={18} color={ICON_COLORS.inactive} />
              <Text className="text-dark-400 text-sm ml-1">Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Backdrop */}
        <TouchableOpacity
          className="flex-1 bg-black/50"
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close sidebar"
        />
      </View>
    </Modal>
  )
}
```

**Step 5: Export from barrels**

Add to `src/components/index.ts`:

```typescript
export { Sidebar } from "./Sidebar"
export { SidebarProvider, useSidebar } from "./SidebarProvider"
```

**Step 6: Wrap app root with SidebarProvider**

In `app/_layout.tsx`, add `SidebarProvider` inside the existing provider chain:

```typescript
import { SidebarProvider } from "@/components"

// Wrap inside GestureHandlerRootView > WalletProvider:
<SidebarProvider>
  {/* existing Stack navigator */}
</SidebarProvider>
```

**Step 7: Run tests — expect PASS**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run tests/components/Sidebar.test.tsx`
Expected: PASS

**Step 8: Commit**

```bash
git add src/components/Sidebar.tsx src/components/SidebarProvider.tsx src/components/index.ts app/_layout.tsx tests/components/Sidebar.test.tsx
git commit -m "feat: add Sidebar navigation with account switching

Slide-out sidebar accessible from avatar tap. Shows account info,
quick navigation to Manage/History/Viewing Keys/Security, network
settings, and about links. Adapted from Jupiter Mobile sidebar."
```

---

### Task 5: Navigation Restructure (3 Tabs)

**Files:**
- Modify: `/Users/rector/local-dev/sip-mobile/app/(tabs)/_layout.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/app/(tabs)/privacy.tsx`
- Move: `app/(tabs)/send.tsx` -> `app/send/index.tsx`
- Move: `app/(tabs)/receive.tsx` -> `app/receive/index.tsx`
- Delete: `app/(tabs)/settings.tsx`
- Modify: `app/send/_layout.tsx` (if exists, or create)
- Modify: `app/receive/_layout.tsx` (if exists, or create)

**Step 1: Restructure tab layout**

Modify `app/(tabs)/_layout.tsx` to have 3 tabs:

```typescript
import { Tabs } from "expo-router"
import { View } from "react-native"
import { HouseIcon, ShieldIcon, ArrowsLeftRightIcon } from "phosphor-react-native"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { Redirect } from "expo-router"
import { ICON_COLORS } from "@/constants/icons"

export default function TabLayout() {
  const { _hasHydrated: walletHydrated, accounts } = useWalletStore()
  const { _hasHydrated: settingsHydrated, hasCompletedOnboarding } = useSettingsStore()

  if (!walletHydrated || !settingsHydrated) return null

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/onboarding" />
  }

  if (accounts.length === 0) {
    return <Redirect href="/(auth)/wallet-setup" />
  }

  return (
    <View className="flex-1 bg-dark-950">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0a0a0a",
            borderTopColor: "#27272a",
            borderTopWidth: 0.5,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#8b5cf6",
          tabBarInactiveTintColor: "#71717a",
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <HouseIcon
                size={24}
                color={focused ? ICON_COLORS.brand : ICON_COLORS.inactive}
                weight={focused ? "fill" : "regular"}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="privacy"
          options={{
            title: "Privacy",
            tabBarIcon: ({ focused }) => (
              <ShieldIcon
                size={24}
                color={focused ? ICON_COLORS.brand : ICON_COLORS.inactive}
                weight={focused ? "fill" : "regular"}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="swap"
          options={{
            title: "Swap",
            tabBarIcon: ({ focused }) => (
              <ArrowsLeftRightIcon
                size={24}
                color={focused ? ICON_COLORS.brand : ICON_COLORS.inactive}
                weight={focused ? "bold" : "regular"}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  )
}
```

**Step 2: Create Privacy tab**

Create `app/(tabs)/privacy.tsx` — consolidate scan, claim, viewing keys, compliance, privacy score:

```typescript
import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import {
  MagnifyingGlassIcon,
  DownloadIcon,
  KeyIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  EyeIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { usePrivacyStore } from "@/stores/privacy"
import { PrivacyScoreBadge } from "@/components"

export default function PrivacyScreen() {
  // Privacy hub — links to all privacy features
  const features = [
    { icon: MagnifyingGlassIcon, label: "Scan for Payments", desc: "Check for incoming stealth payments", route: "/scan" },
    { icon: DownloadIcon, label: "Claim Payments", desc: "Claim your received stealth payments", route: "/claim" },
    { icon: KeyIcon, label: "Viewing Keys", desc: "Manage selective disclosure keys", route: "/settings/viewing-keys" },
    { icon: ShieldCheckIcon, label: "Compliance", desc: "Audit trail and compliance tools", route: "/compliance" },
    { icon: ChartBarIcon, label: "Privacy Score", desc: "Analyze your wallet privacy", route: "/settings/privacy-score" },
    { icon: EyeIcon, label: "Privacy Provider", desc: "Choose your privacy backend", route: "/settings" },
  ]

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="px-6 py-4">
        <Text className="text-2xl font-bold text-white">Privacy</Text>
        <Text className="text-dark-400 mt-1">Manage your privacy features</Text>
      </View>
      <ScrollView className="flex-1 px-6">
        <View className="gap-3">
          {features.map((f) => (
            <TouchableOpacity
              key={f.label}
              className="bg-dark-900 rounded-xl p-4 flex-row items-center"
              onPress={() => router.push(f.route as any)}
            >
              <View className="w-10 h-10 bg-dark-800 rounded-lg items-center justify-center">
                <f.icon size={22} color={ICON_COLORS.brand} weight="fill" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">{f.label}</Text>
                <Text className="text-dark-400 text-sm">{f.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View className="pb-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 3: Move Send to stack screen**

Move `app/(tabs)/send.tsx` to `app/send/index.tsx`. Create `app/send/_layout.tsx`:

```typescript
import { Stack } from "expo-router"

export default function SendLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="scanner" />
    </Stack>
  )
}
```

**Step 4: Move Receive to stack screen**

Move `app/(tabs)/receive.tsx` to `app/receive/index.tsx`. Create `app/receive/_layout.tsx`:

```typescript
import { Stack } from "expo-router"

export default function ReceiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
```

**Step 5: Delete settings tab**

Remove `app/(tabs)/settings.tsx`. Verify no imports reference it directly. Settings are now accessed via sidebar.

**Step 6: Update root layout routes**

In `app/_layout.tsx`, ensure the Stack navigator includes send, receive, and token routes:

```typescript
<Stack.Screen name="send" options={{ headerShown: false }} />
<Stack.Screen name="receive" options={{ headerShown: false }} />
<Stack.Screen name="token" options={{ headerShown: false }} />
```

**Step 7: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run`
Expected: All 1,205 tests pass (some may need route updates in mocks)

**Step 8: Fix any broken test imports**

Update test mocks that reference `/(tabs)/send` or `/(tabs)/receive` to `/send` or `/receive`.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: restructure to 3-tab navigation (Home/Privacy/Swap)

Move Send and Receive from tabs to stack screens. Add Privacy hub tab
consolidating scan, claim, viewing keys, compliance, and privacy score.
Remove Settings tab — now accessed via sidebar. Adapted from Jupiter
Mobile's 3-tab (Account/Trade/Pro) pattern."
```

---

### Task 6: Home Screen Overhaul

**Files:**
- Modify: `/Users/rector/local-dev/sip-mobile/app/(tabs)/index.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/BalanceCard.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/QuickActions.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/TokenRow.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/PrivacyStatsRow.tsx`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/BalanceCard.test.tsx`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/TokenRow.test.tsx`

**Step 1: Write BalanceCard test**

```typescript
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react-native"
import { BalanceCard } from "@/components/BalanceCard"

vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(() => ({ hideBalances: true, toggleHideBalances: vi.fn() })),
}))

describe("BalanceCard", () => {
  it("shows hidden balance by default", () => {
    const { getByText } = render(<BalanceCard balance={30.5} usdValue={2680.25} />)
    expect(getByText("******")).toBeTruthy()
  })

  it("shows eye toggle", () => {
    const { getByLabelText } = render(<BalanceCard balance={30.5} usdValue={2680.25} />)
    expect(getByLabelText("Toggle balance visibility")).toBeTruthy()
  })
})
```

**Step 2: Write TokenRow test**

```typescript
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react-native"
import { TokenRow } from "@/components/TokenRow"

vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(() => ({ hideBalances: false })),
}))

describe("TokenRow", () => {
  const token = {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111",
    decimals: 9,
    logoUri: "",
    balance: 30.5,
    usdValue: 2680.25,
    change24h: -4.1,
    verified: true,
  }

  it("renders token info", () => {
    const { getByText } = render(<TokenRow token={token} onPress={vi.fn()} />)
    expect(getByText("Solana")).toBeTruthy()
    expect(getByText("SOL")).toBeTruthy()
    expect(getByText("-4.1%")).toBeTruthy()
  })

  it("calls onPress when tapped", () => {
    const onPress = vi.fn()
    const { getByText } = render(<TokenRow token={token} onPress={onPress} />)
    fireEvent.press(getByText("Solana"))
    expect(onPress).toHaveBeenCalled()
  })
})
```

**Step 3: Implement BalanceCard, QuickActions, TokenRow, PrivacyStatsRow**

Create each component following existing patterns (NativeWind classes, Phosphor icons, ICON_COLORS, haptic feedback). See design doc Section 2 for layout specs.

Key implementation notes:
- `BalanceCard` reads `hideBalances` from `useSettingsStore` and renders `******` or actual balance
- `QuickActions` renders 3 circle buttons that `router.push("/send")`, `router.push("/receive")`, `router.push("/scan")`
- `TokenRow` shows token icon, name, 24h %, balance (or ******), taps to `router.push(\`/token/${token.mint}\`)`
- `PrivacyStatsRow` shows privacy transfer count and privacy score with chevron to Privacy tab

**Step 4: Rewrite Home screen**

Rewrite `app/(tabs)/index.tsx` to use new components:

```
TopBar: [AccountAvatar (onPress=sidebar.open)]  "Wallet"  [SearchIcon]  [ScanIcon]
BalanceCard: balance + hide toggle + account name
QuickActions: Send / Receive / Scan
Unclaimed Banner (conditional)
PrivacyStatsRow
Token List (map tokens -> TokenRow)
```

Import `useSidebar` from SidebarProvider to open sidebar on avatar tap.

**Step 5: Add Sidebar rendering to tab layout or home**

In `app/(tabs)/index.tsx` or `app/(tabs)/_layout.tsx`, render `<Sidebar>` with `useSidebar()` state.

**Step 6: Run tests**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: overhaul Home screen with Jupiter-style layout

Avatar + sidebar trigger, hidden balance card with eye toggle,
Send/Receive/Scan quick action icons, token list with 24h change,
privacy stats row. Adapted from Jupiter Mobile home screen."
```

---

### Task 7: Send Screen Refactor

**Files:**
- Modify: `/Users/rector/local-dev/sip-mobile/app/send/index.tsx`

**Step 1: Replace TextInput with NumpadInput**

In the Send screen, replace the amount input section with `<NumpadInput>`. Keep:
- Recipient address input (top, with Address/Stealth toggle tabs)
- Privacy level selector
- Confirmation modal with progress steps
- Recent addresses clock icon

The screen layout becomes:
```
[<- Back]  [Address | Stealth]  [Clock icon]
[Recipient input field]
[Privacy level badge]

<NumpadInput
  token={selectedToken}
  balance={tokenBalance}
  ctaLabel="Send"
  onCtaPress={handleConfirm}
/>
```

**Step 2: Run tests**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run`

**Step 3: Commit**

```bash
git add app/send/index.tsx
git commit -m "feat: replace Send text input with NumpadInput

Numpad with MAX/75%/50%/CLEAR presets replaces system keyboard
for amount entry. Adds Address/Stealth toggle tabs and recent
addresses icon."
```

---

### Task 8: Token Detail Page

**Files:**
- Create: `/Users/rector/local-dev/sip-mobile/app/token/[mint].tsx`
- Create: `/Users/rector/local-dev/sip-mobile/app/token/_layout.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/PriceChart.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/TokenStats.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/src/components/PositionCard.tsx`
- Test: `/Users/rector/local-dev/sip-mobile/tests/components/TokenStats.test.tsx`
- Test: `/Users/rector/local-dev/sip-mobile/tests/screens/token-detail.test.tsx`

**Step 1: Install chart library**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm add react-native-wagmi-charts`

If compatibility issues arise, fallback to `victory-native` or a simple SVG-based chart component.

**Step 2: Create token layout**

Create `app/token/_layout.tsx`:

```typescript
import { Stack } from "expo-router"

export default function TokenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="[mint]" />
    </Stack>
  )
}
```

**Step 3: Create TokenStats component**

```typescript
// src/components/TokenStats.tsx
import { View, Text } from "react-native"

interface TokenStatsProps {
  marketCap?: number
  liquidity?: number
  holders?: number
  privacyScore?: number
}

export function TokenStats({ marketCap, liquidity, holders, privacyScore }: TokenStatsProps) {
  const formatLargeNumber = (n?: number) => {
    if (!n) return "—"
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
    return `$${n.toFixed(2)}`
  }

  const stats = [
    { label: "Mkt Cap", value: formatLargeNumber(marketCap) },
    { label: "Liquidity", value: formatLargeNumber(liquidity) },
    { label: "Holders", value: holders ? `${(holders / 1e6).toFixed(2)}M` : "—" },
    { label: "Privacy", value: privacyScore !== undefined ? `${privacyScore}%` : "—" },
  ]

  return (
    <View className="flex-row bg-dark-900 rounded-xl p-3 mx-6">
      {stats.map((s, i) => (
        <View key={s.label} className={`flex-1 items-center ${i > 0 ? "border-l border-dark-800" : ""}`}>
          <Text className="text-dark-500 text-xs">{s.label}</Text>
          <Text className="text-white text-sm font-medium mt-0.5">{s.value}</Text>
        </View>
      ))}
    </View>
  )
}
```

**Step 4: Create PriceChart component**

A wrapper around `react-native-wagmi-charts` (or SVG fallback). Displays price history with time filter buttons (1H, 1D, 1W, 1M, YTD). Fetches data from Jupiter Price API.

**Step 5: Create PositionCard component**

Shows user's balance and PnL for this token. Respects `hideBalances`.

**Step 6: Build token detail page**

Create `app/token/[mint].tsx` — uses `useLocalSearchParams()` to get mint, fetches token data from Jupiter Price API and local balance. Layout per design doc Section 4. Bottom sticky bar with Send/Sell/Buy buttons.

**Step 7: Write tests**

Test TokenStats formatting, test token detail renders correctly with mocked data.

**Step 8: Run tests**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run`

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Token Detail page with chart, stats, and actions

New screen at /token/[mint] with price chart, stats grid (Mkt Cap,
Liquidity, Holders, Privacy Score), position card, and sticky
Send/Sell/Buy action bar. Uses Jupiter Price API for data."
```

---

### Task 9: Polish (Branded QR, Swap Numpad, History Link)

**Files:**
- Modify: `/Users/rector/local-dev/sip-mobile/app/receive/index.tsx`
- Modify: `/Users/rector/local-dev/sip-mobile/app/(tabs)/swap.tsx`
- Create: `/Users/rector/local-dev/sip-mobile/assets/sip-logo-qr.png` (need logo asset)

**Step 1: Add branded QR code**

In `app/receive/index.tsx`, add logo prop to QRCode component:

```typescript
<QRCode
  value={stealthAddress}
  size={200}
  backgroundColor="white"
  color="black"
  logo={require("../../assets/sip-logo-qr.png")}
  logoSize={40}
  logoBackgroundColor="white"
  logoBorderRadius={8}
/>
```

Need a `sip-logo-qr.png` asset (small shield icon, ~80x80px). Use existing SIP logo or create one.

**Step 2: Add NumpadInput to Swap screen**

In `app/(tabs)/swap.tsx`, replace the "from" amount TextInput with `<NumpadInput>`. Keep all other swap functionality (token selector, privacy toggle, route display, confirmation modal).

**Step 3: Add History quick link on Home**

In the home screen, add a "View All History >" link below the privacy stats row or recent activity section. Navigates to `/history`.

**Step 4: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test -- --run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: branded QR, swap numpad, and history link

Add SIP logo to receive QR code, replace swap amount input with
NumpadInput component, add quick history link on home screen."
```

---

## Final Verification

After all 9 tasks:

```bash
cd /Users/rector/local-dev/sip-mobile

# Run all tests
pnpm test -- --run

# Type check
pnpm typecheck

# Build Android to verify no runtime issues
eas build --platform android --profile development --local
```

Expected: 1,200+ tests passing, no type errors, successful build.
