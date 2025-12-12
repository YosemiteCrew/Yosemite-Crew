import React from 'react';
import {render} from '@testing-library/react-native';
import {BottomSheetMessage} from '../../../src/shared/components/common/BottomSheetMessage/BottomSheetMessage';
import {StyleSheet, Text} from 'react-native';

// --- Mocks ---

// Mock useTheme to provide predictable values
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textSecondary: '#888888', // Default text color
        secondary: '#0000FF', // Highlight color
      },
      spacing: {
        2: 8,
      },
      typography: {
        body: {
          fontSize: 14,
          fontFamily: 'Regular',
        },
      },
    },
  }),
}));

describe('BottomSheetMessage Component', () => {
  // ===========================================================================
  // 1. Rendering Logic (Main Component)
  // ===========================================================================

  it('renders children text correctly', () => {
    const {getByText} = render(
      <BottomSheetMessage>Hello World</BottomSheetMessage>,
    );
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders nested text elements correctly', () => {
    const {getByText} = render(
      <BottomSheetMessage>
        Part 1 <Text>Part 2</Text>
      </BottomSheetMessage>,
    );
    // Use Regex to be safe against whitespace layout in RN Text nesting
    expect(getByText(/Part 1/)).toBeTruthy();
    expect(getByText(/Part 2/)).toBeTruthy();
  });

  // ===========================================================================
  // 2. Sub-Component Logic (Highlight)
  // ===========================================================================

  it('renders Highlight component correctly', () => {
    const {getByText} = render(
      <BottomSheetMessage.Highlight>Important</BottomSheetMessage.Highlight>,
    );
    const text = getByText('Important');
    expect(text).toBeTruthy();
  });

  it('renders Highlight inside parent correctly', () => {
    const {getByText} = render(
      <BottomSheetMessage>
        Please note:{' '}
        <BottomSheetMessage.Highlight>Warning</BottomSheetMessage.Highlight>
      </BottomSheetMessage>,
    );

    // Use Regex or partial matching because "Please note: " might include trailing space behavior
    expect(getByText(/Please note:/)).toBeTruthy();
    expect(getByText('Warning')).toBeTruthy();
  });

  // ===========================================================================
  // 3. Styling Logic
  // ===========================================================================

  it('applies default and custom styles to the Container', () => {
    const customStyle = {marginTop: 20, backgroundColor: 'red'};
    const {getByTestId} = render(
      <BottomSheetMessage testID="container" style={customStyle}>
        Content
      </BottomSheetMessage>,
    );

    const container = getByTestId('container');
    const flatStyle = StyleSheet.flatten(container.props.style);

    // Default styles from mock theme
    expect(flatStyle).toHaveProperty('paddingHorizontal', 8);
    expect(flatStyle).toHaveProperty('marginBottom', 8);
    // Custom merged style
    expect(flatStyle).toHaveProperty('marginTop', 20);
    expect(flatStyle).toHaveProperty('backgroundColor', 'red');
  });

  it('applies default and custom styles to Highlight text', () => {
    const customStyle = {textDecorationLine: 'underline' as const};
    const {getByText} = render(
      <BottomSheetMessage.Highlight style={customStyle}>
        Highlighted
      </BottomSheetMessage.Highlight>,
    );

    const text = getByText('Highlighted');
    const flatStyle = StyleSheet.flatten(text.props.style);

    // Default styles from mock theme
    expect(flatStyle).toHaveProperty('color', '#0000FF');
    expect(flatStyle).toHaveProperty('fontWeight', '600');
    // Custom merged style
    expect(flatStyle).toHaveProperty('textDecorationLine', 'underline');
  });

  // ===========================================================================
  // 4. Props Passing (...rest)
  // ===========================================================================

  it('passes extra props to the main container (ViewProps)', () => {
    const {getByTestId} = render(
      <BottomSheetMessage testID="main-view" accessible={false}>
        Test
      </BottomSheetMessage>,
    );
    const view = getByTestId('main-view');
    expect(view.props.accessible).toBe(false);
  });

  it('passes extra props to the Highlight component (TextProps)', () => {
    const {getByText} = render(
      <BottomSheetMessage.Highlight numberOfLines={2}>
        Long Text
      </BottomSheetMessage.Highlight>,
    );
    const text = getByText('Long Text');
    expect(text.props.numberOfLines).toBe(2);
  });
});
