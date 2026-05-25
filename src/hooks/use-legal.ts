/**
 * Legal hooks — mirrors apps/web's legal endpoints surface.
 *
 *   GET  /legal/documents?locale=he      (public)
 *   GET  /legal/consents/status          (authenticated)
 *   POST /legal/consents                 (authenticated)
 *
 * Single-source of truth for the legal-acceptance flow on mobile.
 */
import type {
  ConsentContext,
  ConsentStatusItem,
  LegalDocumentResponse,
  LegalDocumentType,
} from '@fitkit/shared';
import { useApiQuery, useApiSend } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';

/** Latest published version of each legal document for a locale.
 *  Public endpoint — no auth required, but we don't need to special-case
 *  that here since `useApiQuery` will still attach the Bearer header if
 *  one's available, and the API ignores it on public routes. */
export function useLegalDocuments(locale: 'he' | 'en' | 'ru' = 'he') {
  return useApiQuery<ApiEnvelope<LegalDocumentResponse[]>>({
    path: `/legal/documents?locale=${locale}`,
    queryKey: ['/legal/documents', locale],
  });
}

/** Per-document consent status for the current user. */
export function useConsentStatus() {
  return useApiQuery<ApiEnvelope<ConsentStatusItem[]>>({
    path: '/legal/consents/status',
    queryKey: ['/legal/consents/status'],
  });
}

export interface RecordConsentInput {
  types: LegalDocumentType[];
  context: ConsentContext;
  organizationId?: string;
}

/** Submit a batch consent — records IP + UA + timestamp server-side. */
export function useRecordConsent() {
  return useApiSend<ApiEnvelope<{ recorded: true }>, RecordConsentInput>({
    path: '/legal/consents',
    method: 'POST',
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Maps a document type to the marketing-site slug (matches web's TYPE_SLUG). */
export const LEGAL_DOC_SLUG: Record<LegalDocumentType, string> = {
  terms_of_use: 'terms-of-use',
  privacy_policy: 'privacy-policy',
  fitness_waiver: 'fitness-waiver',
  cookie_policy: 'cookie-policy',
  acceptable_use: 'acceptable-use',
};

export function marketingUrlForType(type: LegalDocumentType): string {
  return `https://fitkit.fit/${LEGAL_DOC_SLUG[type]}`;
}
