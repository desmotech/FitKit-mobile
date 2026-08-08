import { screen } from '@testing-library/react-native';
import { FormBodyView, isRichDocEmpty } from '../form-body-view';
import { renderWithProviders } from '../../../../test/render';

// The plain-text projection mobile used to render flattened a table into
// loose words. These assert the structure actually survives.

const doc = (content: unknown[]) => ({ type: 'doc', content });
const p = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

describe('FormBodyView (native)', () => {
  it('renders every cell of a table, so a rules grid stays readable', async () => {
    await renderWithProviders(
      <FormBodyView
        isRTL
        doc={doc([
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [p('קטגוריה')] },
                  { type: 'tableHeader', content: [p('גיל')] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [p('ילדים')] },
                  { type: 'tableCell', content: [p('6-12')] },
                ],
              },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('קטגוריה')).toBeTruthy();
    expect(screen.getByText('גיל')).toBeTruthy();
    expect(screen.getByText('ילדים')).toBeTruthy();
    expect(screen.getByText('6-12')).toBeTruthy();
  });

  it('renders headings, list items and their bullets', async () => {
    await renderWithProviders(
      <FormBodyView
        isRTL={false}
        doc={doc([
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Rules' }] },
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [p('first')] },
              { type: 'listItem', content: [p('second')] },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('Rules')).toBeTruthy();
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getAllByText('•')).toHaveLength(2);
  });

  it('numbers ordered lists', async () => {
    await renderWithProviders(
      <FormBodyView
        isRTL={false}
        doc={doc([
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [p('one')] },
              { type: 'listItem', content: [p('two')] },
            ],
          },
        ])}
      />,
    );
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
  });

  it('keeps text from an unknown node instead of dropping it', async () => {
    await renderWithProviders(
      <FormBodyView isRTL={false} doc={doc([{ type: 'somethingNew', content: [p('kept')] }])} />,
    );
    expect(screen.getByText('kept')).toBeTruthy();
  });

  it('renders nothing for a non-doc payload', async () => {
    const { toJSON } = await renderWithProviders(
      <FormBodyView isRTL={false} doc={null} />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe('isRichDocEmpty', () => {
  it('detects docs with no visible text so callers can fall back', () => {
    expect(isRichDocEmpty(null)).toBe(true);
    expect(isRichDocEmpty(doc([p('   ')]))).toBe(true);
    expect(isRichDocEmpty(doc([p('text')]))).toBe(false);
  });
});
