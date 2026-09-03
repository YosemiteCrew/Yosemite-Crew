import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {SuggestionChips} from '@/features/assistant/components/SuggestionChips/SuggestionChips';
import {ASSISTANT_ACTIONS} from '@/features/assistant/actions/catalogue';

/**
 * The chips are the catalogue's sample phrases, flattened in catalogue order.
 * Pinned here as literals so a reorder of the catalogue (which would silently
 * change what a first-run user is offered) fails a test rather than sliding by.
 */
const ALL_PHRASE_KEYS = [
  'assistant.actions.nextAppointment.phrase1',
  'assistant.actions.nextAppointment.phrase2',
  'assistant.actions.vaccinationStatus.phrase1',
  'assistant.actions.vaccinationStatus.phrase2',
  'assistant.actions.upcomingTasks.phrase1',
  'assistant.actions.upcomingTasks.phrase2',
  'assistant.actions.petOverview.phrase1',
  'assistant.actions.expenseSummary.phrase1',
  'assistant.actions.addCareTask.phrase1',
  'assistant.actions.addCareTask.phrase2',
  'assistant.actions.logExpense.phrase1',
  'assistant.actions.bookAppointment.phrase1',
  'assistant.actions.bookAppointment.phrase2',
];

/**
 * A translation table with a distinct, human-looking value for every key, so an
 * assertion on rendered text can only pass if the component ran the key through
 * t() — rendering the raw key would produce different text.
 */
const mockPhraseLabels: Record<string, string> = {
  'assistant.actions.nextAppointment.phrase1': "When is Milo's next visit?",
  'assistant.actions.nextAppointment.phrase2': 'Next appointment',
  'assistant.actions.vaccinationStatus.phrase1': 'Is Milo up to date on shots?',
  'assistant.actions.vaccinationStatus.phrase2': 'Vaccination status',
  'assistant.actions.upcomingTasks.phrase1': "What's due this week?",
  'assistant.actions.upcomingTasks.phrase2': 'Upcoming tasks',
  'assistant.actions.petOverview.phrase1': 'Tell me about Milo',
  'assistant.actions.expenseSummary.phrase1': 'How much have I spent?',
  'assistant.actions.addCareTask.phrase1': 'Remind me to give Milo his pill',
  'assistant.actions.addCareTask.phrase2': 'Add a care task',
  'assistant.actions.logExpense.phrase1': 'Log a 40 euro vet bill',
  'assistant.actions.bookAppointment.phrase1': 'Book a check-up for Milo',
  'assistant.actions.bookAppointment.phrase2': 'Book an appointment',
};

const labelFor = (key: string): string => {
  const label = mockPhraseLabels[key];
  if (!label) {
    throw new Error(`Test table is missing a label for ${key}`);
  }
  return label;
};

const labelsFor = (keys: readonly string[]): string[] => keys.map(labelFor);

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => mockPhraseLabels[key] ?? key,
  }),
}));

const renderChips = (props: {onSelect?: jest.Mock; limit?: number} = {}) => {
  const onSelect = props.onSelect ?? jest.fn();
  const utils = render(
    <SuggestionChips onSelect={onSelect} limit={props.limit} />,
  );
  return {...utils, onSelect};
};

/** The visible text of every chip, in render order. */
const chipTexts = (
  utils: ReturnType<typeof renderChips>,
): (string | undefined)[] =>
  utils
    .getAllByRole('button')
    .map(chip => chip.props.accessibilityLabel as string | undefined);

