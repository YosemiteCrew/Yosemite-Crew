import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {ActionResultCard} from '@/features/assistant/components/ActionResultCard/ActionResultCard';
import type {
  AssistantActionId,
  AssistantActionResult,
  AssistantResultItem,
} from '@/features/assistant/types';

/**
 * A distinct, human-looking label per open key, so an assertion on the button's
 * text can only pass if the component ran `assistant.open.<actionId>` through
 * t(). Rendering the raw key would produce different text.
 */
const mockOpenLabels: Record<string, string> = {
  'assistant.open.bookAppointment': 'Open the booking form',
  'assistant.open.addCareTask': 'Open the new task form',
  'assistant.open.logExpense': 'Open the expense form',
};

// The card reads every spacing/colour/typography token off useTheme().
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => mockOpenLabels[key] ?? key,
  }),
}));

type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[] | null;
};

const makeResult = (
  overrides: Partial<AssistantActionResult> = {},
): AssistantActionResult => ({
  actionId: 'upcomingTasks',
  status: 'ok',
  speechKey: 'assistant.speech.upcomingTasks',
  ...overrides,
});

const withItems = (
  items: AssistantResultItem[],
  overrides: Partial<AssistantActionResult> = {},
): AssistantActionResult => makeResult({data: {items}, ...overrides});

const handoff = (
  actionId: AssistantActionId,
  deepLink: string | undefined,
  overrides: Partial<AssistantActionResult> = {},
): AssistantActionResult =>
  makeResult({actionId, status: 'handoff', deepLink, ...overrides});

const renderCard = (result: AssistantActionResult) => {
  const onOpen = jest.fn();
  const utils = render(<ActionResultCard result={result} onOpen={onOpen} />);
  return {...utils, onOpen};
};

/** The card's own children: one View per item, then the button when present. */
const cardChildren = (toJSON: () => unknown): JsonNode[] => {
  const root = toJSON() as JsonNode | null;
  if (!root) {
    throw new Error('Expected the card to render, but it rendered null');
  }
  return root.children ?? [];
};

