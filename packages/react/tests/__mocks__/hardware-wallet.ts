/**
 * Mock for hardware wallet packages (Ledger, Trezor)
 * These are optional dependencies that may not be installed
 */

export default class MockHardwareWallet {
  constructor() {}
}

export const create = () => Promise.resolve(new MockHardwareWallet())

// Trezor Connect exports
export const init = () => Promise.resolve()
export const getAddress = () => Promise.resolve({ address: '0x0' })
export const signTransaction = () => Promise.resolve({ signature: '0x0' })
