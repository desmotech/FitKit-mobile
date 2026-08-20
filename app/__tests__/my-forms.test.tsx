/**
 * Profile → My Forms — pins the member's copy of their paperwork (FIT-277).
 *
 * A signed compliance form is a legal document the member is entitled to
 * keep, so its row carries a download action that resolves the presigned
 * PDF link and hands it to the in-app browser. Nothing else offers it:
 * a form still awaiting signature has no PDF, and check-ins never
 * produce one.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import MyFormsScreen from '../(tabs)/profile/forms/index';
import { formStringsFor } from '@/i18n/form-strings';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
}));

const S = formStringsFor('he');
const PDF_URL = 'https://r2.example/compliance/signed.pdf?sig=abc';

function form(overrides: Record<string, unknown> = {}) {
  return {
    id: 'form_1',
    organizationId: TEST_ORG,
    kind: 'compliance',
    typeKey: 'health_declaration',
    name: 'הצהרת בריאות',
    locale: 'he',
    fields: [],
    version: 1,
    bodyRichtext: null,
    validityPeriodDays: null,
    recurrence: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
    archivedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function instance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst_signed',
    organizationId: TEST_ORG,
    formId: 'form_1',
    formVersion: 1,
    kind: 'compliance',
    assigneeUserId: 'user_test',
    assignedByUserId: null,
    status: 'signed',
    scheduledFor: null,
    sentAt: null,
    openedAt: null,
    answeredAt: '2026-07-10T10:00:00.000Z',
    reviewedAt: null,
    archivedAt: null,
    expiresAt: null,
    answers: {},
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  };
}

/** Stage /forms/mine, and record every PDF-link request the screen makes. */
function stageForms(
  entries: { instance: unknown; form: unknown }[],
  pdf: () => Response = () =>
    HttpResponse.json({ data: { url: PDF_URL, expiresInSeconds: 2592000 } }),
) {
  const pdfRequests: string[] = [];
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/forms/mine`), () =>
      HttpResponse.json({ data: entries }),
    ),
    http.get(
      api(`/organizations/${TEST_ORG}/forms/instances/:instanceId/pdf`),
      ({ params }) => {
        pdfRequests.push(String(params.instanceId));
        return pdf();
      },
    ),
  );
  return pdfRequests;
}

beforeEach(() => {
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
});

describe('My Forms — signed PDF', () => {
  it('opens the presigned PDF for a signed compliance form', async () => {
    const pdfRequests = stageForms([
      { instance: instance(), form: form() },
    ]);
    const user = userEvent.setup();
    await renderWithProviders(<MyFormsScreen />);

    const download = await screen.findByLabelText(S.downloadPdf);
    await user.press(download);

    await waitFor(() => expect(pdfRequests).toEqual(['inst_signed']));
    await waitFor(() =>
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
        PDF_URL,
        expect.any(Object),
      ),
    );
  });

  it('offers no download for a form still awaiting signature', async () => {
    stageForms([
      {
        instance: instance({ id: 'inst_pending', status: 'pending' }),
        form: form(),
      },
    ]);
    await renderWithProviders(<MyFormsScreen />);

    expect(await screen.findByText(S.statusPending)).toBeOnTheScreen();
    expect(screen.queryByLabelText(S.downloadPdf)).toBeNull();
  });

  it('offers no download for a check-in — there is no signed PDF behind it', async () => {
    stageForms([
      {
        instance: instance({
          id: 'inst_checkin',
          kind: 'check_in',
          status: 'answered',
        }),
        form: form({ kind: 'check_in', name: 'צ׳ק-אין שבועי' }),
      },
    ]);
    await renderWithProviders(<MyFormsScreen />);

    expect(await screen.findByText(S.statusAnswered)).toBeOnTheScreen();
    expect(screen.queryByLabelText(S.downloadPdf)).toBeNull();
  });

  it('surfaces a localized error when the link cannot be resolved, and opens nothing', async () => {
    stageForms([{ instance: instance(), form: form() }], () =>
      HttpResponse.json(
        { message: 'No signed PDF on file for this form instance' },
        { status: 404 },
      ),
    );
    const user = userEvent.setup();
    await renderWithProviders(<MyFormsScreen />);

    await user.press(await screen.findByLabelText(S.downloadPdf));

    expect(await screen.findByText(S.downloadPdfFailed)).toBeOnTheScreen();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

/** The screen renders dates with the member's UI language (he in tests). */
const fmtHe = (iso: string) =>
  new Date(iso).toLocaleDateString('he', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

describe('My Forms — one card per form family', () => {
  it('consolidates signed versions into one card: latest up front, older behind a disclosure with its own PDF', async () => {
    stageForms([
      {
        instance: instance({
          id: 'inst_v2',
          formId: 'form_2',
          formVersion: 2,
          answeredAt: '2026-08-01T10:00:00.000Z',
          createdAt: '2026-08-01T09:00:00.000Z',
        }),
        form: form({ id: 'form_2', version: 2 }),
      },
      {
        instance: instance({ id: 'inst_v1' }),
        form: form(),
      },
    ]);
    const user = userEvent.setup();
    await renderWithProviders(<MyFormsScreen />);

    // One card, not two identically-named rows: latest version + date shown.
    expect(await screen.findByText(S.versionLabel(2))).toBeOnTheScreen();
    expect(
      screen.getByText(fmtHe('2026-08-01T10:00:00.000Z')),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('הצהרת בריאות')).toHaveLength(1);
    expect(screen.queryByText(S.versionLabel(1))).toBeNull();

    // The earlier signed copy is one tap away, download included.
    await user.press(screen.getByText(S.showPrevious(1)));
    expect(await screen.findByText(S.versionLabel(1))).toBeOnTheScreen();
    expect(screen.getAllByLabelText(S.downloadPdf)).toHaveLength(2);
  });

  it('says a pending form replaces the version the member already signed', async () => {
    stageForms([
      {
        instance: instance({
          id: 'inst_v3',
          formId: 'form_3',
          formVersion: 3,
          status: 'pending',
          answeredAt: null,
          createdAt: '2026-08-10T09:00:00.000Z',
        }),
        form: form({ id: 'form_3', version: 3 }),
      },
      {
        instance: instance({
          id: 'inst_v2',
          formId: 'form_2',
          formVersion: 2,
          answeredAt: '2026-08-01T10:00:00.000Z',
        }),
        form: form({ id: 'form_2', version: 2 }),
      },
    ]);
    await renderWithProviders(<MyFormsScreen />);

    // The re-ask names its reason — no more "why is this here twice?".
    expect(
      await screen.findByText(
        S.replacesSigned(fmtHe('2026-08-01T10:00:00.000Z')),
      ),
    ).toBeOnTheScreen();
  });

  it('marks a signed form whose validity window lapsed as expired', async () => {
    stageForms([
      {
        instance: instance({ expiresAt: '2026-01-01T00:00:00.000Z' }),
        form: form({ validityPeriodDays: 365 }),
      },
    ]);
    await renderWithProviders(<MyFormsScreen />);

    expect(
      await screen.findByText(
        S.signatureExpired(fmtHe('2026-01-01T00:00:00.000Z')),
      ),
    ).toBeOnTheScreen();
  });
});