describe('ActionResultCard', () => {
  describe('when there is nothing to show', () => {
    it('renders null for a read result with no data at all', () => {
      const {toJSON, queryByTestId} = renderCard(makeResult());

      expect(toJSON()).toBeNull();
      expect(queryByTestId('assistant-result-card')).toBeNull();
    });

    it('renders null when data is present but carries no items key', () => {
      const {toJSON} = renderCard(makeResult({data: {petName: 'Milo'}}));

      expect(toJSON()).toBeNull();
    });

    it('renders null when the item list is empty', () => {
      const {toJSON} = renderCard(withItems([]));

      expect(toJSON()).toBeNull();
    });

    it('renders null for a handoff result that has no deep link', () => {
      const {toJSON, queryByTestId} = renderCard(
        handoff('bookAppointment', undefined),
      );

      expect(toJSON()).toBeNull();
      expect(queryByTestId('assistant-result-open')).toBeNull();
    });

    it('renders null for a handoff result whose deep link is an empty string', () => {
      const {toJSON} = renderCard(handoff('bookAppointment', ''));

      expect(toJSON()).toBeNull();
    });

    it('renders null for a non-handoff result that happens to carry a deep link', () => {
      const {toJSON, queryByTestId} = renderCard(
        makeResult({status: 'ok', deepLink: 'yc://tasks/new'}),
      );

      expect(toJSON()).toBeNull();
      expect(queryByTestId('assistant-result-open')).toBeNull();
    });
  });

  describe('item list', () => {
    const twoItems: AssistantResultItem[] = [
      {id: 't1', title: 'Give Milo his pill', subtitle: 'Today, 8:00 pm'},
      {id: 't2', title: 'Brush Nala', subtitle: 'Tomorrow, 9:00 am'},
    ];

    it('renders the card once every item title is present', () => {
      const {getByTestId, getByText} = renderCard(withItems(twoItems));

      expect(getByTestId('assistant-result-card')).toBeTruthy();
      expect(getByText('Give Milo his pill')).toBeTruthy();
      expect(getByText('Brush Nala')).toBeTruthy();
    });

    it('renders one row per item, in the order given', () => {
      const {toJSON} = renderCard(withItems(twoItems));
      const rows = cardChildren(toJSON);

      expect(rows).toHaveLength(2);
      expect((rows[0].children?.[0] as JsonNode).children).toEqual([
        'Give Milo his pill',
      ]);
      expect((rows[1].children?.[0] as JsonNode).children).toEqual([
        'Brush Nala',
      ]);
    });

    it('renders the subtitle beneath an item that has one', () => {
      const {getByText, toJSON} = renderCard(withItems(twoItems));

      expect(getByText('Today, 8:00 pm')).toBeTruthy();
      // Title line plus subtitle line.
      expect(cardChildren(toJSON)[0].children).toHaveLength(2);
    });

    it('omits the subtitle line entirely for an item without one', () => {
      const {queryByText, toJSON} = renderCard(
        withItems([{id: 't1', title: 'Give Milo his pill'}]),
      );
      const rows = cardChildren(toJSON);

      expect(rows).toHaveLength(1);
      expect(rows[0].children).toHaveLength(1);
      expect(queryByText('undefined')).toBeNull();
    });

    it('omits the subtitle line when the subtitle is an empty string', () => {
      const {toJSON} = renderCard(
        withItems([{id: 't1', title: 'Brush Nala', subtitle: ''}]),
      );

      expect(cardChildren(toJSON)[0].children).toHaveLength(1);
    });

    it('mixes items with and without subtitles in the same card', () => {
      const {toJSON, getByText} = renderCard(
        withItems([
          {id: 't1', title: 'Give Milo his pill'},
          {id: 't2', title: 'Brush Nala', subtitle: 'Tomorrow, 9:00 am'},
        ]),
      );
      const rows = cardChildren(toJSON);

      expect(rows[0].children).toHaveLength(1);
      expect(rows[1].children).toHaveLength(2);
      expect(getByText('Tomorrow, 9:00 am')).toBeTruthy();
    });

    it('draws a divider above every row except the first', () => {
      const {toJSON} = renderCard(
        withItems([
          {id: 't1', title: 'First'},
          {id: 't2', title: 'Second'},
          {id: 't3', title: 'Third'},
        ]),
      );
      const borders = cardChildren(toJSON).map(
        row => StyleSheet.flatten(row.props.style as never).borderTopWidth,
      );

      expect(borders).toEqual([0, 1, 1]);
    });

    it('paints the divider and row padding from the theme', () => {
      const {toJSON} = renderCard(withItems(twoItems));
      const secondRow = StyleSheet.flatten(
        cardChildren(toJSON)[1].props.style as never,
      );

      expect(secondRow.borderTopColor).toBe(mockTheme.colors.divider);
      expect(secondRow.paddingVertical).toBe(mockTheme.spacing['2']);
    });

    it('styles the title with the bold small label token and body ink', () => {
      const {getByText} = renderCard(withItems(twoItems));
      const style = StyleSheet.flatten(
        getByText('Give Milo his pill').props.style,
      );

      expect(style.fontSize).toBe(mockTheme.typography.labelSmallBold.fontSize);
      expect(style.fontFamily).toBe(
        mockTheme.typography.labelSmallBold.fontFamily,
      );
      expect(style.color).toBe(mockTheme.colors.text);
    });

    it('styles the subtitle with the xs label token and secondary ink', () => {
      const {getByText} = renderCard(withItems(twoItems));
      const style = StyleSheet.flatten(getByText('Today, 8:00 pm').props.style);

      expect(style.fontSize).toBe(mockTheme.typography.labelXs.fontSize);
      expect(style.fontFamily).toBe(mockTheme.typography.labelXs.fontFamily);
      expect(style.color).toBe(mockTheme.colors.textSecondary);
    });

    it('renders no open button for a read result that only has items', () => {
      const {queryByTestId, queryByRole} = renderCard(withItems(twoItems));

      expect(queryByTestId('assistant-result-open')).toBeNull();
      expect(queryByRole('button')).toBeNull();
    });
  });

  describe('handoff button', () => {
    const bookingLink = 'yc://appointments/new?petName=Milo';

    it('renders the open button for a handoff result with a deep link', () => {
      const {getByTestId, getByRole} = renderCard(
        handoff('bookAppointment', bookingLink),
      );

      expect(getByTestId('assistant-result-open')).toBeTruthy();
      expect(getByRole('button')).toBeTruthy();
    });

    it('labels the button with the open key for that action id', () => {
      const {getByText, queryByText} = renderCard(
        handoff('bookAppointment', bookingLink),
      );

      expect(getByText('Open the booking form')).toBeTruthy();
      expect(queryByText('assistant.open.bookAppointment')).toBeNull();
    });

    it('uses a different label for a different action id', () => {
      const {getByText} = renderCard(
        handoff('logExpense', 'yc://expenses/new'),
      );

      expect(getByText('Open the expense form')).toBeTruthy();
    });

    it('calls onOpen with the deep link when the button is pressed', () => {
      const {getByTestId, onOpen} = renderCard(
        handoff('bookAppointment', bookingLink),
      );

      fireEvent.press(getByTestId('assistant-result-open'));

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith(bookingLink);
    });

    it('does not call onOpen before the button is pressed', () => {
      const {onOpen} = renderCard(handoff('bookAppointment', bookingLink));

      expect(onOpen).not.toHaveBeenCalled();
    });

    it('renders the button below the items when a handoff also carries items', () => {
      const {toJSON, getByText, getByTestId} = renderCard(
        handoff('addCareTask', 'yc://tasks/new?title=Pill', {
          data: {items: [{id: 't1', title: 'Give Milo his pill'}]},
        }),
      );
      const children = cardChildren(toJSON);

      expect(children).toHaveLength(2);
      expect(getByText('Give Milo his pill')).toBeTruthy();
      expect(getByText('Open the new task form')).toBeTruthy();
      expect(getByTestId('assistant-result-open')).toBeTruthy();
    });

    it('renders the items but no button when a handoff has no deep link', () => {
      const {toJSON, getByText, queryByTestId, queryByRole} = renderCard(
        handoff('bookAppointment', undefined, {
          data: {items: [{id: 'a1', title: 'Check-up with Dr Reed'}]},
        }),
      );

      expect(cardChildren(toJSON)).toHaveLength(1);
      expect(getByText('Check-up with Dr Reed')).toBeTruthy();
      expect(queryByTestId('assistant-result-open')).toBeNull();
      expect(queryByRole('button')).toBeNull();
    });

    it('renders no button when a result carries a deep link but is not a handoff', () => {
      const {getByText, queryByTestId} = renderCard(
        makeResult({
          status: 'ok',
          deepLink: 'yc://tasks/new',
          data: {items: [{id: 't1', title: 'Brush Nala'}]},
        }),
      );

      expect(getByText('Brush Nala')).toBeTruthy();
      expect(queryByTestId('assistant-result-open')).toBeNull();
    });

    it('paints the button with the cta tokens', () => {
      const {getByTestId, getByText} = renderCard(
        handoff('bookAppointment', bookingLink),
      );
      const buttonStyle = StyleSheet.flatten(
        getByTestId('assistant-result-open').props.style,
      );
      const labelStyle = StyleSheet.flatten(
        getByText('Open the booking form').props.style,
      );

      expect(buttonStyle.backgroundColor).toBe(mockTheme.colors.cta);
      expect(buttonStyle.borderRadius).toBe(mockTheme.borderRadius.button);
      expect(buttonStyle.alignSelf).toBe('flex-start');
      expect(labelStyle.color).toBe(mockTheme.colors.ctaText);
      expect(labelStyle.fontSize).toBe(
        mockTheme.typography.buttonSmall.fontSize,
      );
    });
  });

  describe('card container', () => {
    it('takes its border, background and radius from the theme', () => {
      const {getByTestId} = renderCard(
        withItems([{id: 't1', title: 'Brush Nala'}]),
      );
      const style = StyleSheet.flatten(
        getByTestId('assistant-result-card').props.style,
      );

      expect(style.backgroundColor).toBe(mockTheme.colors.cardBackground);
      expect(style.borderColor).toBe(mockTheme.colors.border);
      expect(style.borderWidth).toBe(1);
      expect(style.borderRadius).toBe(mockTheme.borderRadius.card);
      expect(style.padding).toBe(mockTheme.spacing['4']);
    });

    it('hugs the left edge and caps its width at 90%', () => {
      const {getByTestId} = renderCard(
        withItems([{id: 't1', title: 'Brush Nala'}]),
      );
      const style = StyleSheet.flatten(
        getByTestId('assistant-result-card').props.style,
      );

      expect(style.alignSelf).toBe('flex-start');
      expect(style.maxWidth).toBe('90%');
    });
  });
});
