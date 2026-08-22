/**
 * <ExerciseSearchInput> — iOS UISearchBar-style exercise picker.
 *
 * 36pt capsule with `tertiarySystemFill`, leading magnifying-glass icon
 * (or trailing in RTL), inline clear button when text is entered.
 * Results / Recents are rendered as iOS Mail-style inset rows.
 *
 * RTL is implemented via JSX child reordering (not `row-reverse`).
 */
import { CircleX, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type ExerciseSearchResult,
  useExerciseSearch,
} from '@/hooks/use-feed-data';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

export interface ExerciseSearchInputProps {
  orgId: string | undefined | null;
  value: ExerciseSearchResult | null;
  onChange: (next: ExerciseSearchResult | null) => void;
  recents?: ExerciseSearchResult[];
  placeholder?: string;
}

export function ExerciseSearchInput({
  orgId,
  value,
  onChange,
  recents,
  placeholder,
}: ExerciseSearchInputProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const haptics = useHaptics();
  const L = useLogStrings();
  const effectivePlaceholder = placeholder ?? L.searchPlaceholder;
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const tid = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(tid);
  }, [query]);

  const search = useExerciseSearch(orgId, value ? '' : debounced);
  const results = search.data?.data ?? [];

  // Selected token cell
  if (value) {
    const labelEl = (
      <Text
        key="label"
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? '#FFFFFF' : '#0B2C2C',
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {value.name}
      </Text>
    );
    const closeEl = (
      <Pressable
        key="close"
        accessibilityRole="button"
        accessibilityLabel={L.searchClearSelected}
        hitSlop={12}
        onPress={() => {
          haptics.tap();
          onChange(null);
          setQuery('');
        }}
      >
        <X size={18} color="#0E8C8C" strokeWidth={2.4} />
      </Pressable>
    );
    const tokenChildren = isRTL ? [closeEl, labelEl] : [labelEl, closeEl];
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          height: 44,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.30)',
        }}
      >
        {tokenChildren}
      </View>
    );
  }

  const searchFill = isDark
    ? 'rgba(118,118,128,0.24)'
    : 'rgba(118,118,128,0.12)';
  const placeholderColor = isDark
    ? 'rgba(238,242,246,0.45)'
    : 'rgba(60,60,67,0.45)';

  // UISearchBar children
  const searchIconEl = (
    <Search
      key="ic"
      size={16}
      color={placeholderColor}
      strokeWidth={2.4}
    />
  );
  const inputEl = (
    <TextInput
      key="in"
      accessibilityLabel={L.searchPlaceholder}
      value={query}
      onChangeText={setQuery}
      placeholder={effectivePlaceholder}
      placeholderTextColor={placeholderColor}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      style={{
        flex: 1,
        height: 36,
        paddingVertical: 0,
        fontSize: 15,
        color: isDark ? '#FFFFFF' : '#000000',
        textAlign: isRTL ? 'right' : 'left',
        writingDirection: isRTL ? 'rtl' : 'ltr',
      }}
    />
  );
  const clearEl =
    query.length > 0 ? (
      <Pressable
        key="cl"
        accessibilityRole="button"
        accessibilityLabel={L.searchClear}
        hitSlop={8}
        onPress={() => setQuery('')}
      >
        <CircleX size={16} color={placeholderColor} strokeWidth={2.4} />
      </Pressable>
    ) : null;
  const barChildren = [searchIconEl, inputEl, clearEl].filter(Boolean) as React.ReactNode[];

  return (
    <View>
      <View
        accessibilityRole="search"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 36,
          paddingHorizontal: 8,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: searchFill,
        }}
      >
        {isRTL ? barChildren.slice().reverse() : barChildren}
      </View>

      {query.length === 0 && recents && recents.length > 0 ? (
        <ResultList
          header={L.searchRecent}
          rows={recents.slice(0, 5)}
          onPress={(r) => {
            haptics.tap();
            onChange(r);
            setQuery('');
          }}
        />
      ) : null}

      {query.length >= 2 ? (
        <ResultList
          header={L.searchResults}
          loading={search.isLoading}
          empty={results.length === 0}
          rows={results.slice(0, 8)}
          onPress={(r) => {
            haptics.tap();
            onChange(r);
            setQuery('');
          }}
        />
      ) : null}
    </View>
  );
}

function ResultList({
  header,
  rows,
  loading,
  empty,
  onPress,
}: {
  header: string;
  rows: ExerciseSearchResult[];
  loading?: boolean;
  empty?: boolean;
  onPress: (r: ExerciseSearchResult) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const L = useLogStrings();
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: isDark ? 'rgba(238,242,246,0.5)' : 'rgba(60,60,67,0.5)',
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
          marginBottom: 2,
        }}
      >
        {header}
      </Text>
      <View
        style={{
          borderRadius: 10,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: isDark
            ? 'rgba(118,118,128,0.16)'
            : 'rgba(118,118,128,0.08)',
        }}
      >
        {loading ? (
          <View style={{ padding: 12 }}>
            <Skeleton className="h-12 w-full rounded-lg" />
          </View>
        ) : empty ? (
          <Text
            style={{
              paddingVertical: 18,
              paddingHorizontal: 16,
              fontSize: 15,
              color: isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)',
              textAlign: 'center',
            }}
          >
            {L.searchEmpty}
          </Text>
        ) : (
          rows.map((r, idx) => {
            const titleEl = (
              <Text
                key="t"
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 17,
                  fontWeight: '500',
                  letterSpacing: -0.4,
                  color: isDark ? '#FFFFFF' : '#000000',
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {r.name}
              </Text>
            );
            const catEl = r.category ? (
              <Text
                key="c"
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDark
                    ? 'rgba(238,242,246,0.6)'
                    : 'rgba(60,60,67,0.6)',
                }}
              >
                {r.category}
              </Text>
            ) : null;
            const rowChildren = [titleEl, catEl].filter(Boolean) as React.ReactNode[];
            // View-wrapped Pressable — same pattern as PerformanceToggle.
            // This RN build drops border/height/padding from Pressable's
            // style-as-function, so the static View carries the visual
            // and Pressable is just the touch target inside.
            return (
              <View
                key={r.id}
                style={{
                  height: 56,
                  borderBottomWidth:
                    idx === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: isDark
                    ? 'rgba(84,84,88,0.6)'
                    : 'rgba(60,60,67,0.18)',
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={r.name}
                  accessibilityHint={r.category ?? undefined}
                  onPress={() => onPress(r)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                  }}
                >
                  {isRTL ? rowChildren.slice().reverse() : rowChildren}
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
