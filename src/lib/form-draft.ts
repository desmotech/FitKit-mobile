/**
 * Per-instance form drafts (FIT-279).
 *
 * <FormRenderer> keeps answers in component state, which evaporates the
 * moment the screen unmounts — a member who backgrounds the app mid-way
 * through a health declaration, or gets pulled out by a phone call, came
 * back to a blank form. These helpers give that state a durable home so
 * the renderer can restore it on the next mount.
 *
 * Storage: AsyncStorage, the same engine behind settings-store and the
 * React Query persister (see `settings-store.ts` for why not MMKV).
 *
 * The payload is wrapped in a small envelope so we can (a) expire stale
 * drafts and (b) re-validate on read — anything that doesn't parse as a
 * `FormAnswers` map is dropped rather than fed back into the renderer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formAnswersSchema, type FormAnswers } from '@/types/forms';

const PREFIX = 'taikan:form-draft:';

/** Drafts older than this are ignored (and swept) on read. */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Debounce between an answer change and the write that persists it. */
export const DRAFT_DEBOUNCE_MS = 1000;

interface DraftEnvelope {
  v: 1;
  savedAt: number;
  answers: FormAnswers;
}

/** Namespaced AsyncStorage key for one draft id. */
export function formDraftStorageKey(draftKey: string): string {
  return `${PREFIX}${draftKey}`;
}

/** True when the map holds at least one answer worth persisting. */
export function hasAnyAnswer(answers: FormAnswers | null | undefined): boolean {
  if (!answers) return false;
  return Object.values(answers).some((v) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

/**
 * Reads a draft back. Returns null when there's nothing usable — missing,
 * expired, corrupt JSON, or answers that no longer match the schema (a
 * shipped field-type change, say). Never throws: a broken draft must not
 * be able to keep a member out of their form.
 */
export async function loadFormDraft(
  draftKey: string,
): Promise<FormAnswers | null> {
  try {
    const raw = await AsyncStorage.getItem(formDraftStorageKey(draftKey));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Partial<DraftEnvelope>;
    if (
      typeof envelope?.savedAt !== 'number' ||
      Date.now() - envelope.savedAt > DRAFT_MAX_AGE_MS
    ) {
      await clearFormDraft(draftKey);
      return null;
    }
    const parsed = formAnswersSchema.safeParse(envelope.answers);
    if (!parsed.success) {
      await clearFormDraft(draftKey);
      return null;
    }
    return hasAnyAnswer(parsed.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Persists a draft. An empty map clears instead of writing, so clearing
 * the last field doesn't leave a resurrectable ghost behind.
 */
export async function saveFormDraft(
  draftKey: string,
  answers: FormAnswers,
): Promise<void> {
  try {
    if (!hasAnyAnswer(answers)) {
      await clearFormDraft(draftKey);
      return;
    }
    const envelope: DraftEnvelope = { v: 1, savedAt: Date.now(), answers };
    await AsyncStorage.setItem(
      formDraftStorageKey(draftKey),
      JSON.stringify(envelope),
    );
  } catch {
    // Non-fatal: the in-memory answers still carry this session.
  }
}

/** Drops the draft — called after a successful submit. */
export async function clearFormDraft(draftKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(formDraftStorageKey(draftKey));
  } catch {
    // Non-fatal — see saveFormDraft.
  }
}
