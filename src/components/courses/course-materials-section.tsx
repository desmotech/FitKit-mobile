/**
 * Buyer-facing course materials list. Files resolve a short-lived
 * presigned URL on tap (never cached — it expires in minutes); links and
 * videos open their stored URL. Everything opens in the in-app browser —
 * embedding third-party video players natively is deliberately out of
 * scope for v1.
 */
import { FileText, Link2, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { FKCard, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useCourseMaterialDownload } from '@/hooks/use-courses';
import { analytics } from '@/lib/analytics';
import type { CourseMaterial } from '@/types/courses';
import type { CoursesStrings } from '@/i18n/courses-strings';
import { displayFamily } from '@/lib/type';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CourseMaterialsSection({
  programId,
  orgId,
  materials,
  strings,
  lang,
  isRTL,
  heading,
}: {
  programId: string;
  orgId: string;
  materials: CourseMaterial[];
  strings: CoursesStrings;
  lang: string;
  isRTL: boolean;
  /** Section heading; omit to render the rows bare (day-pinned list). */
  heading?: string;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const fetchDownloadUrl = useCourseMaterialDownload(programId);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (materials.length === 0) return null;

  const open = async (material: CourseMaterial) => {
    if (busyId) return;
    haptics.tap();
    setBusyId(material.id);
    try {
      // File URLs are presigned and short-lived — fetch fresh on every tap.
      const url =
        material.kind === 'file'
          ? await fetchDownloadUrl(material.id)
          : material.url;
      if (!url) throw new Error('material has no url');
      analytics.track('member_course_material_opened', {
        org_id: orgId,
        program_id: programId,
        material_id: material.id,
        material_kind: material.kind,
        platform: 'mobile',
      });
      await WebBrowser.openBrowserAsync(url);
    } catch {
      haptics.error();
      Alert.alert(strings.openMaterialFailed);
    } finally {
      setBusyId(null);
    }
  };

  const iconFor = (kind: CourseMaterial['kind']) => {
    const props = { size: 16, color: colors.primaryText, strokeWidth: 2 };
    if (kind === 'video') return <PlayCircle {...props} />;
    if (kind === 'link') return <Link2 {...props} />;
    return <FileText {...props} />;
  };

  return (
    <View style={{ gap: 10 }}>
      {heading ? (
        <Text
          style={{
            fontSize: 12,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            fontFamily: 'Assistant-SemiBold',
          }}
        >
          {heading}
        </Text>
      ) : null}
      {materials.map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={m.title}
          disabled={busyId === m.id}
          onPress={() => void open(m)}
        >
          {({ pressed }) => (
            <FKCard
              style={{
                padding: 12,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed || busyId === m.id ? 0.6 : 1,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  backgroundColor: colors.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {iconFor(m.kind)}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    color: colors.foreground,
                    textAlign: isRTL ? 'right' : 'left',
                    fontFamily: displayFamily(lang, 'semibold'),
                  }}
                >
                  {m.title}
                </Text>
                {m.description || m.sizeBytes != null ? (
                  <Text
                    numberOfLines={1}
                    className="text-muted-foreground"
                    style={{
                      fontSize: 12,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {m.description ??
                      (m.sizeBytes != null ? formatSize(m.sizeBytes) : '')}
                  </Text>
                ) : null}
              </View>
            </FKCard>
          )}
        </Pressable>
      ))}
    </View>
  );
}