describe('SuggestionChips', () => {
  describe('chip source', () => {
    it('draws its phrases from the catalogue, flattened in catalogue order', () => {
      expect(
        ASSISTANT_ACTIONS.flatMap(action => [...action.samplePhraseKeys]),
      ).toEqual(ALL_PHRASE_KEYS);
    });

    it('renders four chips when the limit prop is omitted entirely', () => {
      const {getAllByRole} = render(<SuggestionChips onSelect={jest.fn()} />);

      expect(getAllByRole('button')).toHaveLength(4);
    });

    it('renders four chips when limit is passed as undefined', () => {
      const utils = renderChips();

      expect(utils.getAllByRole('button')).toHaveLength(4);
    });

    it('shows the first four sample phrases by default', () => {
      const utils = renderChips();

      expect(chipTexts(utils)).toEqual(labelsFor(ALL_PHRASE_KEYS.slice(0, 4)));
    });

    it('shows only two chips when limit is 2', () => {
      const utils = renderChips({limit: 2});

      expect(chipTexts(utils)).toEqual([
        "When is Milo's next visit?",
        'Next appointment',
      ]);
    });

    it('flattens across actions with a single sample phrase when limit is 8', () => {
      const utils = renderChips({limit: 8});

      expect(chipTexts(utils)).toEqual([
        "When is Milo's next visit?",
        'Next appointment',
        'Is Milo up to date on shots?',
        'Vaccination status',
        "What's due this week?",
        'Upcoming tasks',
        'Tell me about Milo',
        'How much have I spent?',
      ]);
    });

    it('renders no chips when limit is 0', () => {
      const utils = renderChips({limit: 0});

      expect(utils.queryAllByRole('button')).toHaveLength(0);
      expect(utils.queryByText("When is Milo's next visit?")).toBeNull();
    });

    it('renders every sample phrase once when limit exceeds the catalogue', () => {
      const utils = renderChips({limit: 500});

      expect(chipTexts(utils)).toEqual(labelsFor(ALL_PHRASE_KEYS));
    });

    // The limit is handed straight to Array.prototype.slice, so a negative cap
    // counts back from the end instead of capping. Pinned as the current
    // behaviour, not endorsed: -1 widens the row to 12 chips.
    it('counts a negative limit back from the end instead of capping', () => {
      const utils = renderChips({limit: -1});

      expect(utils.getAllByRole('button')).toHaveLength(
        ALL_PHRASE_KEYS.length - 1,
      );
      expect(chipTexts(utils)).toEqual(labelsFor(ALL_PHRASE_KEYS.slice(0, -1)));
    });

    it('drops chips when the limit shrinks on a re-render', () => {
      const onSelect = jest.fn();
      const {getAllByRole, rerender} = render(
        <SuggestionChips onSelect={onSelect} limit={6} />,
      );
      expect(getAllByRole('button')).toHaveLength(6);

      rerender(<SuggestionChips onSelect={onSelect} limit={3} />);

      expect(getAllByRole('button')).toHaveLength(3);
      expect(
        getAllByRole('button').map(c => c.props.accessibilityLabel),
      ).toEqual([
        "When is Milo's next visit?",
        'Next appointment',
        'Is Milo up to date on shots?',
      ]);
    });
  });

  describe('labels', () => {
    it('renders the translated phrase, not the raw catalogue key', () => {
      const utils = renderChips({limit: 1});

      expect(utils.getByText("When is Milo's next visit?")).toBeTruthy();
      expect(
        utils.queryByText('assistant.actions.nextAppointment.phrase1'),
      ).toBeNull();
    });

    it('renders one Text label per chip', () => {
      const utils = renderChips({limit: 3});

      labelsFor(ALL_PHRASE_KEYS.slice(0, 3)).forEach(label => {
        expect(utils.getByText(label)).toBeTruthy();
      });
    });
  });

  describe('selection', () => {
    it('does not call onSelect on mount', () => {
      const {onSelect} = renderChips();

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('calls onSelect with the pressed chip label', () => {
      const utils = renderChips();

      fireEvent.press(utils.getByText("When is Milo's next visit?"));

      expect(utils.onSelect).toHaveBeenCalledTimes(1);
      expect(utils.onSelect).toHaveBeenCalledWith("When is Milo's next visit?");
    });

    it('reports the label of the chip that was pressed, not the first one', () => {
      const utils = renderChips();

      fireEvent.press(utils.getByText('Vaccination status'));

      expect(utils.onSelect).toHaveBeenCalledTimes(1);
      expect(utils.onSelect).toHaveBeenCalledWith('Vaccination status');
    });

    it('passes the translated label rather than the catalogue key', () => {
      const utils = renderChips({limit: 1});

      fireEvent.press(utils.getAllByRole('button')[0]);

      expect(utils.onSelect).toHaveBeenCalledWith("When is Milo's next visit?");
      expect(utils.onSelect).not.toHaveBeenCalledWith(
        'assistant.actions.nextAppointment.phrase1',
      );
    });

    it('reports each chip separately when several are pressed', () => {
      const utils = renderChips({limit: 4});

      fireEvent.press(utils.getByText('Next appointment'));
      fireEvent.press(utils.getByText('Is Milo up to date on shots?'));

      expect(utils.onSelect.mock.calls).toEqual([
        ['Next appointment'],
        ['Is Milo up to date on shots?'],
      ]);
    });
  });

  describe('accessibility', () => {
    it('exposes every chip as a button', () => {
      const utils = renderChips({limit: 5});

      const roles = utils
        .getAllByRole('button')
        .map(chip => chip.props.accessibilityRole);

      expect(roles).toEqual(['button', 'button', 'button', 'button', 'button']);
    });

    it('labels each button with the phrase it will send', () => {
      const utils = renderChips({limit: 3});

      labelsFor(ALL_PHRASE_KEYS.slice(0, 3)).forEach(label => {
        expect(utils.getByLabelText(label)).toBeTruthy();
      });
    });

    it('gives the accessibility label the same text the chip displays', () => {
      const utils = renderChips({limit: 2});

      utils.getAllByRole('button').forEach(chip => {
        expect(utils.getByLabelText(chip.props.accessibilityLabel)).toBe(chip);
      });
    });
  });

  describe('layout', () => {
    it('renders a horizontal scroller with the assistant suggestions testID', () => {
      const utils = renderChips();

      const scroller = utils.getByTestId('assistant-suggestions');

      expect(scroller.props.horizontal).toBe(true);
      expect(scroller.props.showsHorizontalScrollIndicator).toBe(false);
    });

    it('spaces the row using the theme spacing scale', () => {
      const utils = renderChips();

      const containerStyle = StyleSheet.flatten(
        utils.getByTestId('assistant-suggestions').props.contentContainerStyle,
      );

      expect(containerStyle).toMatchObject({
        paddingHorizontal: 16,
        gap: 8,
        paddingBottom: 8,
      });
    });

    it('styles each chip from the theme tokens', () => {
      const utils = renderChips({limit: 1});

      const chipStyle = StyleSheet.flatten(
        utils.getAllByRole('button')[0].props.style,
      );

      expect(chipStyle).toMatchObject({
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        backgroundColor: '#FFFFFF',
      });
    });

    it('styles the chip text with the theme label typography', () => {
      const utils = renderChips({limit: 1});

      const textStyle = StyleSheet.flatten(
        utils.getByText("When is Milo's next visit?").props.style,
      );

      expect(textStyle).toMatchObject({
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 21,
        fontFamily: 'Satoshi-Medium',
        color: '#302F2E',
      });
    });
  });
});
