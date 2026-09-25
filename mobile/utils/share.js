import { Platform, Share as NativeShare } from 'react-native'

/**
 * Platform branch for sharing:
 * Web: Uses navigator.share (guarded so window/navigator never leaks into native)
 * Native: Uses React Native's Share.share
 * Touches exactly this ONE call site across the entire application.
 */
export async function shareContent({ title, message, url }) {
  const sharePlatformBranch = Platform.select({
    web: async () => {
      // Safe guard: only invoke browser web APIs on web
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.share) {
        return navigator.share({ title, text: message, url: url || window.location?.href })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${title}: ${message}`)
        return { action: 'copiedToClipboard' }
      }
      return { action: 'unsupported' }
    },
    default: async () => {
      // Native iOS & Android path using React Native Share API
      return NativeShare.share({
        title,
        message: `${message} ${url ? '\n' + url : ''}`
      })
    }
  })

  return sharePlatformBranch()
}
