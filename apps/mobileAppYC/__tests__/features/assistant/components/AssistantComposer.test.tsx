import React from 'react';
import {StyleSheet} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {AssistantComposer} from '@/features/assistant/components/AssistantComposer/AssistantComposer';
import {MAX_UTTERANCE_LENGTH} from '@/features/assistant/constants';

/**
 * Distinct, human-looking copy for the two keys the composer translates, so an
 * assertion on rendered text can only pass if the value went through t() — the
 * raw key would render as different text.
 */
const SEND_LABEL = 'Send it';
const PLACEHOLDER = 'Ask about your pet';

const mockCopy: Record<string, string> = {
  'assistant.send': SEND_LABEL,
  'assistant.composerPlaceholder': PLACEHOLDER,
};

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => mockCopy[key] ?? key,
  }),
}));

interface ComposerOptions {
  value?: string;
  busy?: boolean;
  onSubmit?: jest.Mock;
  onChangeText?: jest.Mock;
}

const renderComposer = (options: ComposerOptions = {}) => {
  const onSubmit = options.onSubmit ?? jest.fn();
  const onChangeText = options.onChangeText ?? jest.fn();
  const utils = render(
    <AssistantComposer
      value={options.value ?? ''}
      busy={options.busy ?? false}
      onSubmit={onSubmit}
      onChangeText={onChangeText}
    />,
  );
  return {...utils, onSubmit, onChangeText};
};

const inputOf = (utils: ReturnType<typeof renderComposer>) =>
  utils.getByTestId('assistant-input');

const sendOf = (utils: ReturnType<typeof renderComposer>) =>
  utils.getByTestId('assistant-send');

const inputBorderColor = (utils: ReturnType<typeof renderComposer>) =>
  StyleSheet.flatten(inputOf(utils).props.style).borderColor;

