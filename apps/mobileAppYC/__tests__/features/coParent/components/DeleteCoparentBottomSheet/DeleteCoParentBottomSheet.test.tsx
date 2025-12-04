import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  DeleteCoParentBottomSheet,
  DeleteCoParentBottomSheetRef,
} from '../../../../../src/features/coParent/components/DeleteCoParentBottomSheet/DeleteCoParentBottomSheet';

// --- Mocks ---

const mockInternalOpen = jest.fn();
const mockInternalClose = jest.fn();

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    // FIX: Use ReactMock to avoid shadowing top-level React
    const ReactMock = require('react');
    const {View, Button, Text} = require('react-native');

    return {
      ConfirmActionBottomSheet: ReactMock.forwardRef(
        ({title, message, primaryButton, secondaryButton}: any, ref: any) => {
          ReactMock.useImperativeHandle(ref, () => ({
            open: mockInternalOpen,
            close: mockInternalClose,
          }));

          return (
            <View testID="confirm-sheet">
              <Text>{title}</Text>
              <Text>{message}</Text>
              <Button
                title={primaryButton.label}
                onPress={primaryButton.onPress}
                testID="primary-btn"
              />
              <Button
                title={secondaryButton.label}
                onPress={secondaryButton.onPress}
                testID="secondary-btn"
              />
            </View>
          );
        },
      ),
    };
  },
);

describe('DeleteCoParentBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with name', () => {
    const {getByText} = render(
      <DeleteCoParentBottomSheet coParentName="John Doe" />,
    );
    expect(getByText('Delete Co-Parent?')).toBeTruthy();
    expect(
      getByText('Are you sure you want to delete John Doe as co-parent?'),
    ).toBeTruthy();
  });

  it('exposes open and close methods via ref', () => {
    const ref = React.createRef<DeleteCoParentBottomSheetRef>();
    render(<DeleteCoParentBottomSheet ref={ref} />);

    act(() => {
      ref.current?.open();
    });
    expect(mockInternalOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockInternalClose).toHaveBeenCalledTimes(1);
  });

  it('handles Delete action: closes sheet and calls onDelete', () => {
    const onDelete = jest.fn();
    const {getByTestId} = render(
      <DeleteCoParentBottomSheet onDelete={onDelete} />,
    );
    fireEvent.press(getByTestId('primary-btn'));
    expect(mockInternalClose).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('handles Cancel action: closes sheet and calls onCancel', () => {
    const onCancel = jest.fn();
    const {getByTestId} = render(
      <DeleteCoParentBottomSheet onCancel={onCancel} />,
    );
    fireEvent.press(getByTestId('secondary-btn'));
    expect(mockInternalClose).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('handles undefined callbacks safely (Branch Coverage)', () => {
    const {getByTestId} = render(<DeleteCoParentBottomSheet />);
    fireEvent.press(getByTestId('primary-btn'));
    expect(mockInternalClose).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('secondary-btn'));
    expect(mockInternalClose).toHaveBeenCalledTimes(2);
  });
});
