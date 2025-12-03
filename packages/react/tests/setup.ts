import { vi } from 'vitest'

// Mock @ledgerhq/hw-transport-webusb to prevent import errors
vi.mock('@ledgerhq/hw-transport-webusb', () => ({
  default: vi.fn(),
}))
