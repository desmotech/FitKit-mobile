/**
 * Rich form body renderer for React Native.
 *
 * The native twin of the web `FormBodyView` and the API's
 * `renderFormBodyHtml` (which composes the signed PDF). All three walk the
 * same Tiptap/ProseMirror document JSON with the same whitelisted node and
 * mark set, so a member signs on their phone exactly what the coach wrote and
 * what the stored PDF shows.
 *
 * Until this existed, mobile rendered only `bodyRichtext` — the flattened
 * plain-text projection — so headings, lists and especially TABLES arrived as
 * a wall of loose words with no structure.
 *
 * KEEP THE WHITELIST IN SYNC with libs/shared/src/lib/richtext/form-body.ts.
 * React Native has no <table>, so tables are Views: a column of rows, each a
 * row of bordered cells that share the width. Deliberately no horizontal
 * scroller — a nested same-axis scroll view competes for the touch responder
 * on this screen (the signature canvas is a pan responder), so cells wrap
 * their text instead.
 */

import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';

interface RichMark {
  type?: string;
}

interface RichNode {
  type?: string;
  text?: string;
  marks?: RichMark[];
  attrs?: Record<string, unknown>;
  content?: RichNode[];
}

const HEADING_SIZES: Record<number, number> = { 1: 20, 2: 17, 3: 15 };
const TEXT_ALIGNS = new Set(['left', 'right', 'center', 'justify']);

function alignOf(
  attrs: Record<string, unknown> | undefined,
  fallback: 'left' | 'right',
): 'left' | 'right' | 'center' | 'justify' {
  const a = attrs?.textAlign;
  if (typeof a === 'string' && TEXT_ALIGNS.has(a)) {
    return a as 'left' | 'right' | 'center' | 'justify';
  }
  return fallback;
}

function markStyle(marks: RichMark[] | undefined) {
  const style: Record<string, unknown> = {};
  for (const m of marks ?? []) {
    if (m.type === 'bold') style.fontWeight = '700';
    if (m.type === 'italic') style.fontStyle = 'italic';
    if (m.type === 'underline') style.textDecorationLine = 'underline';
    if (m.type === 'strike') {
      style.textDecorationLine =
        style.textDecorationLine === 'underline'
          ? 'underline line-through'
          : 'line-through';
    }
  }
  return style;
}

interface Ctx {
  isRTL: boolean;
  color: string;
  mutedColor: string;
  borderColor: string;
}

/** Inline content (text + marks) for one block. */
function inline(nodes: RichNode[] | undefined, ctx: Ctx): ReactNode {
  return (nodes ?? []).map((n, i) => {
    if (n.type === 'text') {
      return (
        <Text key={i} style={markStyle(n.marks)}>
          {n.text ?? ''}
        </Text>
      );
    }
    if (n.type === 'hardBreak') return <Text key={i}>{'\n'}</Text>;
    // Unknown inline node: keep its text children, drop the wrapper.
    return <Fragment key={i}>{inline(n.content, ctx)}</Fragment>;
  });
}

function blockText(
  node: RichNode,
  ctx: Ctx,
  extra?: Record<string, unknown>,
): ReactNode {
  return (
    <Text
      style={{
        fontSize: 14,
        lineHeight: 20,
        color: ctx.color,
        textAlign: alignOf(node.attrs, ctx.isRTL ? 'right' : 'left'),
        writingDirection: ctx.isRTL ? 'rtl' : 'ltr',
        ...extra,
      }}
    >
      {inline(node.content, ctx)}
    </Text>
  );
}

/** Header cells read as headers: bold every text leaf inside them. */
function boldenLeaves(node: RichNode): RichNode {
  if (node.type === 'text') {
    return { ...node, marks: [...(node.marks ?? []), { type: 'bold' }] };
  }
  if (!node.content) return node;
  return { ...node, content: node.content.map(boldenLeaves) };
}

function renderBlock(node: RichNode, key: number, ctx: Ctx): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <View key={key}>{blockText(node, ctx)}</View>;

    case 'heading': {
      const raw = node.attrs?.level;
      const level = typeof raw === 'number' && HEADING_SIZES[raw] ? raw : 2;
      return (
        <View key={key} style={{ marginTop: 6 }}>
          {blockText(node, ctx, {
            fontSize: HEADING_SIZES[level],
            lineHeight: HEADING_SIZES[level] + 6,
            fontWeight: '700',
          })}
        </View>
      );
    }

    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      return (
        <View key={key} style={{ gap: 4 }}>
          {(node.content ?? []).map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: ctx.isRTL ? 'row-reverse' : 'row',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, lineHeight: 20, color: ctx.mutedColor }}>
                {ordered ? `${i + 1}.` : '•'}
              </Text>
              <View style={{ flex: 1 }}>
                {(item.content ?? []).map((child, j) =>
                  renderBlock(child, j, ctx),
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'blockquote':
      return (
        <View
          key={key}
          style={{
            borderStartWidth: 3,
            borderStartColor: ctx.borderColor,
            paddingStart: 10,
            gap: 4,
          }}
        >
          {(node.content ?? []).map((child, i) => renderBlock(child, i, ctx))}
        </View>
      );

    case 'horizontalRule':
      return (
        <View
          key={key}
          style={{ height: 1, backgroundColor: ctx.borderColor, marginVertical: 6 }}
        />
      );

    case 'table':
      return (
        <View
          key={key}
          style={{
            borderWidth: 1,
            borderColor: ctx.borderColor,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {(node.content ?? []).map((row, i) => (
            <View
              key={i}
              style={{
                flexDirection: ctx.isRTL ? 'row-reverse' : 'row',
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: ctx.borderColor,
              }}
            >
              {(row.content ?? []).map((cell, j) => {
                const isHeader = cell.type === 'tableHeader';
                return (
                  <View
                    key={j}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: 8,
                      borderStartWidth: j === 0 ? 0 : 1,
                      borderStartColor: ctx.borderColor,
                    }}
                  >
                    {(cell.content ?? []).map((child, k) =>
                      renderBlock(
                        isHeader ? boldenLeaves(child) : child,
                        k,
                        ctx,
                      ),
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      );

    // tableRow / tableHeader / tableCell are consumed by 'table' above.
    default:
      // Unknown block: keep children, drop the wrapper — same as the shared
      // serializer, so an extension enabled in the editor but missing here
      // degrades to readable text rather than vanishing.
      if (node.content?.length) {
        return (
          <View key={key}>
            {node.content.map((child, i) => renderBlock(child, i, ctx))}
          </View>
        );
      }
      return null;
  }
}

export function FormBodyView({
  doc,
  isRTL,
}: {
  doc: unknown;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const node = doc as RichNode;
  if (node.type !== 'doc' || !Array.isArray(node.content)) return null;

  const ctx: Ctx = {
    isRTL,
    color: colors.foreground,
    mutedColor: colors.mutedFg,
    borderColor: colors.border,
  };

  return (
    <View style={{ gap: 8 }}>
      {node.content.map((child, i) => renderBlock(child, i, ctx))}
    </View>
  );
}

/** True when the doc has no visible text (so callers can fall back). */
export function isRichDocEmpty(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return true;
  const walk = (n: RichNode): string =>
    n.type === 'text' ? (n.text ?? '') : (n.content ?? []).map(walk).join('');
  return walk(doc as RichNode).trim().length === 0;
}