describe('AssistantComposer', () => {
  describe('typing', () => {
    it('reports every keystroke through onChangeText', () => {
      const utils = renderComposer({value: ''});

      fireEvent.changeText(inputOf(utils), 'Wh');

      expect(utils.onChangeText).toHaveBeenCalledTimes(1);
      expect(utils.onChangeText).toHaveBeenCalledWith('Wh');
    });

    it('passes the raw text through without trimming it', () => {
      const utils = renderComposer({value: ''});

      fireEvent.changeText(inputOf(utils), '  spaced out  ');

      expect(utils.onChangeText).toHaveBeenCalledWith('  spaced out  ');
    });

    it('reports each edit separately', () => {
      const utils = renderComposer({value: ''});

      fireEvent.changeText(inputOf(utils), 'a');
      fireEvent.changeText(inputOf(utils), 'ab');

      expect(utils.onChangeText.mock.calls).toEqual([['a'], ['ab']]);
    });

    it('renders the value it is given rather than owning the text itself', () => {
      const utils = renderComposer({value: 'Is Milo due for shots?'});

      expect(inputOf(utils).props.value).toBe('Is Milo due for shots?');
    });

    it('shows the new value when the parent pushes a suggestion chip in', () => {
      const onSubmit = jest.fn();
      const onChangeText = jest.fn();
      const {getByTestId, rerender} = render(
        <AssistantComposer
          value=""
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      expect(getByTestId('assistant-input').props.value).toBe('');

      rerender(
        <AssistantComposer
          value="Book an appointment"
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );

      expect(getByTestId('assistant-input').props.value).toBe(
        'Book an appointment',
      );
      expect(getByTestId('assistant-send').props.accessibilityState).toEqual({
        disabled: false,
      });
    });

    it('caps the field at MAX_UTTERANCE_LENGTH characters', () => {
      const utils = renderComposer();

      expect(inputOf(utils).props.maxLength).toBe(MAX_UTTERANCE_LENGTH);
      expect(inputOf(utils).props.maxLength).toBe(500);
    });

    it('is a multiline field with a send return key', () => {
      const utils = renderComposer();

      expect(inputOf(utils).props.multiline).toBe(true);
      expect(inputOf(utils).props.returnKeyType).toBe('send');
      expect(inputOf(utils).props.blurOnSubmit).toBe(true);
    });
  });

  describe('send availability', () => {
    it('disables send when the field is empty', () => {
      const utils = renderComposer({value: ''});

      expect(sendOf(utils).props.accessibilityState).toEqual({disabled: true});
    });

    it('disables send when the field holds only whitespace', () => {
      const utils = renderComposer({value: '   \n\t  '});

      expect(sendOf(utils).props.accessibilityState).toEqual({disabled: true});
    });

    it('enables send as soon as there is a non-space character', () => {
      const utils = renderComposer({value: ' a '});

      expect(sendOf(utils).props.accessibilityState).toEqual({disabled: false});
    });

    it('disables send while a reply is in flight even with text present', () => {
      const utils = renderComposer({value: 'Where is my vet?', busy: true});

      expect(sendOf(utils).props.accessibilityState).toEqual({disabled: true});
    });

    it('dims the send button while it is disabled', () => {
      const utils = renderComposer({value: '  '});

      expect(StyleSheet.flatten(sendOf(utils).props.style).opacity).toBe(0.5);
    });

    it('shows the send button at full opacity once it can be pressed', () => {
      const utils = renderComposer({value: 'hi'});

      expect(StyleSheet.flatten(sendOf(utils).props.style).opacity).toBe(1);
    });
  });

  describe('submitting', () => {
    it('does not submit anything on mount', () => {
      const utils = renderComposer({value: 'ready to go'});

      expect(utils.onSubmit).not.toHaveBeenCalled();
    });

    it('submits the trimmed text when send is pressed', () => {
      const utils = renderComposer({value: '   how much have I spent?   '});

      fireEvent.press(sendOf(utils));

      expect(utils.onSubmit).toHaveBeenCalledTimes(1);
      expect(utils.onSubmit).toHaveBeenCalledWith('how much have I spent?');
    });

    it('keeps whitespace inside the utterance while trimming the ends', () => {
      const utils = renderComposer({value: '\n  book  a   visit \n'});

      fireEvent.press(sendOf(utils));

      expect(utils.onSubmit).toHaveBeenCalledWith('book  a   visit');
    });

    it('submits the trimmed text on onSubmitEditing from the keyboard', () => {
      const utils = renderComposer({value: '  next appointment  '});

      fireEvent(inputOf(utils), 'submitEditing');

      expect(utils.onSubmit).toHaveBeenCalledTimes(1);
      expect(utils.onSubmit).toHaveBeenCalledWith('next appointment');
    });

    it('does not submit an empty utterance from the keyboard', () => {
      const utils = renderComposer({value: ''});

      fireEvent(inputOf(utils), 'submitEditing');

      expect(utils.onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit a whitespace-only utterance from the keyboard', () => {
      const utils = renderComposer({value: '    '});

      fireEvent(inputOf(utils), 'submitEditing');

      expect(utils.onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit while busy, even with text, when send is pressed', () => {
      const utils = renderComposer({value: 'another question', busy: true});

      fireEvent.press(sendOf(utils));

      expect(utils.onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit while busy when the keyboard fires submitEditing', () => {
      const utils = renderComposer({value: 'another question', busy: true});

      fireEvent(inputOf(utils), 'submitEditing');

      expect(utils.onSubmit).not.toHaveBeenCalled();
    });

    it('submits again once the reply has landed and busy clears', () => {
      const onSubmit = jest.fn();
      const onChangeText = jest.fn();
      const {getByTestId, rerender} = render(
        <AssistantComposer
          value="tell me about Milo"
          busy
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      fireEvent(getByTestId('assistant-input'), 'submitEditing');
      expect(onSubmit).not.toHaveBeenCalled();

      rerender(
        <AssistantComposer
          value="tell me about Milo"
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      fireEvent.press(getByTestId('assistant-send'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith('tell me about Milo');
    });

    it('submits the latest value after a re-render, not the mounted one', () => {
      const onSubmit = jest.fn();
      const onChangeText = jest.fn();
      const {getByTestId, rerender} = render(
        <AssistantComposer
          value="first"
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );

      rerender(
        <AssistantComposer
          value=" second "
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      fireEvent.press(getByTestId('assistant-send'));

      expect(onSubmit).toHaveBeenCalledWith('second');
      expect(onSubmit).not.toHaveBeenCalledWith('first');
    });
  });

  describe('busy state', () => {
    it('shows the translated send label when idle', () => {
      const utils = renderComposer({value: 'hi', busy: false});

      expect(utils.getByText(SEND_LABEL)).toBeTruthy();
      expect(utils.queryByText('assistant.send')).toBeNull();
      expect(utils.queryByTestId('assistant-busy')).toBeNull();
    });

    it('replaces the send label with a spinner while busy', () => {
      const utils = renderComposer({value: 'hi', busy: true});

      expect(utils.getByTestId('assistant-busy')).toBeTruthy();
      expect(utils.queryByText(SEND_LABEL)).toBeNull();
    });

    it('tints the spinner with the CTA foreground colour', () => {
      const utils = renderComposer({value: 'hi', busy: true});

      expect(utils.getByTestId('assistant-busy').props.color).toBe('#FFFFFF');
    });

    it('swaps the spinner back for the label when busy clears', () => {
      const onSubmit = jest.fn();
      const onChangeText = jest.fn();
      const {queryByText, queryByTestId, rerender} = render(
        <AssistantComposer
          value="hi"
          busy
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      expect(queryByTestId('assistant-busy')).not.toBeNull();

      rerender(
        <AssistantComposer
          value="hi"
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );

      expect(queryByTestId('assistant-busy')).toBeNull();
      expect(queryByText(SEND_LABEL)).not.toBeNull();
    });

    it('keeps the send button labelled for screen readers while the spinner shows', () => {
      const utils = renderComposer({value: 'hi', busy: true});

      expect(utils.getByLabelText(SEND_LABEL)).toBe(sendOf(utils));
      expect(sendOf(utils).props.accessibilityRole).toBe('button');
    });
  });

  describe('focus', () => {
    it('uses the neutral border colour before the field is touched', () => {
      const utils = renderComposer();

      expect(inputBorderColor(utils)).toBe('#EAEAEA');
    });

    it('switches to the primary border colour on focus', () => {
      const utils = renderComposer();

      fireEvent(inputOf(utils), 'focus');

      expect(inputBorderColor(utils)).toBe('#257BED');
    });

    it('returns to the neutral border colour on blur', () => {
      const utils = renderComposer();
      fireEvent(inputOf(utils), 'focus');
      expect(inputBorderColor(utils)).toBe('#257BED');

      fireEvent(inputOf(utils), 'blur');

      expect(inputBorderColor(utils)).toBe('#EAEAEA');
    });

    it('keeps the focused border across a value change', () => {
      const onSubmit = jest.fn();
      const onChangeText = jest.fn();
      const {getByTestId, rerender} = render(
        <AssistantComposer
          value=""
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );
      fireEvent(getByTestId('assistant-input'), 'focus');

      rerender(
        <AssistantComposer
          value="typed"
          busy={false}
          onSubmit={onSubmit}
          onChangeText={onChangeText}
        />,
      );

      expect(
        StyleSheet.flatten(getByTestId('assistant-input').props.style)
          .borderColor,
      ).toBe('#257BED');
    });
  });

  describe('presentation', () => {
    it('labels the field with the translated placeholder', () => {
      const utils = renderComposer();

      expect(utils.getByPlaceholderText(PLACEHOLDER)).toBe(inputOf(utils));
      expect(inputOf(utils).props.accessibilityLabel).toBe(PLACEHOLDER);
      expect(inputOf(utils).props.placeholderTextColor).toBe('#747473');
    });

    it('styles the field from the theme tokens', () => {
      const utils = renderComposer();

      expect(StyleSheet.flatten(inputOf(utils).props.style)).toMatchObject({
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        backgroundColor: '#FBF8F2',
        color: '#302F2E',
        fontSize: 16,
        fontFamily: 'Satoshi-Regular',
      });
    });

    it('styles the send button from the theme tokens', () => {
      const utils = renderComposer({value: 'hi'});

      expect(StyleSheet.flatten(sendOf(utils).props.style)).toMatchObject({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 18,
        backgroundColor: '#302F2E',
      });
    });

    it('styles the send label with the small button typography', () => {
      const utils = renderComposer({value: 'hi'});

      expect(
        StyleSheet.flatten(utils.getByText(SEND_LABEL).props.style),
      ).toMatchObject({
        fontSize: 14,
        fontWeight: '500',
        fontFamily: 'Satoshi-Medium',
        color: '#FFFFFF',
      });
    });
  });
});
