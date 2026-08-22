import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useQuotaStrings } from '@/i18n/use-quota-strings';

/** One anchored quota window as the API reports it. Declared structurally so
 *  this renders before `@taikan/shared` ships the type to mobile. */
export interface QuotaUsage {
  period: 'day' | 'week' | 'month';
  limit: number;
  used: number;
  remaining: number;
  windowStartsAt: string;
  windowEndsAt: string;
}

/** Pips stop being readable long before they stop fitting. */
const MAX_PIPS = 20;

/**
 * A member's remaining booking allowance and when it resets, drawn for the
 * membership card's gradient (white on teal).
 *
 * Quotas used to be invisible until they blocked you — and now that windows
 * are anchored to the subscription, the reset date is personal rather than
 * "the 1st", so it has to be on screen. Segmented pips over a bare number so
 * the balance reads at a glance.
 */
export function QuotaBalance({
  quotas,
  isRTL,
  locale,
}: {
  quotas: QuotaUsage[];
  isRTL: boolean;
  locale: string;
}) {
  const t = useQuotaStrings();
  if (quotas.length === 0) return null;

  const periodLabel: Record<QuotaUsage['period'], string> = {
    day: t.balanceDay,
    week: t.balanceWeek,
    month: t.balanceMonth,
  };

  return (
    <View style={{ gap: 12 }} testID="quota-balance">
      {quotas.map((q) => {
        const exhausted = q.remaining === 0;
        // windowEndsAt is a UTC-midnight calendar-day boundary from the API;
        // formatting it in the device's local zone can shift it a day either
        // way, so pin the format to UTC to show the date the API means.
        const resetsOn = new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          timeZone: 'UTC',
        }).format(new Date(q.windowEndsAt));
        const usedLabel = t.ofTotal
          .replace('{used}', String(q.used))
          .replace('{limit}', String(q.limit));

        return (
          <View key={q.period} style={{ gap: 6 }} testID={`quota-${q.period}`}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  color: 'rgba(255,255,255,0.76)',
                  fontFamily: 'Assistant-Medium',
                }}
              >
                {periodLabel[q.period]}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: exhausted ? '#FFD9D0' : '#fff',
                }}
              >
                {usedLabel}
              </Text>
            </View>

            {/* Pips while they stay legible, a proportional bar past that. */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 4,
              }}
              accessibilityRole="progressbar"
              accessibilityLabel={usedLabel}
            >
              {q.limit <= MAX_PIPS ? (
                Array.from({ length: q.limit }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor:
                        i < q.used ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.26)',
                    }}
                  />
                ))
              ) : (
                <View
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.26)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, (q.used / q.limit) * 100)}%`,
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.92)',
                    }}
                  />
                </View>
              )}
            </View>

            <Text
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.70)',
                fontFamily: 'Assistant-Medium',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {exhausted
                ? `${t.allUsed} · ${t.resetsOn.replace('{date}', resetsOn)}`
                : t.resetsOn.replace('{date}', resetsOn)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
