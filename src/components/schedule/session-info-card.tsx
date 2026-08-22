import { CalendarDays, Clock, MapPin, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { type ClassSession } from '@/hooks/use-schedule';

/** Class metadata card — date / time / location rows, plus a footer with the
 *  coach identity and a tappable registered-participants cluster. */
export function SessionInfoCard({
  session,
  dateText,
  timeText,
  coachName,
  coachLabel,
  registeredLabel,
  isRTL,
}: {
  session: ClassSession;
  dateText: string;
  timeText: string;
  coachName: string | null;
  coachLabel: string;
  registeredLabel: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const [listOpen, setListOpen] = useState(false);
  const lineColor = colors.isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(60,60,67,0.12)';
  const hasParticipants = session.bookingCount > 0;
  const showFooter = !!coachName || hasParticipants;

  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
      <FKCard style={{ borderRadius: 20, padding: 16, gap: 12 }}>
        <MetaRow Icon={CalendarDays} text={dateText} isRTL={isRTL} />
        <MetaRow Icon={Clock} text={timeText} isRTL={isRTL} />
        {session.location ? (
          <MetaRow Icon={MapPin} text={session.location.name} isRTL={isRTL} />
        ) : null}

        {showFooter ? (
          <>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: lineColor,
                marginTop: 2,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              {coachName ? (
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Avatar
                    size={32}
                    name={coachName}
                    imageUrl={session.coach?.imageUrl ?? null}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      className="text-muted-foreground"
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {coachLabel}
                    </Text>
                    <Text
                      className="text-foreground"
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        letterSpacing: -0.1,
                        marginTop: 1,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                      numberOfLines={1}
                    >
                      {coachName}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {hasParticipants ? (
                <ParticipantsCluster
                  attendees={session.attendees}
                  bookingCount={session.bookingCount}
                  label={registeredLabel}
                  isRTL={isRTL}
                  onPress={() => setListOpen(true)}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </FKCard>

      <ParticipantsModal
        visible={listOpen}
        onClose={() => setListOpen(false)}
        attendees={session.attendees}
        bookingCount={session.bookingCount}
        capacity={session.capacity}
        label={registeredLabel}
        isRTL={isRTL}
      />
    </View>
  );
}

function MetaRow({
  Icon,
  text,
  isRTL,
}: {
  Icon: typeof Clock;
  text: string;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(120,120,128,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} color="rgba(61,90,112,0.85)" strokeWidth={2.2} />
      </View>
      <Text
        className="text-foreground"
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '500',
          letterSpacing: -0.1,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * Compact registered cluster — up to 3 overlapping avatars (each ringed in
 * the card colour so silhouettes stay legible), then a "+N" chip when more
 * are booked. The whole cluster is tappable → the full-list sheet. A single
 * booking shows just one avatar.
 */
function ParticipantsCluster({
  attendees,
  bookingCount,
  label,
  isRTL,
  onPress,
}: {
  attendees: ClassSession['attendees'];
  bookingCount: number;
  label: string;
  isRTL: boolean;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const MAX_SHOWN = 3;
  const visible = attendees.slice(0, MAX_SHOWN);
  const overflow = Math.max(0, bookingCount - visible.length);
  const ring = 30;
  const overlap = 10;
  const inner = ring - 4;
  const eyebrow = `${label} · ${bookingCount}`;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={eyebrow}
    >
      {({ pressed }) => (
        <View
          style={{
            alignItems: isRTL ? 'flex-start' : 'flex-end',
            gap: 5,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              fontWeight: '800',
              color: colors.mutedFg,
              fontFamily: 'Assistant-Medium',
            }}
          >
            {eyebrow}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            {visible.map((a, idx) => {
              const name =
                `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '?';
              return (
                <View
                  key={a.id}
                  style={{
                    width: ring,
                    height: ring,
                    borderRadius: ring / 2,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: idx === 0 ? 0 : isRTL ? 0 : -overlap,
                    marginRight: idx === 0 ? 0 : isRTL ? -overlap : 0,
                    zIndex: visible.length - idx,
                  }}
                >
                  <Avatar name={name} imageUrl={a.imageUrl} size={inner} />
                </View>
              );
            })}
            {overflow > 0 ? (
              <View
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft:
                    visible.length === 0 ? 0 : isRTL ? 0 : -overlap,
                  marginRight:
                    visible.length === 0 ? 0 : isRTL ? -overlap : 0,
                }}
              >
                <View
                  style={{
                    width: inner,
                    height: inner,
                    borderRadius: inner / 2,
                    backgroundColor: colors.isDark
                      ? 'rgba(39,200,186,0.18)'
                      : 'rgba(14,140,140,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: colors.primaryText,
                      fontFamily: 'Assistant-Medium',
                    }}
                  >
                    +{overflow}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Full participant list — a slide-up sheet (mirrors FKSelectSheet's Android
 * sheet idiom). Lists every booked member we have; if `bookingCount` exceeds
 * the returned `attendees`, a muted "+N more" tail acknowledges the rest.
 */
function ParticipantsModal({
  visible,
  onClose,
  attendees,
  bookingCount,
  capacity,
  label,
  isRTL,
}: {
  visible: boolean;
  onClose: () => void;
  attendees: ClassSession['attendees'];
  bookingCount: number;
  capacity: number | null;
  label: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const lineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const extra = Math.max(0, bookingCount - attendees.length);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderCurve: 'continuous',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: lineColor,
            maxHeight: '75%',
          }}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 999,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.18)'
                  : 'rgba(15,23,42,0.14)',
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: lineColor,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Users size={16} color={colors.mutedFg} strokeWidth={2.2} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.2,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {bookingCount}
                {capacity != null ? `/${capacity}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.06)',
                    opacity: pressed ? 0.6 : 1,
                  }}
                >
                  <X size={16} color={colors.mutedFg} strokeWidth={2.4} />
                </View>
              )}
            </Pressable>
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
            {attendees.map((a) => {
              const name =
                `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '?';
              return (
                <View
                  key={a.id}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  }}
                >
                  <Avatar name={name} imageUrl={a.imageUrl} size={38} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: '600',
                      color: colors.foreground,
                      letterSpacing: -0.1,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {name}
                  </Text>
                </View>
              );
            })}
            {extra > 0 ? (
              <Text
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {`+${extra}`}
              </Text>
            ) : null}
          </ScrollView>
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
