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
