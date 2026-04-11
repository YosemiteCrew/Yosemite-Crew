import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen} from '@testing-library/react-native';
import NotifyBusinessBottomSheet from '../../../../src/features/linkedBusinesses/components/NotifyBusinessBottomSheet';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Mock the custom hook
jest.mock('@/shared/hooks/useConfirmActionSheetRef', () => ({
  useConfirmActionSheetRef: (_ref: any, onConfirm: any) => {
    return {
      sheetRef: {current: {}},
      handleConfirm: onConfirm || jest.fn(),
    };
  },
}));

// Mock the container sheet
jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');

    // FIX: Alias to avoid shadowing top-level React
    const ReactMock = require('react');
    return {
      ConfirmActionBottomSheet: ReactMock.forwardRef(
        ({title, children, primaryButton}: any, _ref: any) => (
          <View testID="confirm-sheet">
            <Text testID="sheet-title">{title}</Text>
            {children}
            <TouchableOpacity
              testID="btn-primary"
              onPress={primaryButton?.onPress}>
              <Text>{primaryButton?.label}</Text>
            </TouchableOpacity>
          </View>
        ),
      ),
    };
  },
);

// Mock the message component
jest.mock(
  '@/shared/components/common/BottomSheetMessage/BottomSheetMessage',
  () => {
    const {Text} = require('react-native');
    const MockMessage = ({children}: any) => (
      <Text testID="sheet-message">{children}</Text>
    );
    MockMessage.Highlight = ({children}: any) => (
      <Text testID="message-highlight">{children}</Text>
    );
    return {BottomSheetMessage: MockMessage};
  },
);

describe('NotifyBusinessBottomSheet', () => {
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with full details', () => {
    render(
      <NotifyBusinessBottomSheet
        businessName="Acme Corp"
        companionName="Buddy"
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByTestId('btn-primary')).toHaveTextContent('Okay');

    expect(screen.getByTestId('sheet-message')).toHaveTextContent(
      /Yosemite Crew have sent an Invite to/,
    );

    const highlights = screen.getAllByTestId('message-highlight');
    expect(highlights[0]).toHaveTextContent('Acme Corp');
    expect(highlights[1]).toHaveTextContent('Buddy');
  });

  it('renders correctly without optional names (partial props)', () => {
    render(<NotifyBusinessBottomSheet onConfirm={mockOnConfirm} />);
    expect(screen.getByTestId('sheet-message')).toHaveTextContent(
      /Yosemite Crew have sent an Invite to/,
    );

    expect(screen.queryByTestId('message-highlight')).toBeNull();
  });

  it('calls onConfirm when primary button is pressed', () => {
    render(
      <NotifyBusinessBottomSheet
        businessName="Test Biz"
        onConfirm={mockOnConfirm}
      />,
    );

    const btn = screen.getByTestId('btn-primary');
    fireEvent.press(btn);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });
});
