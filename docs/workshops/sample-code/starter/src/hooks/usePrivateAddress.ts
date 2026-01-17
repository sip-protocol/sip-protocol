/**
 * Exercise 1: Generate Stealth Meta-Address
 *
 * Goal: Let users generate a private receiving address.
 *
 * Instructions:
 * 1. Import generateStealthMetaAddress, encodeStealthMetaAddress from @sip-protocol/sdk
 * 2. Create state to hold the generated meta-address
 * 3. Implement generate() function that:
 *    - Calls generateStealthMetaAddress()
 *    - Encodes it with encodeStealthMetaAddress()
 *    - Stores the encoded address and private keys
 * 4. Return the encoded address and generate function
 *
 * See hands-on-tutorial.md for full solution.
 */

import { useState, useCallback } from 'react'
// TODO: Import from @sip-protocol/sdk

export function usePrivateAddress() {
  // TODO: Implement state for meta-address

  const generate = useCallback(() => {
    // TODO: Generate and encode stealth meta-address
    throw new Error('Not implemented - complete Exercise 1')
  }, [])

  return {
    metaAddress: null,
    generate,
    receiveAddress: null,
  }
}
