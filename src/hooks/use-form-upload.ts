/**
 * Forms-specific upload helper for the authenticated in-app signing flow.
 *
 * Forms embed signature/photo binaries by `r2Key` in the answers payload
 * (`formAnswerValueSchema`). This hook presigns + PUTs a local file and
 * returns the server-generated `{ r2Key, mime }` for the answer.
 *
 *   POST /organizations/:orgId/forms/instances/:instanceId/uploads/presign
 *     body:   { kind: 'signature' | 'photo', mime }
 *     return: { uploadUrl, r2Key, expiresInSeconds }
 *
 * The r2Key comes straight from the response — we no longer reconstruct it
 * client-side. The server scopes every key under `<orgId>/forms/<instanceId>/`
 * and validates it again on submit (FIT-189).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback } from 'react';
import { useApi } from './use-api';

export type FormUploadKind = 'signature' | 'photo';

interface FormUploadPresignResponse {
  uploadUrl: string;
  r2Key: string;
  expiresInSeconds: number;
}

export interface UploadedFormAttachment {
  r2Key: string;
  mime: string;
}

export function useFormUpload(
  orgId: string | undefined | null,
  instanceId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();

  const upload = useCallback(
    async (
      fileUri: string,
      mime: string,
      kind: FormUploadKind,
    ): Promise<UploadedFormAttachment> => {
      if (!orgId) throw new Error('Missing orgId');
      if (!instanceId) throw new Error('Missing instanceId');

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) throw new Error('File not found');
      if ((info.size ?? 0) <= 0) throw new Error('Empty file');

      const { data } = (await fetchWithAuth(
        `/organizations/${orgId}/forms/instances/${instanceId}/uploads/presign`,
        {
          method: 'POST',
          body: JSON.stringify({ kind, mime }),
        },
      )) as { data: FormUploadPresignResponse };

      const put = await FileSystem.uploadAsync(data.uploadUrl, fileUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mime },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      if (put.status < 200 || put.status >= 300) {
        throw new Error(`Upload failed (HTTP ${put.status})`);
      }

      return { r2Key: data.r2Key, mime };
    },
    [fetchWithAuth, orgId, instanceId],
  );

  return { upload };
}
