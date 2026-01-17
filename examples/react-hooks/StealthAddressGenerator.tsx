/**
 * StealthAddressGenerator.tsx
 *
 * Component for generating and displaying stealth meta-addresses using useStealthAddress.
 *
 * Features:
 * - One-click address generation
 * - QR code display for easy sharing
 * - Copy to clipboard
 * - Key backup/export functionality
 * - Secure key display with reveal toggle
 *
 * @packageDocumentation
 */

import { useState, useCallback } from 'react'
import { useStealthAddress } from '@sip-protocol/react'
// Note: You'll need to add a QR code library like 'qrcode.react' for production
// import { QRCodeSVG } from 'qrcode.react'

interface StealthAddressGeneratorProps {
  /** Callback when a new address is generated */
  onGenerate?: (keys: {
    metaAddress: string
    viewingPrivateKey: string
    spendingPrivateKey: string
  }) => void
  /** Whether to show private key export (use with caution) */
  allowKeyExport?: boolean
}

/**
 * StealthAddressGenerator - Generate and manage stealth meta-addresses
 *
 * @example
 * ```tsx
 * import { StealthAddressGenerator } from './StealthAddressGenerator'
 *
 * function App() {
 *   const handleGenerate = (keys) => {
 *     // Securely store keys
 *     saveToSecureStorage(keys)
 *   }
 *
 *   return <StealthAddressGenerator onGenerate={handleGenerate} allowKeyExport />
 * }
 * ```
 */
export function StealthAddressGenerator({
  onGenerate,
  allowKeyExport = false,
}: StealthAddressGeneratorProps) {
  const [showPrivateKeys, setShowPrivateKeys] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Hook for stealth address management
  const {
    metaAddress,
    encodedMetaAddress,
    viewingPrivateKey,
    spendingPrivateKey,
    generate,
    isGenerating,
  } = useStealthAddress()

  /**
   * Handle address generation
   */
  const handleGenerate = useCallback(async () => {
    const result = await generate()

    if (result && onGenerate) {
      onGenerate({
        metaAddress: result.encodedMetaAddress,
        viewingPrivateKey: result.viewingPrivateKey,
        spendingPrivateKey: result.spendingPrivateKey,
      })
    }
  }, [generate, onGenerate])

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  /**
   * Download keys as JSON file
   */
  const downloadKeys = useCallback(() => {
    if (!metaAddress || !viewingPrivateKey || !spendingPrivateKey) return

    const keyData = {
      metaAddress: encodedMetaAddress,
      viewingPrivateKey,
      spendingPrivateKey,
      chain: 'solana',
      createdAt: new Date().toISOString(),
      warning: 'KEEP THIS FILE SECURE. Anyone with these keys can access your funds.',
    }

    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sip-keys-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [metaAddress, encodedMetaAddress, viewingPrivateKey, spendingPrivateKey])

  return (
    <div className="p-6 border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Stealth Address Generator</h2>

      {/* Generate button */}
      {!metaAddress && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            Generate a stealth meta-address to receive private payments.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'Generating...' : 'Generate New Address'}
          </button>
        </div>
      )}

      {/* Address display */}
      {metaAddress && encodedMetaAddress && (
        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              {/* Replace with actual QRCodeSVG component */}
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                QR Code<br />(Install qrcode.react)
              </div>
              {/* <QRCodeSVG value={encodedMetaAddress} size={192} /> */}
            </div>
          </div>

          {/* Meta-address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Stealth Meta-Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={encodedMetaAddress}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(encodedMetaAddress, 'address')}
                className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                {copied === 'address' ? '✓' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Share this address with anyone who wants to send you private payments.
            </p>
          </div>

          {/* Key management */}
          {allowKeyExport && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Private Keys</h3>
                <button
                  onClick={() => setShowPrivateKeys(!showPrivateKeys)}
                  className="text-sm text-purple-600 hover:underline"
                >
                  {showPrivateKeys ? 'Hide Keys' : 'Show Keys'}
                </button>
              </div>

              {showPrivateKeys && (
                <div className="space-y-4">
                  {/* Warning */}
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    <strong>Warning:</strong> Never share your private keys. Anyone with these keys
                    can access your funds.
                  </div>

                  {/* Viewing key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Viewing Private Key
                      <span className="ml-2 text-xs text-gray-500">(for scanning payments)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={viewingPrivateKey || ''}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-xs"
                      />
                      <button
                        onClick={() => copyToClipboard(viewingPrivateKey || '', 'viewing')}
                        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      >
                        {copied === 'viewing' ? '✓' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Spending key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spending Private Key
                      <span className="ml-2 text-xs text-red-500">(for claiming funds - keep very secure!)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={spendingPrivateKey || ''}
                        readOnly
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-xs"
                      />
                      <button
                        onClick={() => copyToClipboard(spendingPrivateKey || '', 'spending')}
                        className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                      >
                        {copied === 'spending' ? '✓' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={downloadKeys}
                    className="w-full px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
                  >
                    Download Keys as JSON
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generate new */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full px-4 py-2 border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50 transition-colors"
            >
              {isGenerating ? 'Generating...' : 'Generate New Address'}
            </button>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Generating a new address will not affect payments sent to your previous address.
            </p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-3 bg-purple-50 rounded-lg text-sm text-purple-800">
        <strong>Privacy Note:</strong> Each time someone sends you a payment, they generate a
        unique one-time address. Only you can find and claim these payments using your private
        keys.
      </div>
    </div>
  )
}

export default StealthAddressGenerator
