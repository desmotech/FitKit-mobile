/**
 * Queued changes that came back refused.
 *
 * A replayed booking can fail for reasons that only became true *while the
 * member was offline* — the class filled up, a plan lapsed, the cancellation
 * window closed. There is no screen to alert at that moment: the mutation may
 * be resuming during a cold start, minutes after the app was launched from a
 * notification, with the member nowhere near the schedule. So the failure is
 * recorded here and surfaced by the offline banner, which is mounted app-wide.
 *
 * A plain module-level store rather than React state or a query: the writer is
 * a mutation callback registered on the query client (no component, no hooks),
 * and the reader is a banner that may not be mounted yet when the write lands.
 * `useSyncExternalStore` bridges the two. The array identity only changes when
 * the contents do, so the snapshot is safe to return directly.
 */
export interface SyncFailure {
  sessionId: string;
  kind: 'book' | 'cancel';
  /** The server's own wording, when it gave one. Diagnostic, not member copy. */
  reason?: string;
}

let failures: readonly SyncFailure[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeSyncFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncFailures(): readonly SyncFailure[] {
  return failures;
}

/**
 * Record a refused replay. Deduped by session + kind so a mutation that
 * retries its way to the same refusal is one notice, not five.
 */
export function recordSyncFailure(failure: SyncFailure): void {
  const exists = failures.some(
    (f) => f.sessionId === failure.sessionId && f.kind === failure.kind,
  );
  if (exists) return;
  failures = [...failures, failure];
  emit();
}

/** Member acknowledged the notice (or signed out). */
export function clearSyncFailures(): void {
  if (failures.length === 0) return;
  failures = [];
  emit();
}
