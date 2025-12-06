import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {AddBusinessBottomSheet} from '../../../../src/features/linkedBusinesses/components/AddBusinessBottomSheet';

// --- Mocks ---

// Mock useTheme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: 'white',
      },
      spacing: {
        4: 16,
      },
    },
  }),
}));

// Mock ConfirmActionBottomSheet
jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    // FIX: Require React inside the factory and use the variable 'React' consistently
    const React = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');

    return {
      ConfirmActionBottomSheet: React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));
        return (
          <View testID="confirm-sheet">
            <Text>{props.title}</Text>
            {props.children}
            {props.primaryButton && (
              <TouchableOpacity
                onPress={props.primaryButton.onPress}
                testID="primary-button">
                <Text>{props.primaryButton.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }),
    };
  },
);

// Mock BottomSheetMessage components
jest.mock(
  '@/shared/components/common/BottomSheetMessage/BottomSheetMessage',
  () => {
    // Ideally require React here too for JSX support in strict environments
    const React = require('react');
    const {Text} = require('react-native');

    const MockMessage = (props: any) => (
      <Text testID="bottom-sheet-message">{props.children}</Text>
    );
    MockMessage.Highlight = (props: any) => (
      <Text testID="highlight-text">{props.children}</Text>
    );
    return {
      BottomSheetMessage: MockMessage,
    };
  },
);

// Mock useConfirmActionSheetRef
const mockHandleConfirm = jest.fn();
const mockSheetRef = {current: {open: jest.fn(), close: jest.fn()}};

jest.mock('@/shared/hooks/useConfirmActionSheetRef', () => ({
  useConfirmActionSheetRef: (ref: any, onConfirm: any) => {
    // If onConfirm is passed, we can simulate the hook behavior
    return {
      sheetRef: mockSheetRef,
      handleConfirm: onConfirm || mockHandleConfirm,
    };
  },
}));

describe('AddBusinessBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with name and address', () => {
    render(
      <AddBusinessBottomSheet
        businessName="Test Business"
        businessAddress="123 Test St"
      />,
    );

    expect(screen.getByTestId('confirm-sheet')).toBeTruthy();
    expect(screen.getByText('Business Added')).toBeTruthy();

    // Check for highlighted text parts
    const highlights = screen.getAllByTestId('highlight-text');
    expect(highlights[0]).toHaveTextContent('Test Business');
    expect(highlights[1]).toHaveTextContent('123 Test St');

    // Check surrounding text logic
    expect(screen.getByTestId('bottom-sheet-message')).toBeTruthy();
  });

  it('renders correctly without name or address', () => {
    render(<AddBusinessBottomSheet />);

    // Should render, but highlights shouldn't be present
    const highlights = screen.queryAllByTestId('highlight-text');
    expect(highlights.length).toBe(0);

    expect(screen.getByText('Business Added')).toBeTruthy();
  });

  it('calls onConfirm when primary button is pressed', () => {
    const onConfirmMock = jest.fn();
    render(<AddBusinessBottomSheet onConfirm={onConfirmMock} />);

    const button = screen.getByTestId('primary-button');
    fireEvent.press(button);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('forwards ref methods (implicit via useConfirmActionSheetRef mock)', () => {
    const ref = React.createRef<any>();
    render(<AddBusinessBottomSheet ref={ref} />);

    // The component renders ConfirmActionBottomSheet with the ref returned by the hook.
    expect(screen.getByTestId('confirm-sheet')).toBeDefined();
  });
});
