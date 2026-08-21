/**
 * What, exactly, is running on this device.
 *
 * The profile footer used to show `v1.0.5 (42) · OTA 1f6bb22c`, and that
 * eight-character string answers less than it looks like it does:
 * `Updates.updateId` is a UUID the EAS servers mint when an update is
 * published. It is not a commit, and two devices showing different ones tells
 * you they differ without telling you why.
 *
 * Which update a device gets is decided by two things it never displayed:
 *
 *   channel        — baked into the binary from the eas.json build profile
 *                    (development / preview / production) and mapped to an
 *                    EAS branch. A store build and an internal build are on
 *                    different channels and will never converge.
 *   runtimeVersion — `{ policy: 'appVersion' }`, so literally `version` from
 *                    app.config.ts. An update published under 1.0.4 is not
 *                    delivered to a 1.0.5 binary, by design.
 *
 * And a third that no field can show: expo-updates downloads in the
 * background and applies on the NEXT launch, so a device that hasn't been
 * relaunched is legitimately one update behind.
 *
 * So this module reports all of it, plus the commit stamped into `extra` at
 * publish time (see `resolveCommit` in app.config.ts) — the one field that
 * maps a running bundle back to source.
 */
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

export interface BuildInfo {
  /** Marketing version, e.g. "1.0.5". */
  appVersion: string;
  /** Native build number / versionCode, owned by EAS. */
  nativeBuild: string;
  /** EAS Update channel this binary asks for. Null outside EAS Update
   *  (Expo Go, a bare `expo run:ios`). */
  channel: string | null;
  /** The compatibility key: only updates published under it are delivered. */
  runtimeVersion: string | null;
  /** Running the bundle baked into the binary, rather than an OTA. */
  isEmbedded: boolean;
  /** The EAS update UUID — meaningless on its own, decisive in `eas update:view`. */
  updateId: string | null;
  /** When that update was published. */
  updatedAt: Date | null;
  /** Short SHA of the commit this bundle was built from. */
  commit: string;
}

export function getBuildInfo(): BuildInfo {
  const extra = (Constants.expoConfig?.extra ?? {}) as { commit?: string };
  return {
    appVersion: Application.nativeApplicationVersion ?? '1.0.0',
    nativeBuild: Application.nativeBuildVersion ?? '?',
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    isEmbedded: Updates.isEmbeddedLaunch,
    // `updateId` is set for the embedded bundle too, so `isEmbeddedLaunch` is
    // what separates "shipped in the binary" from "came over the air".
    updateId: Updates.updateId ?? null,
    updatedAt: Updates.createdAt ?? null,
    commit: extra.commit ?? 'unknown',
  };
}

/**
 * The one-liner for the profile footer and the support-email subject:
 * `v1.0.5 (42) · production · a1b2c3d · OTA 1f6bb22c`.
 *
 * Channel leads the bundle identity because it is the field that explains
 * two people seeing different apps at the same version.
 */
export function buildInfoLine(info: BuildInfo): string {
  const bundle = info.isEmbedded
    ? 'embedded'
    : `OTA ${(info.updateId ?? 'unknown').slice(0, 8)}`;
  return [
    `v${info.appVersion} (${info.nativeBuild})`,
    info.channel,
    info.commit,
    bundle,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The full report, for the diagnostics dialog and for pasting into a bug
 * report. Deliberately plain `key: value` lines — this gets shared into
 * WhatsApp and email as often as it gets read on screen.
 */
export function buildInfoReport(info: BuildInfo, labels: BuildInfoLabels): string {
  return [
    `${labels.version}: ${info.appVersion} (${info.nativeBuild})`,
    `${labels.channel}: ${info.channel ?? '—'}`,
    `${labels.runtime}: ${info.runtimeVersion ?? '—'}`,
    `${labels.commit}: ${info.commit}`,
    `${labels.bundle}: ${info.isEmbedded ? labels.embedded : 'OTA'}`,
    `${labels.updateId}: ${info.updateId ?? '—'}`,
    `${labels.published}: ${info.updatedAt ? info.updatedAt.toISOString() : '—'}`,
  ].join('\n');
}

export interface BuildInfoLabels {
  title: string;
  version: string;
  channel: string;
  runtime: string;
  commit: string;
  bundle: string;
  embedded: string;
  updateId: string;
  published: string;
  share: string;
  close: string;
}
