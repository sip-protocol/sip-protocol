/**
 * PrivateWallet.tsx
 *
 * Complete private wallet implementation combining all SIP Protocol React hooks.
 *
 * Features:
 * - Wallet connection (Phantom, Solflare, etc.)
 * - Stealth address generation and management
 * - Send private payments
 * - Receive and claim payments
 * - Transaction history
 * - Viewing key management for compliance
 *
 * This is a complete example showing how to build a full-featured private wallet UI.
 *
 * @packageDocumentation
 */

import { useState, useCallback, useMemo } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  useStealthTransfer,
  useScanPayments,
  useStealthAddress,
  useViewingKey,
} from '@sip-protocol/react'
import type { HexString } from '@sip-protocol/types'

// Tab type for navigation
type Tab = 'receive' | 'send' | 'history' | 'settings'

// Token mint addresses (devnet)
const TOKENS = {
  USDC: { mint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr', decimals: 6, symbol: 'USDC' },
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9, symbol: 'SOL' },
} as const

/**
 * PrivateWallet - Full-featured private payment wallet
 *
 * @example
 * ```tsx
 * import { PrivateWallet } from './PrivateWallet'
 * import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react'
 *
 * function App() {
 *   return (
 *     <ConnectionProvider endpoint="https://api.devnet.solana.com">
 *       <WalletProvider wallets={wallets}>
 *         <PrivateWallet />
 *       </WalletProvider>
 *     </ConnectionProvider>
 *   )
 * }
 * ```
 */
