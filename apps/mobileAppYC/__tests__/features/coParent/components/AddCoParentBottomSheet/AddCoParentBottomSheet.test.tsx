import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AddCoParentBottomSheet} from '../../../../../src/features/coParent/components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import {View, Text, Button} from 'react-native';

// --- Mocks ---

// 1. Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      spacing: {4: 16}, // Specific value to verify style generation
    },
  }),
}));

// 2. Shared Components
jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const React = require('react');
    const {View, Button} = require('react-native');
    return {
      ConfirmActionBottomSheet: React.forwardRef(
        ({children, primaryButton, containerStyle}: any, ref: any) => (
          <View testID="confirm-sheet" style={containerStyle}>
            {children}
            <Button
              title={primaryButton.label}
              onPress={primaryButton.onPress}
              testID="confirm-btn"
            />
          </View>
        ),
      ),
    };
  },
);

jest.mock(
  '@/shared/components/common/BottomSheetMessage/BottomSheetMessage',
  () => {
    const {Text} = require('react-native');
    // Changed from View to Text so that raw string children are rendered and findable by getByText
    const MockMessage = ({children}: any) => (
      <Text testID="message-container">{children}</Text>
    );
    MockMessage.Highlight = ({children}: any) => (
      <Text testID="highlight">{children}</Text>
    );
    return {BottomSheetMessage: MockMessage};
  },
);

// 3. Custom Logic Hook
const mockHandleConfirm = jest.fn();
jest.mock('@/shared/hooks/useConfirmActionSheetRef', () => ({
  useConfirmActionSheetRef: (_ref: any, onConfirm: any) => ({
    sheetRef: {current: 'mocked-ref'},
    handleConfirm: () => {
      // Simulate the hook calling the onConfirm prop
      if (onConfirm) onConfirm();
    },
  }),
}));

describe('AddCoParentBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with all fields provided', () => {
    const {getByText, getAllByTestId} = render(
      <AddCoParentBottomSheet
        coParentName="John Doe"
        coParentEmail="john@example.com"
        coParentPhone="1234567890"
      />,
    );

    // Verify static text parts
    expect(getByText(/We have sent a request to/)).toBeTruthy();
    expect(getByText(/ as a co-parent./)).toBeTruthy();

    // Verify conditional text parts
    expect(getByText(/ at /)).toBeTruthy();
    expect(getByText(/, mobile number /)).toBeTruthy();

    // Verify highlights
    const highlights = getAllByTestId('highlight');
    expect(highlights).toHaveLength(3);
    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('john@example.com')).toBeTruthy();
    expect(getByText('1234567890')).toBeTruthy();
  });

  it('renders correctly when only name is provided (Branch Coverage)', () => {
    const {getByText, queryByText, getAllByTestId} = render(
      <AddCoParentBottomSheet coParentName="Jane Doe" />,
    );

    expect(getByText('Jane Doe')).toBeTruthy();

    // Verify missing email parts
    expect(queryByText(/ at /)).toBeNull();
    expect(queryByText('john@example.com')).toBeNull();

    // Verify missing phone parts
    expect(queryByText(/, mobile number /)).toBeNull();
    expect(queryByText('1234567890')).toBeNull();

    expect(getAllByTestId('highlight')).toHaveLength(1);
  });

  it('renders correctly when only email is provided (Branch Coverage)', () => {
    const {getByText, queryByText} = render(
      <AddCoParentBottomSheet coParentEmail="jane@example.com" />,
    );

    // Name highlight should be null

    expect(getByText(/ at /)).toBeTruthy();
    expect(getByText('jane@example.com')).toBeTruthy();

    expect(queryByText(/, mobile number /)).toBeNull();
  });

  it('renders correctly when only phone is provided (Branch Coverage)', () => {
    const {getByText, queryByText} = render(
      <AddCoParentBottomSheet coParentPhone="9876543210" />,
    );

    expect(queryByText(/ at /)).toBeNull();

    expect(getByText(/, mobile number /)).toBeTruthy();
    expect(getByText('9876543210')).toBeTruthy();
  });

  it('triggers onConfirm when primary button is pressed', () => {
    const onConfirmMock = jest.fn();
    const {getByTestId} = render(
      <AddCoParentBottomSheet onConfirm={onConfirmMock} />,
    );

    fireEvent.press(getByTestId('confirm-btn'));
    expect(onConfirmMock).toHaveBeenCalled();
  });

  it('applies correct container styles from theme', () => {
    const {getByTestId} = render(<AddCoParentBottomSheet />);

    const sheet = getByTestId('confirm-sheet');
    // Check if style prop matches what createStyles produces
    // theme.spacing[4] was mocked as 16
    expect(sheet.props.style).toEqual({gap: 16});
  });
});
