import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {MessageBubble} from '@/features/assistant/components/MessageBubble/MessageBubble';
import type {
  AssistantMessage,
  AssistantMessageAuthor,
} from '@/features/assistant/types';

// MessageBubble reads every spacing/colour/typography token off useTheme().
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const makeMessage = (
  author: AssistantMessageAuthor,
  text: string,
): AssistantMessage => ({
  id: `msg-${author}`,
  author,
  text,
  createdAt: '2026-09-03T09:00:00.000Z',
});

const bubbleStyleFor = (author: AssistantMessageAuthor, text: string) => {
  const {getByTestId, toJSON} = render(
    <MessageBubble message={makeMessage(author, text)} />,
  );
  const bubble = getByTestId(`assistant-bubble-${author}`);
  // toJSON() is the outer row View that owns the alignment styles.
  const row = toJSON() as {props: {style?: unknown}} | null;
  return {
    bubble,
    bubbleStyle: StyleSheet.flatten(bubble.props.style),
    rowStyle: StyleSheet.flatten(row?.props.style as never),
  };
};

describe('MessageBubble', () => {
  describe('message text', () => {
    it('renders the text of a user message', () => {
      const {getByText} = render(
        <MessageBubble message={makeMessage('user', 'When is Milo due?')} />,
      );

      expect(getByText('When is Milo due?')).toBeTruthy();
    });

    it('renders the text of an assistant message', () => {
      const {getByText} = render(
        <MessageBubble
          message={makeMessage('assistant', 'Milo is due on 12 September.')}
        />,
      );

      expect(getByText('Milo is due on 12 September.')).toBeTruthy();
    });

    it('styles the text with the paragraph token and body ink colour', () => {
      const {getByText} = render(
        <MessageBubble message={makeMessage('assistant', 'Styled line')} />,
      );

      const textStyle = StyleSheet.flatten(
        getByText('Styled line').props.style,
      );
      expect(textStyle.fontSize).toBe(mockTheme.typography.paragraph.fontSize);
      expect(textStyle.fontFamily).toBe(
        mockTheme.typography.paragraph.fontFamily,
      );
      expect(textStyle.lineHeight).toBe(
        mockTheme.typography.paragraph.lineHeight,
      );
      expect(textStyle.color).toBe(mockTheme.colors.text);
    });
  });

  describe('testID', () => {
    it('tags a user message bubble as assistant-bubble-user', () => {
      const {getByTestId, queryByTestId} = render(
        <MessageBubble message={makeMessage('user', 'Hi')} />,
      );

      expect(getByTestId('assistant-bubble-user')).toBeTruthy();
      expect(queryByTestId('assistant-bubble-assistant')).toBeNull();
    });

    it('tags an assistant message bubble as assistant-bubble-assistant', () => {
      const {getByTestId, queryByTestId} = render(
        <MessageBubble message={makeMessage('assistant', 'Hello')} />,
      );

      expect(getByTestId('assistant-bubble-assistant')).toBeTruthy();
      expect(queryByTestId('assistant-bubble-user')).toBeNull();
    });
  });

  describe('author variants', () => {
    it('paints a user bubble with the soft blue token', () => {
      const {bubbleStyle} = bubbleStyleFor('user', 'Mine');

      expect(bubbleStyle.backgroundColor).toBe(mockTheme.colors.blueSoft);
      expect(bubbleStyle.borderColor).toBe(mockTheme.colors.blueSoft);
    });

    it('paints an assistant bubble with the card background and border tokens', () => {
      const {bubbleStyle} = bubbleStyleFor('assistant', 'Theirs');

      expect(bubbleStyle.backgroundColor).toBe(mockTheme.colors.cardBackground);
      expect(bubbleStyle.borderColor).toBe(mockTheme.colors.border);
    });

    it('gives the two authors visibly different bubble colours', () => {
      const user = bubbleStyleFor('user', 'Mine').bubbleStyle;
      const assistant = bubbleStyleFor('assistant', 'Theirs').bubbleStyle;

      expect(user.backgroundColor).not.toBe(assistant.backgroundColor);
      expect(user.borderColor).not.toBe(assistant.borderColor);
      // Guard the tokens themselves: if the theme ever collapsed these two to
      // the same value the inequality above would silently stop meaning
      // anything.
      expect(mockTheme.colors.blueSoft).not.toBe(
        mockTheme.colors.cardBackground,
      );
    });

    it('right-aligns a user message and left-aligns an assistant message', () => {
      expect(bubbleStyleFor('user', 'Mine').rowStyle.alignItems).toBe(
        'flex-end',
      );
      expect(bubbleStyleFor('assistant', 'Theirs').rowStyle.alignItems).toBe(
        'flex-start',
      );
    });
  });

  describe('shared bubble geometry', () => {
    it('applies the same padding, radius and width cap to both authors', () => {
      const user = bubbleStyleFor('user', 'Mine').bubbleStyle;
      const assistant = bubbleStyleFor('assistant', 'Theirs').bubbleStyle;

      for (const style of [user, assistant]) {
        expect(style.maxWidth).toBe('86%');
        expect(style.paddingVertical).toBe(mockTheme.spacing['3']);
        expect(style.paddingHorizontal).toBe(mockTheme.spacing['4']);
        expect(style.borderRadius).toBe(mockTheme.borderRadius.card);
        expect(style.borderWidth).toBe(1);
      }
    });

    it('lays the row out full width with a spacing-2 gap below', () => {
      const {rowStyle} = bubbleStyleFor('user', 'Mine');

      expect(rowStyle.width).toBe('100%');
      expect(rowStyle.marginBottom).toBe(mockTheme.spacing['2']);
    });
  });
});
