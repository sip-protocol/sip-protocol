import React, { useState, useCallback, useMemo, useRef } from 'react'

/**
 * Viewing key status
 */
export type ViewingKeyStatus = 'active' | 'revoked' | 'expired' | 'pending'

/**
 * Key export format
 */
export type KeyExportFormat = 'encrypted_file' | 'qr_code' | 'plaintext'

/**
 * Key import source
 */
export type KeyImportSource = 'file' | 'qr_code' | 'text'

/**
 * Viewing key usage entry
 */
export interface ViewingKeyUsage {
  timestamp: number
  action: 'created' | 'shared' | 'used' | 'revoked' | 'exported' | 'imported'
  details?: string
  recipient?: string
}

/**
 * Viewing key data
 */
export interface ViewingKey {
  id: string
  publicKey: string
  privateKey?: string
  label?: string
  status: ViewingKeyStatus
  createdAt: number
  expiresAt?: number
  usageHistory: ViewingKeyUsage[]
  sharedWith?: string[]
}

/**
 * ViewingKeyManager component props
 */
export interface ViewingKeyManagerProps {
  /** List of viewing keys */
  keys: ViewingKey[]
  /** Callback to generate a new key */
  onGenerateKey?: (label?: string) => Promise<ViewingKey>
  /** Callback to export a key */
  onExportKey?: (keyId: string, format: KeyExportFormat, password?: string) => Promise<string | Blob>
  /** Callback to import a key */
  onImportKey?: (source: KeyImportSource, data: string | File) => Promise<ViewingKey>
  /** Callback to share a key */
  onShareKey?: (keyId: string, recipient: string) => Promise<void>
  /** Callback to revoke a key */
  onRevokeKey?: (keyId: string) => Promise<void>
  /** Callback when backup is acknowledged */
  onBackupAcknowledged?: (keyId: string) => void
  /** Whether to show backup reminder */
  showBackupReminder?: boolean
  /** Custom class name */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Wizard step type
 */
type WizardStep = 'idle' | 'generate' | 'export' | 'import' | 'share' | 'revoke'

/**
 * CSS styles for the component
 */
const styles = `
.sip-vk-manager {
  font-family: system-ui, -apple-system, sans-serif;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.sip-vk-manager[data-size="sm"] {
  border-radius: 8px;
}

.sip-vk-manager[data-size="lg"] {
  border-radius: 16px;
}

/* Header */
.sip-vk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
  color: white;
}

.sip-vk-manager[data-size="sm"] .sip-vk-header {
  padding: 12px 16px;
}

.sip-vk-manager[data-size="lg"] .sip-vk-header {
  padding: 20px 24px;
}

.sip-vk-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sip-vk-header-title svg {
  width: 24px;
  height: 24px;
}

.sip-vk-header-title h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.sip-vk-manager[data-size="sm"] .sip-vk-header-title h2 {
  font-size: 14px;
}

.sip-vk-manager[data-size="lg"] .sip-vk-header-title h2 {
  font-size: 18px;
}

.sip-vk-header-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.sip-vk-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sip-vk-btn svg {
  width: 16px;
  height: 16px;
}

.sip-vk-btn-primary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.sip-vk-btn-primary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.sip-vk-btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.sip-vk-btn-secondary:hover {
  background: #e5e7eb;
}

.sip-vk-btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.sip-vk-btn-danger:hover {
  background: #fecaca;
}

.sip-vk-btn-success {
  background: #d1fae5;
  color: #059669;
}

.sip-vk-btn-success:hover {
  background: #a7f3d0;
}

.sip-vk-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Key List */
.sip-vk-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.sip-vk-empty {
  padding: 40px 20px;
  text-align: center;
  color: #6b7280;
}

.sip-vk-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.sip-vk-empty p {
  margin: 0 0 16px;
  font-size: 14px;
}

/* Key Item */
.sip-vk-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.sip-vk-item:last-child {
  border-bottom: none;
}

.sip-vk-item:hover {
  background: #f9fafb;
}

.sip-vk-manager[data-size="sm"] .sip-vk-item {
  padding: 12px 16px;
}

.sip-vk-manager[data-size="lg"] .sip-vk-item {
  padding: 20px 24px;
}

.sip-vk-item-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.sip-vk-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  flex-shrink: 0;
}

.sip-vk-item-icon svg {
  width: 20px;
  height: 20px;
}

.sip-vk-item-details {
  flex: 1;
  min-width: 0;
}

.sip-vk-item-label {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.sip-vk-item-key {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sip-vk-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.sip-vk-item-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.sip-vk-item-badge[data-status="active"] {
  background: #d1fae5;
  color: #059669;
}

.sip-vk-item-badge[data-status="revoked"] {
  background: #fee2e2;
  color: #dc2626;
}

.sip-vk-item-badge[data-status="expired"] {
  background: #fef3c7;
  color: #d97706;
}

.sip-vk-item-badge[data-status="pending"] {
  background: #dbeafe;
  color: #2563eb;
}

.sip-vk-item-date {
  font-size: 11px;
  color: #9ca3af;
}

.sip-vk-item-actions {
  display: flex;
  gap: 4px;
}

.sip-vk-item-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.sip-vk-item-action:hover {
  background: #f3f4f6;
  color: #111827;
}

.sip-vk-item-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.sip-vk-item-action svg {
  width: 18px;
  height: 18px;
}

/* Modal/Wizard */
.sip-vk-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.sip-vk-modal-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: auto;
}

.sip-vk-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.sip-vk-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.sip-vk-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.sip-vk-modal-close:hover {
  background: #f3f4f6;
}

.sip-vk-modal-close svg {
  width: 20px;
  height: 20px;
}

.sip-vk-modal-body {
  padding: 24px;
}

.sip-vk-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

/* Form elements */
.sip-vk-form-group {
  margin-bottom: 20px;
}

.sip-vk-form-group:last-child {
  margin-bottom: 0;
}

.sip-vk-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.sip-vk-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.sip-vk-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.sip-vk-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'SF Mono', Monaco, monospace;
  color: #111827;
  resize: vertical;
  min-height: 100px;
  box-sizing: border-box;
}

.sip-vk-textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.sip-vk-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  background: white;
  cursor: pointer;
  box-sizing: border-box;
}

.sip-vk-select:focus {
  outline: none;
  border-color: #6366f1;
}

/* Warning box */
.sip-vk-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 20px;
}

.sip-vk-warning svg {
  width: 20px;
  height: 20px;
  color: #d97706;
  flex-shrink: 0;
  margin-top: 1px;
}

.sip-vk-warning-text {
  font-size: 13px;
  color: #92400e;
  line-height: 1.5;
}

.sip-vk-warning-text strong {
  font-weight: 600;
}

/* Danger box */
.sip-vk-danger {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  margin-bottom: 20px;
}

.sip-vk-danger svg {
  width: 20px;
  height: 20px;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 1px;
}

.sip-vk-danger-text {
  font-size: 13px;
  color: #991b1b;
  line-height: 1.5;
}

/* Backup reminder */
.sip-vk-backup-reminder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fef3c7;
  border-bottom: 1px solid #fcd34d;
}

.sip-vk-backup-reminder-text {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #92400e;
}

.sip-vk-backup-reminder-text svg {
  width: 18px;
  height: 18px;
}

/* History */
.sip-vk-history {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.sip-vk-history-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.sip-vk-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sip-vk-history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #6b7280;
}

.sip-vk-history-item-icon {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d1d5db;
}

.sip-vk-history-item[data-action="created"] .sip-vk-history-item-icon {
  background: #10b981;
}

.sip-vk-history-item[data-action="shared"] .sip-vk-history-item-icon {
  background: #3b82f6;
}

.sip-vk-history-item[data-action="revoked"] .sip-vk-history-item-icon {
  background: #ef4444;
}

/* QR Code display */
.sip-vk-qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  margin-bottom: 16px;
}

.sip-vk-qr-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
}

.sip-vk-qr-placeholder svg {
  width: 64px;
  height: 64px;
  color: #d1d5db;
}

/* File upload */
.sip-vk-file-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.sip-vk-file-upload:hover {
  border-color: #6366f1;
  background: #f5f3ff;
}

.sip-vk-file-upload svg {
  width: 40px;
  height: 40px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.sip-vk-file-upload-text {
  font-size: 14px;
  color: #6b7280;
}

.sip-vk-file-upload-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .sip-vk-manager {
    background: #1f2937;
    border-color: #374151;
  }

  .sip-vk-item:hover {
    background: #111827;
  }

  .sip-vk-item-label {
    color: #f9fafb;
  }

  .sip-vk-item-key {
    color: #9ca3af;
  }

  .sip-vk-modal-content {
    background: #1f2937;
  }

  .sip-vk-modal-header {
    border-color: #374151;
  }

  .sip-vk-modal-title {
    color: #f9fafb;
  }

  .sip-vk-modal-footer {
    background: #111827;
    border-color: #374151;
  }

  .sip-vk-input,
  .sip-vk-textarea,
  .sip-vk-select {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .sip-vk-label {
    color: #d1d5db;
  }

  .sip-vk-btn-secondary {
    background: #374151;
    color: #e5e7eb;
  }

  .sip-vk-btn-secondary:hover {
    background: #4b5563;
  }

  .sip-vk-item-action:hover {
    background: #374151;
    color: #f9fafb;
  }

  .sip-vk-empty {
    color: #9ca3af;
  }
}
`

/**
 * Icons
 */
const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const QrCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="3" height="3" />
    <rect x="18" y="14" width="3" height="3" />
    <rect x="14" y="18" width="3" height="3" />
    <rect x="18" y="18" width="3" height="3" />
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Truncate key for display
 */
function truncateKey(key: string, chars = 8): string {
  if (key.length <= chars * 2 + 3) return key
  return `${key.slice(0, chars)}...${key.slice(-chars)}`
}

/**
 * ViewingKeyManager - Component for managing NEAR viewing keys
 *
 * @example Basic usage
 * ```tsx
 * import { ViewingKeyManager } from '@sip-protocol/react'
 *
 * function KeyManagement() {
 *   const [keys, setKeys] = useState<ViewingKey[]>([])
 *
 *   return (
 *     <ViewingKeyManager
 *       keys={keys}
 *       onGenerateKey={async (label) => {
 *         const newKey = await generateViewingKey(label)
 *         setKeys([...keys, newKey])
 *         return newKey
 *       }}
 *     />
 *   )
 * }
 * ```
 */
export function ViewingKeyManager({
  keys,
  onGenerateKey,
  onExportKey,
  onImportKey,
  onShareKey,
  onRevokeKey,
  onBackupAcknowledged: _onBackupAcknowledged,
  showBackupReminder = true,
  className = '',
  size = 'md',
}: ViewingKeyManagerProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('idle')
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [generateLabel, setGenerateLabel] = useState('')
  const [exportFormat, setExportFormat] = useState<KeyExportFormat>('encrypted_file')
  const [exportPassword, setExportPassword] = useState('')
  const [importSource, setImportSource] = useState<KeyImportSource>('file')
  const [importData, setImportData] = useState('')
  const [shareRecipient, setShareRecipient] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get selected key
  const selectedKey = useMemo(
    () => keys.find((k) => k.id === selectedKeyId),
    [keys, selectedKeyId]
  )

  // Keys that need backup
  const keysNeedingBackup = useMemo(
    () => keys.filter((k) => k.status === 'active' && k.usageHistory.every((u) => u.action !== 'exported')),
    [keys]
  )

  // Reset form
  const resetForm = useCallback(() => {
    setWizardStep('idle')
    setSelectedKeyId(null)
    setError(null)
    setGenerateLabel('')
    setExportFormat('encrypted_file')
    setExportPassword('')
    setImportSource('file')
    setImportData('')
    setShareRecipient('')
  }, [])

  // Handle generate key
  const handleGenerate = useCallback(async () => {
    if (!onGenerateKey) return

    setIsLoading(true)
    setError(null)

    try {
      await onGenerateKey(generateLabel || undefined)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key')
    } finally {
      setIsLoading(false)
    }
  }, [onGenerateKey, generateLabel, resetForm])

  // Handle export key
  const handleExport = useCallback(async () => {
    if (!onExportKey || !selectedKeyId) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await onExportKey(selectedKeyId, exportFormat, exportPassword || undefined)

      // Handle download if it's a blob
      if (result instanceof Blob) {
        const url = URL.createObjectURL(result)
        const a = document.createElement('a')
        a.href = url
        a.download = `viewing-key-${selectedKeyId.slice(0, 8)}.enc`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export key')
    } finally {
      setIsLoading(false)
    }
  }, [onExportKey, selectedKeyId, exportFormat, exportPassword, resetForm])

  // Handle import key
  const handleImport = useCallback(async () => {
    if (!onImportKey || !importData) return

    setIsLoading(true)
    setError(null)

    try {
      await onImportKey(importSource, importData)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import key')
    } finally {
      setIsLoading(false)
    }
  }, [onImportKey, importSource, importData, resetForm])

  // Handle share key
  const handleShare = useCallback(async () => {
    if (!onShareKey || !selectedKeyId || !shareRecipient) return

    setIsLoading(true)
    setError(null)

    try {
      await onShareKey(selectedKeyId, shareRecipient)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share key')
    } finally {
      setIsLoading(false)
    }
  }, [onShareKey, selectedKeyId, shareRecipient, resetForm])

  // Handle revoke key
  const handleRevoke = useCallback(async () => {
    if (!onRevokeKey || !selectedKeyId) return

    setIsLoading(true)
    setError(null)

    try {
      await onRevokeKey(selectedKeyId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key')
    } finally {
      setIsLoading(false)
    }
  }, [onRevokeKey, selectedKeyId, resetForm])

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImportData(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }, [])

  // Open action modal
  const openAction = useCallback((step: WizardStep, keyId?: string) => {
    setWizardStep(step)
    if (keyId) setSelectedKeyId(keyId)
    setError(null)
  }, [])

  return (
    <>
      <style>{styles}</style>

      <div className={`sip-vk-manager ${className}`} data-size={size}>
        {/* Backup reminder */}
        {showBackupReminder && keysNeedingBackup.length > 0 && (
          <div className="sip-vk-backup-reminder" data-testid="backup-reminder">
            <span className="sip-vk-backup-reminder-text">
              <AlertIcon />
              {keysNeedingBackup.length} key(s) not backed up
            </span>
            <button
              type="button"
              className="sip-vk-btn sip-vk-btn-secondary"
              onClick={() => {
                if (keysNeedingBackup[0]) {
                  openAction('export', keysNeedingBackup[0].id)
                }
              }}
            >
              Backup Now
            </button>
          </div>
        )}

        {/* Header */}
        <div className="sip-vk-header">
          <div className="sip-vk-header-title">
            <KeyIcon />
            <h2>Viewing Keys</h2>
          </div>
          <div className="sip-vk-header-actions">
            {onImportKey && (
              <button
                type="button"
                className="sip-vk-btn sip-vk-btn-primary"
                onClick={() => openAction('import')}
                aria-label="Import key"
              >
                <UploadIcon />
                Import
              </button>
            )}
            {onGenerateKey && (
              <button
                type="button"
                className="sip-vk-btn sip-vk-btn-primary"
                onClick={() => openAction('generate')}
                aria-label="Generate new key"
              >
                <PlusIcon />
                Generate
              </button>
            )}
          </div>
        </div>

        {/* Key list */}
        {keys.length === 0 ? (
          <div className="sip-vk-empty" data-testid="empty-state">
            <KeyIcon />
            <p>No viewing keys yet</p>
            {onGenerateKey && (
              <button
                type="button"
                className="sip-vk-btn sip-vk-btn-secondary"
                onClick={() => openAction('generate')}
              >
                Generate Your First Key
              </button>
            )}
          </div>
        ) : (
          <ul className="sip-vk-list" data-testid="key-list">
            {keys.map((key) => (
              <li key={key.id} className="sip-vk-item" data-testid={`key-item-${key.id}`}>
                <div className="sip-vk-item-info">
                  <div className="sip-vk-item-icon">
                    <KeyIcon />
                  </div>
                  <div className="sip-vk-item-details">
                    <div className="sip-vk-item-label">{key.label || 'Viewing Key'}</div>
                    <div className="sip-vk-item-key">{truncateKey(key.publicKey)}</div>
                    <div className="sip-vk-item-meta">
                      <span className="sip-vk-item-badge" data-status={key.status}>
                        {key.status}
                      </span>
                      <span className="sip-vk-item-date">Created {formatDate(key.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="sip-vk-item-actions">
                  {onExportKey && key.status === 'active' && (
                    <button
                      type="button"
                      className="sip-vk-item-action"
                      onClick={() => openAction('export', key.id)}
                      title="Export key"
                      aria-label="Export key"
                    >
                      <DownloadIcon />
                    </button>
                  )}
                  {onShareKey && key.status === 'active' && (
                    <button
                      type="button"
                      className="sip-vk-item-action"
                      onClick={() => openAction('share', key.id)}
                      title="Share key"
                      aria-label="Share key"
                    >
                      <ShareIcon />
                    </button>
                  )}
                  {onRevokeKey && key.status === 'active' && (
                    <button
                      type="button"
                      className="sip-vk-item-action"
                      onClick={() => openAction('revoke', key.id)}
                      title="Revoke key"
                      aria-label="Revoke key"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Generate Modal */}
        {wizardStep === 'generate' && (
          <div className="sip-vk-modal" role="dialog" aria-modal="true" data-testid="generate-modal">
            <div className="sip-vk-modal-content">
              <div className="sip-vk-modal-header">
                <h3 className="sip-vk-modal-title">Generate Viewing Key</h3>
                <button type="button" className="sip-vk-modal-close" onClick={resetForm}>
                  <XIcon />
                </button>
              </div>
              <div className="sip-vk-modal-body">
                <div className="sip-vk-warning">
                  <AlertIcon />
                  <div className="sip-vk-warning-text">
                    <strong>Important:</strong> A viewing key allows anyone who has it to see your
                    transaction details. Only share with trusted parties for compliance purposes.
                  </div>
                </div>
                <div className="sip-vk-form-group">
                  <label className="sip-vk-label" htmlFor="generate-label">
                    Key Label (optional)
                  </label>
                  <input
                    id="generate-label"
                    type="text"
                    className="sip-vk-input"
                    placeholder="e.g., Auditor Key, Tax Advisor"
                    value={generateLabel}
                    onChange={(e) => setGenerateLabel(e.target.value)}
                  />
                </div>
                {error && <div className="sip-vk-danger"><AlertIcon /><div className="sip-vk-danger-text">{error}</div></div>}
              </div>
              <div className="sip-vk-modal-footer">
                <button type="button" className="sip-vk-btn sip-vk-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sip-vk-btn sip-vk-btn-success"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {wizardStep === 'export' && selectedKey && (
          <div className="sip-vk-modal" role="dialog" aria-modal="true" data-testid="export-modal">
            <div className="sip-vk-modal-content">
              <div className="sip-vk-modal-header">
                <h3 className="sip-vk-modal-title">Export Viewing Key</h3>
                <button type="button" className="sip-vk-modal-close" onClick={resetForm}>
                  <XIcon />
                </button>
              </div>
              <div className="sip-vk-modal-body">
                <div className="sip-vk-form-group">
                  <label className="sip-vk-label" htmlFor="export-format">
                    Export Format
                  </label>
                  <select
                    id="export-format"
                    className="sip-vk-select"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as KeyExportFormat)}
                  >
                    <option value="encrypted_file">Encrypted File (Recommended)</option>
                    <option value="qr_code">QR Code</option>
                    <option value="plaintext">Plain Text (Not Recommended)</option>
                  </select>
                </div>
                {exportFormat === 'encrypted_file' && (
                  <div className="sip-vk-form-group">
                    <label className="sip-vk-label" htmlFor="export-password">
                      Encryption Password
                    </label>
                    <input
                      id="export-password"
                      type="password"
                      className="sip-vk-input"
                      placeholder="Enter a strong password"
                      value={exportPassword}
                      onChange={(e) => setExportPassword(e.target.value)}
                    />
                  </div>
                )}
                {exportFormat === 'qr_code' && (
                  <div className="sip-vk-qr-display">
                    <div className="sip-vk-qr-placeholder" data-testid="qr-placeholder">
                      <QrCodeIcon />
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      Scan to import key
                    </span>
                  </div>
                )}
                {exportFormat === 'plaintext' && (
                  <div className="sip-vk-danger">
                    <AlertIcon />
                    <div className="sip-vk-danger-text">
                      <strong>Warning:</strong> Exporting as plain text is not secure. The key will
                      be visible to anyone with access to your clipboard or screen.
                    </div>
                  </div>
                )}
                {error && <div className="sip-vk-danger"><AlertIcon /><div className="sip-vk-danger-text">{error}</div></div>}
              </div>
              <div className="sip-vk-modal-footer">
                <button type="button" className="sip-vk-btn sip-vk-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sip-vk-btn sip-vk-btn-success"
                  onClick={handleExport}
                  disabled={isLoading || (exportFormat === 'encrypted_file' && !exportPassword)}
                >
                  {isLoading ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {wizardStep === 'import' && (
          <div className="sip-vk-modal" role="dialog" aria-modal="true" data-testid="import-modal">
            <div className="sip-vk-modal-content">
              <div className="sip-vk-modal-header">
                <h3 className="sip-vk-modal-title">Import Viewing Key</h3>
                <button type="button" className="sip-vk-modal-close" onClick={resetForm}>
                  <XIcon />
                </button>
              </div>
              <div className="sip-vk-modal-body">
                <div className="sip-vk-form-group">
                  <label className="sip-vk-label" htmlFor="import-source">
                    Import From
                  </label>
                  <select
                    id="import-source"
                    className="sip-vk-select"
                    value={importSource}
                    onChange={(e) => {
                      setImportSource(e.target.value as KeyImportSource)
                      setImportData('')
                    }}
                  >
                    <option value="file">Encrypted File</option>
                    <option value="qr_code">QR Code</option>
                    <option value="text">Paste Text</option>
                  </select>
                </div>
                {importSource === 'file' && (
                  <div className="sip-vk-form-group">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".enc,.json,.txt"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <div
                      className="sip-vk-file-upload"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="file-upload"
                    >
                      <FileIcon />
                      <span className="sip-vk-file-upload-text">
                        {importData ? 'File loaded' : 'Click to select file'}
                      </span>
                      <span className="sip-vk-file-upload-hint">.enc, .json, or .txt</span>
                    </div>
                  </div>
                )}
                {importSource === 'qr_code' && (
                  <div className="sip-vk-qr-display">
                    <div className="sip-vk-qr-placeholder" data-testid="qr-scanner">
                      <QrCodeIcon />
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      Position QR code in camera view
                    </span>
                  </div>
                )}
                {importSource === 'text' && (
                  <div className="sip-vk-form-group">
                    <label className="sip-vk-label" htmlFor="import-data">
                      Key Data
                    </label>
                    <textarea
                      id="import-data"
                      className="sip-vk-textarea"
                      placeholder="Paste your viewing key here..."
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                    />
                  </div>
                )}
                {error && <div className="sip-vk-danger"><AlertIcon /><div className="sip-vk-danger-text">{error}</div></div>}
              </div>
              <div className="sip-vk-modal-footer">
                <button type="button" className="sip-vk-btn sip-vk-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sip-vk-btn sip-vk-btn-success"
                  onClick={handleImport}
                  disabled={isLoading || !importData}
                >
                  {isLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {wizardStep === 'share' && selectedKey && (
          <div className="sip-vk-modal" role="dialog" aria-modal="true" data-testid="share-modal">
            <div className="sip-vk-modal-content">
              <div className="sip-vk-modal-header">
                <h3 className="sip-vk-modal-title">Share Viewing Key</h3>
                <button type="button" className="sip-vk-modal-close" onClick={resetForm}>
                  <XIcon />
                </button>
              </div>
              <div className="sip-vk-modal-body">
                <div className="sip-vk-warning">
                  <AlertIcon />
                  <div className="sip-vk-warning-text">
                    <strong>Warning:</strong> Sharing this viewing key will allow the recipient to
                    see all transactions associated with this key. Only share with trusted parties.
                  </div>
                </div>
                <div className="sip-vk-form-group">
                  <label className="sip-vk-label" htmlFor="share-recipient">
                    Recipient Address or Email
                  </label>
                  <input
                    id="share-recipient"
                    type="text"
                    className="sip-vk-input"
                    placeholder="e.g., auditor.near or auditor@company.com"
                    value={shareRecipient}
                    onChange={(e) => setShareRecipient(e.target.value)}
                  />
                </div>
                {error && <div className="sip-vk-danger"><AlertIcon /><div className="sip-vk-danger-text">{error}</div></div>}
              </div>
              <div className="sip-vk-modal-footer">
                <button type="button" className="sip-vk-btn sip-vk-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sip-vk-btn sip-vk-btn-success"
                  onClick={handleShare}
                  disabled={isLoading || !shareRecipient}
                >
                  {isLoading ? 'Sharing...' : 'Share Key'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revoke Modal */}
        {wizardStep === 'revoke' && selectedKey && (
          <div className="sip-vk-modal" role="dialog" aria-modal="true" data-testid="revoke-modal">
            <div className="sip-vk-modal-content">
              <div className="sip-vk-modal-header">
                <h3 className="sip-vk-modal-title">Revoke Viewing Key</h3>
                <button type="button" className="sip-vk-modal-close" onClick={resetForm}>
                  <XIcon />
                </button>
              </div>
              <div className="sip-vk-modal-body">
                <div className="sip-vk-danger">
                  <AlertIcon />
                  <div className="sip-vk-danger-text">
                    <strong>This action cannot be undone.</strong> Revoking this key will
                    immediately prevent anyone with this key from viewing your transactions.
                    {selectedKey.sharedWith && selectedKey.sharedWith.length > 0 && (
                      <> This key has been shared with {selectedKey.sharedWith.length} recipient(s).</>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '14px', color: '#374151', marginBottom: 0 }}>
                  Are you sure you want to revoke the key "{selectedKey.label || 'Viewing Key'}"?
                </p>
                {error && <div className="sip-vk-danger" style={{ marginTop: 16 }}><AlertIcon /><div className="sip-vk-danger-text">{error}</div></div>}
              </div>
              <div className="sip-vk-modal-footer">
                <button type="button" className="sip-vk-btn sip-vk-btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="sip-vk-btn sip-vk-btn-danger"
                  onClick={handleRevoke}
                  disabled={isLoading}
                >
                  {isLoading ? 'Revoking...' : 'Revoke Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Hook to manage viewing keys
 */
export function useViewingKeyManager(initialKeys: ViewingKey[] = []) {
  const [keys, setKeys] = useState<ViewingKey[]>(initialKeys)

  const addKey = useCallback((key: ViewingKey) => {
    setKeys((prev) => [...prev, key])
  }, [])

  const removeKey = useCallback((keyId: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== keyId))
  }, [])

  const updateKey = useCallback((keyId: string, updates: Partial<ViewingKey>) => {
    setKeys((prev) =>
      prev.map((k) => (k.id === keyId ? { ...k, ...updates } : k))
    )
  }, [])

  const revokeKey = useCallback((keyId: string) => {
    updateKey(keyId, {
      status: 'revoked',
      usageHistory: [
        ...(keys.find((k) => k.id === keyId)?.usageHistory || []),
        { timestamp: Date.now(), action: 'revoked' },
      ],
    })
  }, [keys, updateKey])

  const activeKeys = useMemo(() => keys.filter((k) => k.status === 'active'), [keys])
  const revokedKeys = useMemo(() => keys.filter((k) => k.status === 'revoked'), [keys])

  return {
    keys,
    setKeys,
    addKey,
    removeKey,
    updateKey,
    revokeKey,
    activeKeys,
    revokedKeys,
  }
}

export default ViewingKeyManager
