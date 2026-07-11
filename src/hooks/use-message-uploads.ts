/**
 * Mobile port of `apps/web/src/hooks/messages/use-file-upload.ts`.
 *
 * Flow:
 *   1. Pick image via `expo-image-picker` (library or camera).
 *   2. Resize/recompress with `expo-image-manipulator` so we don't ship
 *      a 12 MB phone-camera original over cellular (and so we stay
 *      under the 10 MB API cap). Long edge clamped to 1920px, JPEG q≈82.
 *   3. POST `/organizations/:orgId/messages/upload-url` for a presigned
 *      URL + uploadId.
 *   4. PUT the file bytes to the presigned URL.
 *   5. Hand back the uploadId; the composer threads them into the send
 *      mutation's `attachmentIds`.
 *
 * Per-file state (preview URI, progress, error) is held in state so the
 * composer can render preview chips with progress bars.
 */
import * as ImageManipulator from 'expo-image-manipulator';
// SDK 54 ships a new modern API; uploadAsync + getInfoAsync live in the
// legacy subpath. Import the legacy module explicitly so the existing
// upload flow keeps working without rewiring to the modern File class.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sentry from '@sentry/react-native';
import { useCallback, useState } from 'react';
import { useApi } from './use-api';
import type { UploadUrlResponse } from '@fitkit/shared';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LONG_EDGE = 1920;
const RESIZE_QUALITY = 0.82;

export interface UploadItem {
  /** Local id, stable across the lifetime of this picked file. */
  localId: string;
  /** Filesystem URI suitable for <Image source={{ uri }} /> previews. */
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  progress: number;
  /** Server-side upload id once the PUT succeeds. */
  uploadId: string | null;
  error: string | null;
}

interface PickedAsset {
  uri: string;
  width: number;
  height: number;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

function inferMime(uri: string, fallback?: string | null): string {
  if (fallback && ALLOWED_MIME.has(fallback)) return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function resizeIfNeeded(
  asset: PickedAsset,
): Promise<{ uri: string; size: number; mimeType: string; fileName: string }> {
  const fileName = asset.fileName ?? `image-${Date.now()}.jpg`;
  const longEdge = Math.max(asset.width, asset.height);

  // GIFs would lose animation through the canvas; skip resize.
  const mime = inferMime(asset.uri, asset.mimeType);
  if (mime === 'image/gif') {
    const info = await FileSystem.getInfoAsync(asset.uri);
    return {
      uri: asset.uri,
      size: (info.exists && info.size) || asset.fileSize || 0,
      mimeType: mime,
      fileName,
    };
  }

  // Skip resize if already small AND under the long-edge threshold.
  if (longEdge <= MAX_LONG_EDGE && (asset.fileSize ?? 0) < 1024 * 1024) {
    const info = await FileSystem.getInfoAsync(asset.uri);
    return {
      uri: asset.uri,
      size: (info.exists && info.size) || asset.fileSize || 0,
      mimeType: mime,
      fileName,
    };
  }

  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const targetWidth = Math.round(asset.width * scale);
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: targetWidth } }],
    {
      compress: RESIZE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const info = await FileSystem.getInfoAsync(result.uri);
  return {
    uri: result.uri,
    size: (info.exists && info.size) || 0,
    mimeType: 'image/jpeg',
    fileName: fileName.replace(/\.(heic|heif|png|webp)$/i, '.jpg'),
  };
}

export function useMessageUploads(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const updateItem = useCallback(
    (localId: string, patch: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((u) => (u.localId === localId ? { ...u, ...patch } : u)),
      );
    },
    [],
  );

  const addPicked = useCallback(
    async (asset: PickedAsset): Promise<string | null> => {
      if (!orgId) return null;

      // Step 1: resize / recompress.
      let prepared: Awaited<ReturnType<typeof resizeIfNeeded>>;
      try {
        prepared = await resizeIfNeeded(asset);
      } catch (err) {
        // If manipulation fails, fall back to the original — the size
        // check below catches anything still too big.
        const info = await FileSystem.getInfoAsync(asset.uri);
        prepared = {
          uri: asset.uri,
          size: (info.exists && info.size) || asset.fileSize || 0,
          mimeType: inferMime(asset.uri, asset.mimeType),
          fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
        };
        void err;
      }

      if (!ALLOWED_MIME.has(prepared.mimeType)) {
        return null;
      }
      if (prepared.size > MAX_BYTES) {
        return null;
      }

      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: UploadItem = {
        localId,
        uri: prepared.uri,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        size: prepared.size,
        progress: 0,
        uploadId: null,
        error: null,
      };
      setUploads((prev) => [...prev, item]);

      try {
        // Step 2: presigned URL.
        const { data } = (await fetchWithAuth(
          `/organizations/${orgId}/messages/upload-url`,
          {
            method: 'POST',
            body: JSON.stringify({
              fileName: prepared.fileName,
              fileSize: prepared.size,
              mimeType: prepared.mimeType,
            }),
          },
        )) as { data: UploadUrlResponse };

        updateItem(localId, { uploadId: data.uploadId, progress: 10 });

        // Step 3: PUT the binary. expo-file-system uploadAsync handles
        // chunking + progress; falls back to a single PUT here.
        const result = await FileSystem.uploadAsync(data.uploadUrl, prepared.uri, {
          httpMethod: 'PUT',
          headers: { 'Content-Type': prepared.mimeType },
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        });

        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed (${result.status})`);
        }

        updateItem(localId, { progress: 100, uploadId: data.uploadId });
        return data.uploadId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        Sentry.captureException(err, {
          tags: { feature: 'message-upload' },
          extra: {
            message,
            mimeType: prepared.mimeType,
            size: prepared.size,
            fileName: prepared.fileName,
          },
        });
        updateItem(localId, { error: message });
        return null;
      }
    },
    [fetchWithAuth, orgId, updateItem],
  );

  const removeUpload = useCallback((localId: string) => {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const clearAll = useCallback(() => {
    setUploads([]);
  }, []);

  const getReadyUploadIds = useCallback(() => {
    return uploads
      .filter((u) => u.uploadId && u.progress === 100 && !u.error)
      .map((u) => u.uploadId as string);
  }, [uploads]);

  // Pending until the binary PUT completes (progress 100), not merely until
  // the presign response sets `uploadId` — the PUT is the long part, and
  // callers gate Send on this flag (sending mid-PUT drops the attachment).
  const hasPendingUploads = uploads.some((u) => !u.error && u.progress < 100);

  return {
    uploads,
    addPicked,
    removeUpload,
    clearAll,
    getReadyUploadIds,
    hasPendingUploads,
  };
}
