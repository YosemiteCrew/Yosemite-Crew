import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {
  InlineEditRow,
  InlineEditRowProps,
} from '../../../src/shared/components/common/InlineEditRow/InlineEditRow';

// --- Mocks ---

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    rightArrow: {uri: 'right-arrow-png'},
  },
}));

// Mock useTheme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: '#333333',
        textSecondary: '#666666',
        background: '#ffffff',
        white: '#ffffff',
        text: '#000000',
      },
      spacing: {
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
      },
      typography: {
        paragraphBold: {fontWeight: 'bold'},
        bodySmall: {fontSize: 12},
      },
    },
  }),
}));

// Mock Child Components
jest.mock('@/shared/components/common/Input/Input', () => {
  const {TextInput} = require('react-native');
  return {
    Input: (props: any) => (
      <TextInput
        testID="mock-input"
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
      />
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return (props: any) => (
      <TouchableOpacity testID={`btn-${props.title}`} onPress={props.onPress}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
);

describe('InlineEditRow Component', () => {
  const defaultProps: InlineEditRowProps = {
    label: 'Email',
    value: 'test@example.com',
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic (View Mode)
  // ===========================================================================

  it('renders correctly in view mode with a value', () => {
    const {getByText} = render(<InlineEditRow {...defaultProps} />);
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('renders fallback dash "—" when value is empty', () => {
    const {getByText} = render(<InlineEditRow {...defaultProps} value="" />);
    expect(getByText('—')).toBeTruthy();
  });

  it('renders fallback dash "—" when value is whitespace', () => {
    const {getByText} = render(<InlineEditRow {...defaultProps} value="   " />);
    expect(getByText('—')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Interaction & State (Switching to Edit Mode)
  // ===========================================================================

  it('switches to edit mode when pressed', () => {
    const {getByText, getByTestId} = render(
      <InlineEditRow {...defaultProps} />,
    );

    // Press the row (label)
    fireEvent.press(getByText('Email'));

    // Should now show input and buttons
    expect(getByTestId('mock-input')).toBeTruthy();
    expect(getByTestId('btn-Save')).toBeTruthy();
    expect(getByTestId('btn-Cancel')).toBeTruthy();
  });

  // ===========================================================================
  // 3. Edit Mode Logic (Save & Cancel)
  // ===========================================================================

  it('updates temp value and saves correctly', () => {
    const {getByText, getByTestId} = render(
      <InlineEditRow {...defaultProps} />,
    );

    // Enter edit mode
    fireEvent.press(getByText('Email'));

    const input = getByTestId('mock-input');

    // Change text
    fireEvent.changeText(input, 'new@example.com');

    // Press Save
    fireEvent.press(getByTestId('btn-Save'));

    expect(defaultProps.onSave).toHaveBeenCalledWith('new@example.com');

    // Should revert to view mode (we can check by seeing if input is gone or value text returns)
    // Note: Since component is uncontrolled internally for 'editing' state but controlled for 'value' via props,
    // the view mode will show the OLD value until parent updates props.
    // Here we just verify onSave call.
  });

  it('cancels edit and reverts value', () => {
    const {getByText, getByTestId} = render(
      <InlineEditRow {...defaultProps} />,
    );

    // Enter edit mode
    fireEvent.press(getByText('Email'));

    const input = getByTestId('mock-input');

    // Change text (dirty state)
    fireEvent.changeText(input, 'dirty-value');

    // Press Cancel
    fireEvent.press(getByTestId('btn-Cancel'));

    expect(defaultProps.onCancel).toHaveBeenCalled();
    expect(defaultProps.onSave).not.toHaveBeenCalled();

    // Re-enter edit mode to ensure temp state was reset
    fireEvent.press(getByText('Email'));
    const inputReopened = getByTestId('mock-input');
    expect(inputReopened.props.value).toBe('test@example.com'); // Should be original prop value
  });

  it('handles null onCancel gracefully', () => {
    const {getByText, getByTestId} = render(
      <InlineEditRow {...defaultProps} onCancel={undefined} />,
    );

    fireEvent.press(getByText('Email'));
    fireEvent.press(getByTestId('btn-Cancel'));

    // Should not throw error
  });

  // ===========================================================================
  // 4. Props Passing & Initialization
  // ===========================================================================

  it('initializes edit state with prop value even if null/undefined', () => {
    // Force value to undefined to test '??' operator in useState(value ?? '')
    const {getByText, getByTestId} = render(
      // @ts-ignore
      <InlineEditRow {...defaultProps} value={undefined} />,
    );

    fireEvent.press(getByText('Email'));
    const input = getByTestId('mock-input');
    expect(input.props.value).toBe('');
  });

  it('resets temp value correctly when starting edit multiple times', () => {
    const {getByText, getByTestId} = render(
      <InlineEditRow {...defaultProps} />,
    );

    // 1. Edit -> Change -> Save
    fireEvent.press(getByText('Email'));
    fireEvent.changeText(getByTestId('mock-input'), 'change1');
    fireEvent.press(getByTestId('btn-Save'));

    // 2. Edit again (prop value hasn't changed in this test harness)
    // Should reset to original prop value
    fireEvent.press(getByText('Email'));
    const input = getByTestId('mock-input');
    expect(input.props.value).toBe('test@example.com');
  });
});
