/**
 * Upload Progress Photo — pageSheet (FIT-72).
 *
 * Member picks a photo (camera or library) → previews it → optionally adds
 * notes + bodyweight + adjusts the date (default today, max today) → Save.
 * Save flow:
 *   1. Upload to R2 via the generic /uploads/presign + PUT pipeline
 *   2. POST /members/me/progress-photos with { uploadId, recordedAt, ... }
 *   3. Optimistic cache prepend via the hook → dismiss the sheet
 */
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  FKDateField,
  FKModalHeader,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMediaPermissions } from '@/hooks/use-media-permissions';
import { useUploadProgressPhoto } from '@/hooks/use-progress-photos';
import { useUpload } from '@/hooks/use-upload';
import { useI18n } from '@/providers/i18n-provider';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function UploadPhotoScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const haptics = useHaptics();
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';

  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const { requestCamera, requestLibrary } = useMediaPermissions();
  const upload = useUpload(orgId, {
    ownerType: 'progress_photo',
    onReject: (reason) => {
      const msg =
        reason === 'too-large'
          ? get(t, 'uploads.tooLarge') ?? 'File is too large'
          : get(t, 'uploads.unsupportedType') ?? 'Unsupported file type';
      Alert.alert('', msg);
    },
  });
  const uploadMutation = useUploadProgressPhoto(orgId);

  const [recordedAt, setRecordedAt] = useState<string>(todayString());
  const [notes, setNotes] = useState('');
  const [bodyweight, setBodyweight] = useState('');

  const labels = useMemo(
    () => ({
      title: get(t, 'progressPhotos.title') ?? 'Progress photo',
      pick: get(t, 'progressPhotos.addPhoto') ?? 'Add photo',
      fromCamera: get(t, 'progressPhotos.fromCamera') ?? 'Take photo',
      fromLibrary: get(t, 'progressPhotos.fromLibrary') ?? 'Choose from library',
      cancel: get(t, 'common.cancel') ?? 'Cancel',
      save: get(t, 'progressPhotos.saveCta') ?? 'Save',
      date: get(t, 'progressPhotos.dateLabel') ?? 'Date',
      notes: get(t, 'progressPhotos.notesLabel') ?? 'Notes',
      bodyweight: get(t, 'progressPhotos.bodyweightLabel') ?? 'Bodyweight',
      bodyweightUnit: get(t, 'progressPhotos.bodyweightUnit') ?? 'kg',
      privacy:
        get(t, 'progressPhotos.privacyNote') ??
        'Visible only to you and your coaches.',
    }),
    [t],
  );

  const current = upload.uploads[0];

  const pickFrom = useCallback(
    async (source: 'camera' | 'library') => {
      const ok =
        source === 'camera' ? await requestCamera() : await requestLibrary();
      if (!ok) return;
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.92,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.92,
            });
      if (result.canceled || !result.assets?.[0]) return;
      upload.clearAll();
      const a = result.assets[0];
      await upload.addPicked({
        uri: a.uri,
        width: a.width,
        height: a.height,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        type: 'image',
      });
    },
    [requestCamera, requestLibrary, upload],
  );

  const showPickSheet = useCallback(() => {
    haptics.tap();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [labels.cancel, labels.fromCamera, labels.fromLibrary],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) pickFrom('camera');
          else if (i === 2) pickFrom('library');
        },
      );
    } else {
      pickFrom('library');
    }
  }, [haptics, labels, pickFrom]);

  const canSave =
    !!current &&
    current.progress === 100 &&
    !current.error &&
    !uploadMutation.isPending;

  const handleSave = useCallback(async () => {
    if (!canSave || !current?.uploadId) return;
    haptics.tap();
    const bw = bodyweight.trim();
    try {
      await uploadMutation.mutateAsync({
        uploadId: current.uploadId,
        recordedAt,
        notes: notes.trim() || undefined,
        bodyweightKg: bw ? parseFloat(bw) : undefined,
      });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      Alert.alert('', msg);
    }
  }, [bodyweight, canSave, current?.uploadId, haptics, notes, recordedAt, uploadMutation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={labels.title}
        leadingAction={{
          label: labels.cancel,
          onPress: () => router.back(),
        }}
        trailingAction={{
          label: labels.save,
          onPress: handleSave,
          style: 'primary',
          disabled: !canSave,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {current ? (
            <View
              style={{
                aspectRatio: 3 / 4,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              <ExpoImage
                source={{ uri: current.uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              {current.progress < 100 && !current.error ? (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 22,
                      fontWeight: '800',
                      fontFamily: 'DMMono',
                    }}
                  >
                    {current.progress}%
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => upload.clearAll()}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                }}
              >
                <X size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={showPickSheet}
              accessibilityRole="button"
              accessibilityLabel={labels.pick}
            >
              {({ pressed }) => (
                <View
                  style={{
                    aspectRatio: 3 / 4,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: colors.mutedFg + '55',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    opacity: pressed ? 0.6 : 1,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(15,23,42,0.02)',
                  }}
                >
                  <ImagePlus
                    size={36}
                    color={colors.mutedFg}
                    strokeWidth={1.6}
                  />
                  <Text
                    style={{
                      color: colors.mutedFg,
                      fontSize: 15,
                      fontWeight: '600',
                    }}
                  >
                    {labels.pick}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          <View style={{ gap: 10 }}>
            <FieldLabel
              label={labels.date}
              isRTL={isRTL}
              colors={colors}
            />
            <FKDateField
              value={recordedAt}
              onChange={(d) => setRecordedAt(d)}
              maximumDate={new Date()}
            />
          </View>

          <View style={{ gap: 10 }}>
            <FieldLabel
              label={`${labels.bodyweight} (${labels.bodyweightUnit})`}
              isRTL={isRTL}
              colors={colors}
            />
            <TextInput
              value={bodyweight}
              onChangeText={setBodyweight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.mutedFg}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(15,23,42,0.04)',
                color: colors.foreground,
                fontSize: 16,
                textAlign: isRTL ? 'right' : 'left',
                fontFamily: 'DMMono',
              }}
            />
          </View>

          <View style={{ gap: 10 }}>
            <FieldLabel
              label={labels.notes}
              isRTL={isRTL}
              colors={colors}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="—"
              placeholderTextColor={colors.mutedFg}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(15,23,42,0.04)',
                color: colors.foreground,
                fontSize: 15,
                minHeight: 80,
                textAlign: isRTL ? 'right' : 'left',
                textAlignVertical: 'top',
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 12,
              color: colors.mutedFg,
              textAlign: 'center',
              marginTop: 8,
              opacity: 0.7,
            }}
          >
            {labels.privacy}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldLabel({
  label,
  isRTL,
  colors,
}: {
  label: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: colors.mutedFg,
        textAlign: isRTL ? 'right' : 'left',
        fontFamily: 'DMMono',
      }}
    >
      {label}
    </Text>
  );
}
