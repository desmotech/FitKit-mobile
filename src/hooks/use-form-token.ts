/**
 * Public, token-gated form hooks for the FIT-178 signing UX.
 *
 *   GET  /forms/sign/:token         — fetch form + instance state
 *   POST /forms/sign/:token/submit  — submit answers + flip pending→signed
 *
 * These endpoints are explicitly @Public() on the server (auth guard
 * skipped) — the token IS the auth. So we deliberately bypass the
 * shared `fetchWithAuth` helper, which (a) attaches a Clerk bearer
 * that the API would just ignore, and (b) auto-signs-out on 401,
 * which would be wrong for a logged-out member tapping an email link.
 *
 * Error model the screen consumes:
 *   - `status: 'ok'`       — instance + form ready to render
 *   - `status: 'expired'`  — 410 Gone (server-side TTL passed or token burned)
 *   - `status: 'not-found'`— 404 (invalid token / never existed)
 *   - `status: 'invalid'`  — 400 (malformed token format)
 *   - `status: 'error'`    — anything else (network, 500, etc.)
 */
import {
  useMutation,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { apiUrl } from '@/lib/api';
import { useI18n } from '@/providers/i18n-provider';
import type {
  FormByTokenResponse,
  FormInstanceResponse,
  SubmitFormAnswersDto,
} from '@/types/forms';

export type FormTokenStatus =
  | 'ok'
  | 'expired'
  | 'not-found'
  | 'invalid'
  | 'error';

export interface FormTokenResult {
  status: FormTokenStatus;
  data?: FormByTokenResponse;
  /** Server-provided message, if any. Use for dev diagnostics, not for UX copy. */
  message?: string;
}

interface ApiEnvelope<T> {
  data: T;
}

/** Maps HTTP status → our union. */
function classify(status: number): FormTokenStatus {
  if (status === 200) return 'ok';
  if (status === 410) return 'expired';
  if (status === 404) return 'not-found';
  if (status === 400) return 'invalid';
  return 'error';
}

async function readMessage(res: Response): Promise<string | undefined> {
  try {
    const body = await res.clone().json();
    if (body?.message) {
      return Array.isArray(body.message)
        ? body.message.join(', ')
        : String(body.message);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Fetches the form + instance for a token. Always resolves (never throws
 * for HTTP errors) so the consumer can branch on `result.status`. React
 * Query's `error` slot is reserved for actual network / fetch failures.
 */
export function useFormByToken(
  token: string | undefined,
  options?: Pick<UseQueryOptions<FormTokenResult>, 'enabled'>,
) {
  const { lang } = useI18n();

  return useQuery<FormTokenResult>({
    queryKey: ['/forms/sign', token],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/forms/sign/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Locale': lang,
        },
      });
      const status = classify(res.status);
      if (status !== 'ok') {
        const message = await readMessage(res);
        return { status, message };
      }
      const body = (await res.json()) as ApiEnvelope<FormByTokenResponse>;
      return { status, data: body.data };
    },
    enabled: (options?.enabled ?? true) && !!token && token.length >= 32,
    // Don't auto-refetch a token result — it's single-use. Refetching
    // after success would race the burned-token side-effect on the API.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export interface SubmitFormByTokenResult {
  status: FormTokenStatus;
  data?: FormInstanceResponse;
  message?: string;
}

/** Submits answers for a token. Same status union as `useFormByToken`. */
export function useSubmitFormByToken(token: string | undefined) {
  const { lang } = useI18n();

  return useMutation<SubmitFormByTokenResult, Error, SubmitFormAnswersDto>({
    mutationFn: async (dto) => {
      if (!token) throw new Error('Missing token');
      const res = await fetch(`${apiUrl}/forms/sign/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Locale': lang,
        },
        body: JSON.stringify(dto),
      });
      const status = classify(res.status);
      if (status !== 'ok') {
        const message = await readMessage(res);
        return { status, message };
      }
      const body = (await res.json()) as ApiEnvelope<FormInstanceResponse>;
      return { status, data: body.data };
    },
  });
}

/**
 * Uploads a signature or photo binary via the public token-gated upload
 * endpoint.
 *
 *   POST /forms/sign/:token/uploads/presign
 *     body: { kind: 'signature' | 'photo', mime }
 *     → { uploadUrl, r2Key, expiresInSeconds }
 *
 * The server pre-signs a PUT URL pinned to the requested Content-Type
 * under the per-instance prefix `<orgId>/forms/<instanceId>/<kind>/…`
 * in the default R2 bucket (5-minute TTL). Mobile flow:
 *
 *   1. POST → get presigned URL + server-generated r2Key
 *   2. PUT the bytes with the matching Content-Type
 *   3. Submit form answer carrying { r2Key, mime }
 */
export type FormUploadKind = 'signature' | 'photo';

export function useTokenUpload(token: string | undefined) {
  return async (
    fileUri: string,
    mime: string,
    kind: FormUploadKind,
  ): Promise<{ r2Key: string; mime: string }> => {
    if (!token) throw new Error('Missing token');
    const presignRes = await fetch(
      `${apiUrl}/forms/sign/${token}/uploads/presign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, mime }),
      },
    );
    if (!presignRes.ok) {
      const status = classify(presignRes.status);
      throw new Error(
        status === 'expired'
          ? 'This signing link has expired.'
          : 'Could not prepare upload.',
      );
    }
    const body = (await presignRes.json()) as {
      data: { uploadUrl: string; r2Key: string; expiresInSeconds: number };
    };
    const { uploadUrl, r2Key } = body.data;

    const put = await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      headers: { 'Content-Type': mime },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (put.status < 200 || put.status >= 300) {
      throw new Error(`Upload failed (HTTP ${put.status})`);
    }
    return { r2Key, mime };
  };
}
