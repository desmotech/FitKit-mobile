/**
 * Opening exercise demo videos.
 *
 * Exercise demos are curated as YouTube / Vimeo / web-page links. expo-video's
 * native player (AVPlayer on iOS) can only decode a *direct media stream*
 * (.mp4/.m3u8/…) — handed a YouTube watch page it fails with "cannot open
 * URL" every single time, which is why the in-app player appeared to fail
 * constantly. Those links belong in an in-app browser
 * (SFSafariViewController / Chrome Custom Tabs), where they play reliably
 * with the platform's own video chrome. Genuine direct-media files still use
 * the native fullscreen player at `workouts/[id]/video`.
 *
 * Mirrors the in-app-browser idiom already used by `openLegalDoc`.
 */
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/** File extensions expo-video's native player can decode directly. */
const DIRECT_MEDIA_RE = /\.(mp4|m4v|mov|webm|m3u8|mpd)(?:[?#]|$)/i;

/**
 * True when `url` points at a direct media file the native player can
 * stream. Anything else (a YouTube/Vimeo/web page) must open in a browser.
 */
export function isDirectMediaUrl(url: string): boolean {
  return DIRECT_MEDIA_RE.test(url);
}

export interface WatchDemoInput {
  url: string;
  title?: string;
  /**
   * Satisfies the `[id]` segment of the native video route. The player
   * screen itself ignores it — it only reads `url`/`title`.
   */
  routeId: string;
}

/**
 * Returns a function that opens an exercise demo, routing direct-media
 * files to the native player and web links (YouTube/Vimeo) to the in-app
 * browser.
 */
export function useWatchExerciseDemo() {
  const router = useRouter();
  return useCallback(
    async ({ url, title, routeId }: WatchDemoInput) => {
      if (isDirectMediaUrl(url)) {
        router.push({
          pathname: '/(tabs)/workouts/[id]/video',
          params: { id: routeId, url, title: title ?? '' },
        });
        return;
      }
      try {
        await WebBrowser.openBrowserAsync(url, {
          // iOS Safari View Controller, presented fullscreen so a demo feels
          // immersive. Brand-tinted controls to match the app.
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: '#0E8C8C',
          dismissButtonStyle: 'done',
          // Android: Chrome Custom Tabs with the same brand tint.
          toolbarColor: '#000000',
          enableBarCollapsing: true,
        });
      } catch {
        // SVC / Custom Tabs unavailable — hand off to the system browser.
        Linking.openURL(url).catch(() => undefined);
      }
    },
    [router],
  );
}
