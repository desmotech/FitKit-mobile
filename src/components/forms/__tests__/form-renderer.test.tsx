/**
 * <FormRenderer> resilience (FIT-279).
 *
 * Two guarantees a member depends on and used to be missing:
 *   1. What they typed survives leaving the screen — drafts are written
 *      to AsyncStorage, restored on the next mount (winning over the
 *      server's own answers, which are older by definition), and dropped
 *      once the form is actually submitted.
 *   2. A submit that fails after the uploads doesn't re-upload anything
 *      on the retry — the r2Key from the first pass is reused.
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormRenderer } from '../form-renderer';
import { formDraftStorageKey } from '@/lib/form-draft';
import { formStringsFor } from '@/i18n/form-strings';
import type { FormAnswers, FormResponse } from '@/types/forms';
import { renderWithProviders } from '../../../../test/render';

const S = formStringsFor('he');
const DRAFT_KEY = 'instance:inst_1';

const FORM: FormResponse = {
  id: 'form_1',
  organizationId: 'org_test',
  kind: 'compliance',
  typeKey: 'health_declaration',
  name: 'Health declaration',
  locale: 'en',
  fields: [
    { id: 'full_name', label: 'Full name', type: 'text', required: true },
    { id: 'notes', label: 'Notes', type: 'text', required: false },
  ],
  version: 1,
  bodyRichtext: null,
  validityPeriodDays: null,
  recurrence: null,
  publishedAt: '2026-07-01T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

/** A form whose only required field is an already-captured signature. */
const SIGNED_FORM: FormResponse = {
  ...FORM,
  fields: [{ id: 'sig', label: 'Signature', type: 'signature', required: true }],
};

async function seedDraft(answers: FormAnswers, savedAt = Date.now()) {
  await AsyncStorage.setItem(
    formDraftStorageKey(DRAFT_KEY),
    JSON.stringify({ v: 1, savedAt, answers }),
  );
}

async function storedDraft(): Promise<FormAnswers | null> {
  const raw = await AsyncStorage.getItem(formDraftStorageKey(DRAFT_KEY));
  return raw ? (JSON.parse(raw).answers as FormAnswers) : null;
}

const noopUpload = jest.fn(async () => ({
  r2Key: 'org/forms/inst_1/sig.png',
  mime: 'image/png',
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  noopUpload.mockClear();
});

describe('FormRenderer drafts', () => {
  it('restores what the member typed before they left the screen', async () => {
    await seedDraft({ full_name: 'Dana Levi' });

    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Full name').props.value).toBe('Dana Levi'),
    );
  });

  it('prefers the local draft over the answers already on the instance', async () => {
    await seedDraft({ full_name: 'Draft name' });

    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        initialAnswers={{ full_name: 'Server name' }}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Full name').props.value).toBe('Draft name'),
    );
  });

  it('falls back to the instance answers when there is no draft', async () => {
    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        initialAnswers={{ full_name: 'Server name' }}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    expect(screen.getByLabelText('Full name').props.value).toBe('Server name');
  });

  it('persists edits on a debounce, without waiting for the screen to close', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    await user.type(screen.getByLabelText('Full name'), 'Dana');

    await waitFor(async () =>
      expect(await storedDraft()).toEqual({ full_name: 'Dana' }),
    );
  });

  it('flushes the last edit when the screen unmounts inside the debounce window', async () => {
    const user = userEvent.setup();
    const view = await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    await user.type(screen.getByLabelText('Notes'), 'knee injury');
    await act(async () => {
      view.unmount();
    });

    await waitFor(async () =>
      expect(await storedDraft()).toEqual({ notes: 'knee injury' }),
    );
  });

  it('never persists anything without a draftKey', async () => {
    const user = userEvent.setup();
    await renderWithProviders(
      <FormRenderer
        form={FORM}
        onSubmit={jest.fn()}
        uploadAttachment={noopUpload}
      />,
    );

    await user.type(screen.getByLabelText('Full name'), 'Dana');

    await waitFor(() => expect(AsyncStorage.getAllKeys()).resolves.toEqual([]));
  });

  it('drops the draft once the form is submitted', async () => {
    await seedDraft({ full_name: 'Dana Levi' });
    const onSubmit = jest.fn(async () => undefined);
    const user = userEvent.setup();

    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        onSubmit={onSubmit}
        uploadAttachment={noopUpload}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Full name').props.value).toBe('Dana Levi'),
    );

    await user.press(screen.getByText(S.submit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(async () => expect(await storedDraft()).toBeNull());
  });

  it('keeps the draft when the submit fails, so a retry still has the answers', async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const user = userEvent.setup();

    await renderWithProviders(
      <FormRenderer
        form={FORM}
        draftKey={DRAFT_KEY}
        initialAnswers={{ full_name: 'Dana Levi' }}
        onSubmit={onSubmit}
        uploadAttachment={noopUpload}
      />,
    );

    await user.press(screen.getByText(S.submit));

    expect(await screen.findByText('Network request failed')).toBeOnTheScreen();
    await waitFor(async () =>
      expect(await storedDraft()).toEqual({ full_name: 'Dana Levi' }),
    );
  });
});

describe('FormRenderer uploads', () => {
  it('reuses the uploaded attachment when a failed submit is retried', async () => {
    const onSubmit = jest
      .fn<Promise<void>, [FormAnswers]>()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    await renderWithProviders(
      <FormRenderer
        form={SIGNED_FORM}
        draftKey={DRAFT_KEY}
        initialAnswers={{ sig: 'file:///tmp/signature.png' }}
        onSubmit={onSubmit}
        uploadAttachment={noopUpload}
      />,
    );

    await user.press(screen.getByText(S.submit));
    expect(await screen.findByText('Network request failed')).toBeOnTheScreen();

    await user.press(screen.getByText(S.submit));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    // The PNG was PUT to R2 exactly once — the retry went straight to the
    // POST with the r2Key from the first pass.
    expect(noopUpload).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[1][0]).toEqual({
      sig: { r2Key: 'org/forms/inst_1/sig.png', mime: 'image/png' },
    });
  });

  it('keeps the uploaded signature in the draft so a stale local file cannot strand it', async () => {
    const onSubmit = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const user = userEvent.setup();

    await renderWithProviders(
      <FormRenderer
        form={SIGNED_FORM}
        draftKey={DRAFT_KEY}
        initialAnswers={{ sig: 'file:///tmp/signature.png' }}
        onSubmit={onSubmit}
        uploadAttachment={noopUpload}
      />,
    );

    await user.press(screen.getByText(S.submit));

    expect(await screen.findByText('Network request failed')).toBeOnTheScreen();
    await waitFor(async () =>
      expect(await storedDraft()).toEqual({
        sig: { r2Key: 'org/forms/inst_1/sig.png', mime: 'image/png' },
      }),
    );
  });
});
