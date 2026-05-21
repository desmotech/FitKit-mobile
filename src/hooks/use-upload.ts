/**
 * Generic R2-staged upload hook. Supersedes use-message-uploads for new
 * surfaces (exercise comments, progress photos). The legacy hook stays for
 * the assignment-level chat composer until messages migrates onto the
 * polymorphic attachments table.
 *
 * Flow:
 *   1. Caller hands a picked asset (image OR video) into addPicked()
 *   2. Image assets get resize/recompress via expo-image-manipulator; videos
 *      pass through.
 *   3. POST /organizations/:orgId/uploads/presign with ownerType + meta
 *   4. PUT the binary to the presigned URL
 *   5. Return uploadId; caller threads it into the parent write
 *      (attachmentIds[] for comments, uploadId for photos).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCallback, useState } from 'react';
import { useApi } from './use-api';
import type {
  PresignedUploadResponseDto,
  UploadOwnerType,
} from '@fitkit/shared';

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);

const POLICY: Record<
  UploadOwnerType,
  { image: { maxBytes: number }; video?: { maxBytes: number; maxMs: number } }
> = {
  exercise_comment: {
    image: { maxBytes: 10 * 1024 * 1024 },
    video: { maxBytes: 50 * 1024 * 1024, maxMs: 60_000 },
  },
  progress_photo: { image: { maxBytes: 15 * 1024 * 1024 } },
};

const MAX_LONG_EDGE = 1920;
const RESIZE_QUALITY = 0.82;

export interface UploadItem {
  localId: string;
  uri: string;
  kind: 'image' | 'video';
  fileName: string;
  mimeType: string;
  size: number;
  progress: number;
  uploadId: string | null;
  error: string | null;
}

export interface PickedMedia {
  uri: string;
  width?: number;
  height?: number;
  duration?: number; // ms (video only)
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  type?: 'image' | 'video' | null;
}

function detectKind(asset: PickedMedia): 'image' | 'video' {
  if (asset.type === 'video') return 'video';
  if (asset.type === 'image') return 'image';
  if (asset.mimeType?.startsWith('video/')) return 'video';
  return 'image';
}

function inferImageMime(uri: string, fallback?: string | null): string {
  if (fallback && IMAGE_MIMES.has(fallback)) return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function inferVideoMime(uri: string, fallback?: string | null): string {
  if (fallback && VIDEO_MIMES.has(fallback)) return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

async function prepareImage(
  asset: PickedMedia,
): Promise<{ uri: string; size: number; mimeType: string; fileName: string }> {
  const fileName = asset.fileName ?? `image-${Date.now()}.jpg`;
  const mime = inferImageMime(asset.uri, asset.mimeType);
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);

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
  const targetWidth = Math.round((asset.width ?? MAX_LONG_EDGE) * scale);
  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: targetWidth } }],
    { compress: RESIZE_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  const info = await FileSystem.getInfoAsync(result.uri);
  return {
    uri: result.uri,
    size: (info.exists && info.size) || 0,
    mimeType: 'image/jpeg',
    fileName: fileName.replace(/\.(heic|heif|png|webp)$/i, '.jpg'),
  };
}

async function prepareVideo(
  asset: PickedMedia,
): Promise<{ uri: string; size: number; mimeType: string; fileName: string }> {
  const fileName = asset.fileName ?? `video-${Date.now()}.mp4`;
  const mime = inferVideoMime(asset.uri, asset.mimeType);
  const info = await FileSystem.getInfoAsync(asset.uri);
  return {
    uri: asset.uri,
    size: (info.exists && info.size) || asset.fileSize || 0,
    mimeType: mime,
    fileName,
  };
}

export interface UseUploadOptions {
  ownerType: UploadOwnerType;
  /** Optional callback for the user-facing reason an upload was rejected. */
  onReject?: (reason: 'unsupported' | 'too-large' | 'too-long') => void;
}

export function useUpload(orgId: string | undefined | null, opts: UseUploadOptions) {
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
    async (asset: PickedMedia): Promise<string | null> => {
      if (!orgId) return null;

      const kind = detectKind(asset);
      const policy = POLICY[opts.ownerType];

      if (kind === 'video' && !policy.video) {
        opts.onReject?.('unsupported');
        return null;
      }
      if (kind === 'video' && asset.duration && asset.duration > policy.video!.maxMs) {
        opts.onReject?.('too-long');
        return null;
      }

      let prepared:
        | Awaited<ReturnType<typeof prepareImage>>
        | Awaited<ReturnType<typeof prepareVideo>>;
      try {
        prepared = kind === 'video'
          ? await prepareVideo(asset)
          : await prepareImage(asset);
      } catch {
        opts.onReject?.('unsupported');
        return null;
      }

      const maxBytes =
        kind === 'video' ? policy.video!.maxBytes : policy.image.maxBytes;
      if (prepared.size > maxBytes) {
        opts.onReject?.('too-large');
        return null;
      }

      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: UploadItem = {
        localId,
        uri: prepared.uri,
        kind,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        size: prepared.size,
        progress: 0,
        uploadId: null,
        error: null,
      };
      setUploads((prev) => [...prev, item]);

      try {
        const { data } = (await fetchWithAuth(
          `/organizations/${orgId}/uploads/presign`,
          {
            method: 'POST',
            body: JSON.stringify({
              ownerType: opts.ownerType,
              mimeType: prepared.mimeType,
              fileSize: prepared.size,
              filename: prepared.fileName,
            }),
          },
        )) as { data: PresignedUploadResponseDto };

        updateItem(localId, { uploadId: data.uploadId, progress: 10 });

        const result = await FileSystem.uploadAsync(data.uploadUrl, prepared.uri, {
          httpMethod: 'PUT',
          headers: { 'Content-Type': prepared.mimeType },
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        });

        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed (${result.status})`);
        }

        updateItem(localId, { progress: 100 });
        return data.uploadId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        updateItem(localId, { error: message });
        return null;
      }
    },
    [fetchWithAuth, orgId, opts, updateItem],
  );

  const removeUpload = useCallback((localId: string) => {
    setUploads((prev) => prev.filter((u) => u.localId !== localId));
  }, []);

  const clearAll = useCallback(() => setUploads([]), []);

  const getReadyUploadIds = useCallback(
    () =>
      uploads
        .filter((u) => u.uploadId && u.progress === 100 && !u.error)
        .map((u) => u.uploadId as string),
    [uploads],
  );

  const hasPendingUploads = uploads.some((u) => !u.uploadId && !u.error);

  return {
    uploads,
    addPicked,
    removeUpload,
    clearAll,
    getReadyUploadIds,
    hasPendingUploads,
  };
}
