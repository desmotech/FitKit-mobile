/**
 * <openLegalDoc> — opens a legal document in an in-app browser surface
 * (Safari View Controller on iOS / Chrome Custom Tab on Android) via
 * `expo-web-browser`. This is the iOS-native idiom for "show external
 * content without leaving the app" — same pattern Apple's own Settings
 * uses for the Privacy Policy / Terms links.
 *
 * We intentionally do NOT inline a WebView dialog the way the web does.
 * On mobile, SVC / Custom Tabs gives the user:
 *   - Reader mode + text-size controls
 *   - Cached page rendering
 *   - Native dismiss (drag-down sheet on iOS 17+)
 *   - Cookie isolation from the rest of Safari
 *
 * Falls back to `Linking.openURL` if the platform doesn't support
 * in-app browsers.
 */
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import type { LegalDocumentType } from '@taikan/shared';
import { marketingUrlForType } from '@/hooks/use-legal';

/**
 * Open the given legal document in an in-app browser sheet.
 * Honors the active locale via the URL slug (the marketing site routes
 * each doc to the locale-appropriate page server-side).
 */
export async function openLegalDoc(type: LegalDocumentType): Promise<void> {
  const url = marketingUrlForType(type);
  try {
    await WebBrowser.openBrowserAsync(url, {
      // iOS Safari View Controller styling. Brand-tinted controls so the
      // surface feels like a continuation of the app, not a hard context
      // switch.
      controlsColor: '#0E8C8C',
      toolbarColor: '#FFFFFF',
      dismissButtonStyle: 'close',
      // Android: Chrome Custom Tabs with the same brand tint.
      showTitle: true,
      enableBarCollapsing: true,
    });
  } catch {
    // SVC / Custom Tabs unavailable — fall back to the system browser.
    Linking.openURL(url).catch(() => undefined);
  }
}
