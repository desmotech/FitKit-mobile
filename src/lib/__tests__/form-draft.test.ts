/**
 * Form drafts (FIT-279) — the durable half of "don't lose what I typed".
 *
 * These are the guarantees <FormRenderer> leans on: a round-trip that
 * preserves every answer type, a clear that actually removes the row,
 * and a read path that refuses to hand back anything stale or corrupt
 * (a bad draft must never be able to wedge a member out of their form).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearFormDraft,
  DRAFT_MAX_AGE_MS,
  formDraftStorageKey,
  hasAnyAnswer,
  loadFormDraft,
  saveFormDraft,
} from '../form-draft';
import type { FormAnswers } from '@/types/forms';

const KEY = 'instance:inst_1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('form draft store', () => {
  it('round-trips every answer shape a form can hold', async () => {
    const answers: FormAnswers = {
      full_name: 'Dana Levi',
      age: 34,
      agrees: true,
      goals: ['strength', 'mobility'],
      signature: { r2Key: 'org/forms/inst_1/sig.png', mime: 'image/png' },
      photos: [{ r2Key: 'org/forms/inst_1/a.jpg' }],
    };

    await saveFormDraft(KEY, answers);

    expect(await loadFormDraft(KEY)).toEqual(answers);
  });

  it('namespaces the storage key so drafts cannot collide with settings', async () => {
    await saveFormDraft(KEY, { full_name: 'Dana' });

    expect(formDraftStorageKey(KEY)).toBe('taikan:form-draft:instance:inst_1');
    expect(await AsyncStorage.getItem(formDraftStorageKey(KEY))).not.toBeNull();
  });

  it('keeps drafts of different instances apart', async () => {
    await saveFormDraft('instance:a', { full_name: 'A' });
    await saveFormDraft('instance:b', { full_name: 'B' });

    expect(await loadFormDraft('instance:a')).toEqual({ full_name: 'A' });
    expect(await loadFormDraft('instance:b')).toEqual({ full_name: 'B' });
  });

  it('clears the draft — the post-submit contract', async () => {
    await saveFormDraft(KEY, { full_name: 'Dana' });

    await clearFormDraft(KEY);

    expect(await loadFormDraft(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(formDraftStorageKey(KEY))).toBeNull();
  });

  it('treats an emptied form as "no draft" instead of storing a ghost', async () => {
    await saveFormDraft(KEY, { full_name: 'Dana' });

    // Everything cleared back out (empty string / empty list / undefined).
    await saveFormDraft(KEY, { full_name: '  ', goals: [] });

    expect(await loadFormDraft(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(formDraftStorageKey(KEY))).toBeNull();
  });

  it('drops a draft older than the retention window', async () => {
    await AsyncStorage.setItem(
      formDraftStorageKey(KEY),
      JSON.stringify({
        v: 1,
        savedAt: Date.now() - DRAFT_MAX_AGE_MS - 1000,
        answers: { full_name: 'Dana' },
      }),
    );

    expect(await loadFormDraft(KEY)).toBeNull();
    // Swept, not just ignored.
    expect(await AsyncStorage.getItem(formDraftStorageKey(KEY))).toBeNull();
  });

  it('keeps a draft that is still inside the retention window', async () => {
    await AsyncStorage.setItem(
      formDraftStorageKey(KEY),
      JSON.stringify({
        v: 1,
        savedAt: Date.now() - DRAFT_MAX_AGE_MS + 60_000,
        answers: { full_name: 'Dana' },
      }),
    );

    expect(await loadFormDraft(KEY)).toEqual({ full_name: 'Dana' });
  });

  it('drops unparseable JSON rather than throwing at the renderer', async () => {
    await AsyncStorage.setItem(formDraftStorageKey(KEY), '{not json');

    await expect(loadFormDraft(KEY)).resolves.toBeNull();
  });

  it('drops answers that no longer match the schema', async () => {
    await AsyncStorage.setItem(
      formDraftStorageKey(KEY),
      JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        // A shipped field-type change could leave shapes like this behind.
        answers: { weight: { kg: 80 } },
      }),
    );

    expect(await loadFormDraft(KEY)).toBeNull();
    expect(await AsyncStorage.getItem(formDraftStorageKey(KEY))).toBeNull();
  });

  it('returns null when nothing was ever saved', async () => {
    await expect(loadFormDraft('instance:never')).resolves.toBeNull();
  });
});

describe('hasAnyAnswer', () => {
  it.each([
    [{}, false],
    [{ a: '' }, false],
    [{ a: '   ' }, false],
    [{ a: [] }, false],
    [{ a: 'x' }, true],
    // 0 and false are real answers (a scale of 0, an unchecked-then-checked
    // box) — only blank strings and empty lists count as "nothing typed".
    [{ a: 0 }, true],
    [{ a: false }, true],
    [{ a: { r2Key: 'k' } }, true],
  ] as [FormAnswers, boolean][])('%j → %s', (answers, expected) => {
    expect(hasAnyAnswer(answers)).toBe(expected);
  });

  it('is false for null / undefined', () => {
    expect(hasAnyAnswer(null)).toBe(false);
    expect(hasAnyAnswer(undefined)).toBe(false);
  });
});