export function PrivateWallet() {
  const { connection } = useConnection()
  const { publicKey, signTransaction, connected } = useWallet()

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>('receive')

  // Key state (in production, store these securely!)
  const [keys, setKeys] = useState<{
    viewingPrivateKey: HexString | null
    spendingPrivateKey: HexString | null
    spendingPublicKey: HexString | null
  }>({
    viewingPrivateKey: null,
    spendingPrivateKey: null,
    spendingPublicKey: null,
  })

  // Stealth address hook
  const {
    metaAddress,
    encodedMetaAddress,
    viewingPrivateKey,
    spendingPrivateKey,
    spendingPublicKey,
    generate: generateAddress,
    isGenerating,
  } = useStealthAddress()

  // Transfer hook
  const transfer = useStealthTransfer({
    connection,
    sender: publicKey,
    signTransaction,
  })

  // Scan hook (only active when we have keys)
  const scan = useScanPayments({
    connection,
    viewingPrivateKey: keys.viewingPrivateKey || ('0x' as HexString),
    spendingPublicKey: keys.spendingPublicKey || ('0x' as HexString),
    scanInterval: keys.viewingPrivateKey ? 30000 : 0, // Auto-scan if keys available
  })

  // Viewing key hook for compliance
  const viewingKey = useViewingKey({
    masterViewingKey: keys.viewingPrivateKey || undefined,
  })

  /**
   * Handle address generation
   */
  const handleGenerate = useCallback(async () => {
    const result = await generateAddress()
    if (result) {
      setKeys({
        viewingPrivateKey: result.viewingPrivateKey as HexString,
        spendingPrivateKey: result.spendingPrivateKey as HexString,
        spendingPublicKey: result.spendingPublicKey as HexString,
      })
    }
  }, [generateAddress])

  /**
   * Calculate total balance
   */
  const totalBalance = useMemo(() => {
    return scan.payments.reduce(
      (acc, p) => {
        if (!p.claimed) {
          acc.unclaimed += p.amount
        } else {
          acc.claimed += p.amount
        }
        return acc
      },
      { unclaimed: 0n, claimed: 0n }
    )
  }, [scan.payments])

  /**
   * Format amount for display
   */
  const formatAmount = (amount: bigint, decimals = 6) => {
    return (Number(amount) / 10 ** decimals).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Private Wallet</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to send and receive private payments on Solana.
          </p>
          <WalletMultiButton />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Private Wallet</h1>
        <WalletMultiButton />
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white mb-6">
        <div className="text-sm opacity-80">Total Private Balance</div>
        <div className="text-3xl font-bold">{formatAmount(totalBalance.unclaimed)}</div>
        <div className="text-sm opacity-80 mt-2">
          {scan.payments.filter((p) => !p.claimed).length} unclaimed payments
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(['receive', 'send', 'history', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {/* Receive tab */}
        {activeTab === 'receive' && (
          <div className="space-y-6">
            {!metaAddress ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  Generate a stealth address to receive private payments.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {isGenerating ? 'Generating...' : 'Generate Address'}
                </button>
              </div>
            ) : (
              <>
                {/* Address display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Stealth Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={encodedMetaAddress || ''}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(encodedMetaAddress || '')}
                      className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Share this address to receive private payments.
                  </p>
                </div>

                {/* Scan controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => scan.scan()}
                    disabled={scan.isScanning}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {scan.isScanning ? 'Scanning...' : 'Scan for Payments'}
                  </button>
                  {scan.payments.filter((p) => !p.claimed).length > 0 && (
                    <button
                      onClick={() =>
                        scan.claimAll({
                          spendingPrivateKey: keys.spendingPrivateKey!,
                          destinationAddress: publicKey!.toBase58(),
                          mintResolver: (mint) => new PublicKey(mint),
                        })
                      }
                      disabled={scan.isClaiming}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Claim All
                    </button>
                  )}
                </div>

                {/* Unclaimed payments */}
                {scan.payments.filter((p) => !p.claimed).length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Unclaimed Payments</h3>
                    <div className="space-y-2">
                      {scan.payments
                        .filter((p) => !p.claimed)
                        .map((payment) => (
                          <div
                            key={payment.txSignature}
                            className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium">{formatAmount(payment.amount)}</div>
                              <div className="text-xs text-gray-500">
                                {payment.stealthAddress.slice(0, 8)}...
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                scan.claim(payment, {
                                  spendingPrivateKey: keys.spendingPrivateKey!,
                                  destinationAddress: publicKey!.toBase58(),
                                  mint: new PublicKey(payment.mint),
                                })
                              }
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Claim
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Send tab */}
        {activeTab === 'send' && (
          <SendForm transfer={transfer} senderPublicKey={publicKey} />
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="font-medium">Transaction History</h3>
            {scan.payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {scan.payments.map((payment) => (
                  <div
                    key={payment.txSignature}
                    className={`p-3 rounded-lg ${
                      payment.claimed ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{formatAmount(payment.amount)}</span>
                      <span
                        className={`text-sm ${
                          payment.claimed ? 'text-green-600' : 'text-yellow-600'
                        }`}
                      >
                        {payment.claimed ? 'Claimed' : 'Unclaimed'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {payment.stealthAddress.slice(0, 12)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Viewing Key Delegation</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create viewing keys for auditors or compliance teams.
              </p>
              <button
                onClick={() => {
                  if (viewingKey.masterViewingKey) {
                    const derived = viewingKey.deriveAuditorKey({
                      type: 'EXTERNAL',
                      role: 'auditor',
                      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    })
                    alert(`Auditor key created: ${derived.slice(0, 16)}...`)
                  }
                }}
                disabled={!keys.viewingPrivateKey}
                className="w-full px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50"
              >
                Create Auditor Key
              </button>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Key Management</h3>
              <button
                onClick={handleGenerate}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Generate New Address
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Old addresses will still receive payments.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * SendForm - Internal component for sending payments
 */
function SendForm({
  transfer,
  senderPublicKey,
}: {
  transfer: ReturnType<typeof useStealthTransfer>
  senderPublicKey: PublicKey | null
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState<'USDC' | 'SOL'>('USDC')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!senderPublicKey || !recipient || !amount) return

    const tokenInfo = TOKENS[token]
    const mint = new PublicKey(tokenInfo.mint)
    const senderATA = getAssociatedTokenAddressSync(mint, senderPublicKey)
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 10 ** tokenInfo.decimals))

    await transfer.transfer({
      recipientMetaAddress: recipient,
      mint,
      senderTokenAccount: senderATA,
      amount: amountInSmallestUnit,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {transfer.error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {transfer.error.message}
        </div>
      )}

      {transfer.status === 'success' && transfer.result && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          Sent! <a href={transfer.result.explorerUrl} className="underline">View</a>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="sip:solana:0x..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value as 'USDC' | 'SOL')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="USDC">USDC</option>
            <option value="SOL">SOL</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={transfer.isLoading}
        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {transfer.isLoading ? 'Sending...' : 'Send Private Payment'}
      </button>
    </form>
  )
}

export default PrivateWallet
