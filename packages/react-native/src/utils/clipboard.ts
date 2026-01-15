/**
 * Clipboard Utilities for React Native
 *
 * Provides cross-platform clipboard access with fallback support.
 */

/**
 * Check if clipboard module is available
 */
let Clipboard: { setString: (text: string) => void; getString: () => Promise<string> } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  Clipboard = require('@react-native-clipboard/clipboard').default
} catch {
  // Clipboard not available
}

/**
 * Copy text to clipboard
 *
 * @param text - Text to copy
 * @returns true if successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!Clipboard) {
    console.warn(
      '@react-native-clipboard/clipboard is not available. ' +
      'Install it for clipboard functionality.'
    )
    return false
  }

  try {
    Clipboard.setString(text)
    return true
  } catch {
    return false
  }
}

/**
 * Read text from clipboard
 *
 * @returns Clipboard contents or empty string
 */
export async function readFromClipboard(): Promise<string> {
  if (!Clipboard) {
    console.warn(
      '@react-native-clipboard/clipboard is not available. ' +
      'Install it for clipboard functionality.'
    )
    return ''
  }

  try {
    return await Clipboard.getString()
  } catch {
    return ''
  }
}

/**
 * Check if clipboard is available
 */
export function isClipboardAvailable(): boolean {
  return !!Clipboard
}
