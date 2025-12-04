import { vi } from 'vitest'

// Mock @ledgerhq/hw-transport-webusb to prevent import errors
vi.mock('@ledgerhq/hw-transport-webusb', () => ({
  default: vi.fn(),
}))

// Mock @ledgerhq/hw-app-eth to prevent import errors
vi.mock('@ledgerhq/hw-app-eth', () => ({
  default: vi.fn(),
}))
