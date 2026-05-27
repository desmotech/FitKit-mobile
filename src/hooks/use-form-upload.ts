/**
 * Forms-specific upload helper (Path A from FORMS_HANDOVER.md).
 *
 * Forms need to embed signature/photo binaries by `r2Key` in the
 * answers payload (`formAnswerValueSchema`). The existing
 * `useUpload` hook handles presign + PUT but returns an `uploadId`,
 * not an `r2Key` — its consumers (progress photos, comments) reference
 * uploads via the row id, so r2Key was never exposed.
 *
 * Mobile reconstructs the r2Key client-side using the formula from
 * `apps/api/src/uploads/uploads.service.ts` on the `forms` branch:
 *
 *     `${PREFIX[ownerType]}/${userId}/${uploadId}.${ext}`
 *
 * For Path A we reuse the `progress_photo` ownerType so the binary
 * lands in the existing user-content bucket (the server-side forms
 * pipeline reads bytes from the default bucket — confirmed in
 * `FormsService.submitInstanceAuthenticated`). When the API later
 * adds a dedicated `compliance_signature` ownerType + immutable
 * bucket routing, swap the constants below.
 *
 * Fragility note: if the API's r2Key formula ever changes, this
 * helper silently produces wrong keys. Best mitigation is to extend
 * `PresignedUploadResponseSchema` server-side to include `r2Key`
 * directly. Tracked as FIT-189 follow-up.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback } from 'react';
import { useApi } from './use-api';
import { useCurrentUser } from './use-current-user';
import type { PresignedUploadResponseDto } from '@fitkit/shared';

const FORM_OWNER_TYPE = 'progress_photo' as const;
const FORM_PREFIX = 'progress-photos';

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'bin';
  }
}

export interface UploadedFormAttachment {
  r2Key: string;
  mime: string;
}

export function useFormUpload(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const { user } = useCurrentUser();

  const upload = useCallback(
    async (
      fileUri: string,
      mime: string,
      filename?: string,
    ): Promise<UploadedFormAttachment> => {
      if (!orgId) throw new Error('Missing orgId');
      if (!user?.id) throw new Error('Not authenticated');

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) throw new Error('File not found');
      const size = info.size ?? 0;
      if (size <= 0) throw new Error('Empty file');

      const inferredName =
        filename ?? `form-${Date.now()}.${extFromMime(mime)}`;

      const { data } = (await fetchWithAuth(
        `/organizations/${orgId}/uploads/presign`,
        {
          method: 'POST',
          body: JSON.stringify({
            ownerType: FORM_OWNER_TYPE,
            mimeType: mime,
            fileSize: size,
            filename: inferredName,
          }),
        },
      )) as { data: PresignedUploadResponseDto };

      const put = await FileSystem.uploadAsync(data.uploadUrl, fileUri, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mime },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      if (put.status < 200 || put.status >= 300) {
        throw new Error(`Upload failed (HTTP ${put.status})`);
      }

      const r2Key = `${FORM_PREFIX}/${user.id}/${data.uploadId}.${extFromMime(mime)}`;
      return { r2Key, mime };
    },
    [fetchWithAuth, orgId, user?.id],
  );

  return { upload };
}
