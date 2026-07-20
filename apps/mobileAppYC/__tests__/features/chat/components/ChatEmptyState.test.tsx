import React from 'react';
import {render} from '@testing-library/react-native';
import {ChatEmptyState} from '@/features/chat/components/ChatEmptyState';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Ionicons / MaterialIcons are globally mocked in jest.setup.js: each icon
// renders as a Text node with testID `icon-<name>` and accessibilityLabel
// `<name>`, and forwards the size/color props.

describe('ChatEmptyState', () => {
  it('renders the warm-bone empty state scaffold', () => {
    const {getByTestId, getByText} = render(<ChatEmptyState />);

    expect(getByTestId('empty-state-indicator')).toBeTruthy();
    // Serif title copy.
    expect(getByText('Say hello')).toBeTruthy();
  });

  it('renders the pink companion medallion icon with theme color', () => {
    const {getByTestId} = render(<ChatEmptyState />);

    const icon = getByTestId('icon-chatbubbles-outline');
    expect(icon).toBeTruthy();
    expect(icon.props.accessibilityLabel).toBe('chatbubbles-outline');
    expect(icon.props.size).toBe(38);
    expect(icon.props.color).toBe(mockTheme.colors.pink);
  });

  it('falls back to "your pet" when no petName prop is supplied', () => {
    const {getByText} = render(<ChatEmptyState />);

    expect(
      getByText(
        'Everything about your pet stays in this one thread, questions, photos and follow-ups.',
      ),
    ).toBeTruthy();
  });

  it('names the pet in the supporting line when petName is provided', () => {
    const {getByText} = render(<ChatEmptyState petName="Bella" />);

    expect(
      getByText(
        'Everything about Bella stays in this one thread, questions, photos and follow-ups.',
      ),
    ).toBeTruthy();
  });

  it('trims surrounding whitespace from a provided petName', () => {
    const {getByText} = render(<ChatEmptyState petName="  Max  " />);

    expect(
      getByText(
        'Everything about Max stays in this one thread, questions, photos and follow-ups.',
      ),
    ).toBeTruthy();
  });

  it('falls back to "your pet" when petName is only whitespace', () => {
    const {getByText} = render(<ChatEmptyState petName="   " />);

    expect(
      getByText(
        'Everything about your pet stays in this one thread, questions, photos and follow-ups.',
      ),
    ).toBeTruthy();
  });

  it('falls back to "your pet" when petName is an empty string', () => {
    const {getByText} = render(<ChatEmptyState petName="" />);

    expect(
      getByText(
        'Everything about your pet stays in this one thread, questions, photos and follow-ups.',
      ),
    ).toBeTruthy();
  });
});
