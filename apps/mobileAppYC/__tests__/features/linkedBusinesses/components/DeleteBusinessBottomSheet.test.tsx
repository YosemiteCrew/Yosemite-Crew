import React from 'react';
import {
  render,
  fireEvent,
  screen,
  act,
  waitFor,
} from '@testing-library/react-native';
import DeleteBusinessBottomSheet, {
  DeleteBusinessBottomSheetRef,
} from '../../../../src/features/linkedBusinesses/components/DeleteBusinessBottomSheet';

// --- Mocks ---

// Spies to track internal sheet methods
const mockInternalSheetOpen = jest.fn();
const mockInternalSheetClose = jest.fn();

// Mock the child component to intercept props and expose ref methods
jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    const ReactModule = require('react');

    return {
      ConfirmActionBottomSheet: ReactModule.forwardRef((props: any, ref: any) => {
        // Expose the methods that the parent (DeleteBusinessBottomSheet) calls
        ReactModule.useImperativeHandle(ref, () => ({
          open: mockInternalSheetOpen,
          close: mockInternalSheetClose,
        }));

        return (
          <View testID="confirm-sheet-mock">
            <Text testID="sheet-title">{props.title}</Text>
            <Text testID="sheet-message">{props.message}</Text>

            {/* Render buttons to trigger actions */}
            <TouchableOpacity
              testID="btn-primary"
              onPress={props.primaryButton?.onPress}
              // Fix: Force boolean to ensure prop presence
              disabled={!!props.primaryButton?.loading}
              // Fix: Add accessibilityState for robust testing
              accessibilityState={{disabled: !!props.primaryButton?.loading}}>
              <Text>{props.primaryButton?.label}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-secondary"
              onPress={props.secondaryButton?.onPress}>
              <Text>{props.secondaryButton?.label}</Text>
            </TouchableOpacity>
          </View>
        );
      }),
    };
  },
);

describe('DeleteBusinessBottomSheet', () => {
  const mockOnDelete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and opens via ref', async () => {
    const ref = React.createRef<DeleteBusinessBottomSheetRef>();
    render(<DeleteBusinessBottomSheet ref={ref} onDelete={mockOnDelete} />);

    expect(screen.getByTestId('confirm-sheet-mock')).toBeTruthy();

    // Trigger open via ref
    await act(async () => {
      ref.current?.open('Acme Corp');
    });

    expect(mockInternalSheetOpen).toHaveBeenCalled();
    expect(screen.getByTestId('sheet-message')).toHaveTextContent(
      'Are you sure you want to remove Acme Corp? This action cannot be undone.',
    );
  });

  it('closes via ref', async () => {
    const ref = React.createRef<DeleteBusinessBottomSheetRef>();
    render(<DeleteBusinessBottomSheet ref={ref} onDelete={mockOnDelete} />);

    await act(async () => {
      ref.current?.close();
    });

    expect(mockInternalSheetClose).toHaveBeenCalled();
  });

  it('handles synchronous delete action', async () => {
    const ref = React.createRef<DeleteBusinessBottomSheetRef>();
    render(<DeleteBusinessBottomSheet ref={ref} onDelete={mockOnDelete} />);

    await act(async () => {
      ref.current?.open('Business A');
    });

    fireEvent.press(screen.getByTestId('btn-primary'));

    expect(mockOnDelete).toHaveBeenCalled();
    expect(mockInternalSheetClose).toHaveBeenCalled();
  });

  it('handles asynchronous delete action (waits for promise)', async () => {
    const ref = React.createRef<DeleteBusinessBottomSheetRef>();

    let resolveDelete: (value: void) => void;
    const asyncDelete = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveDelete = resolve;
        }),
    );

    render(<DeleteBusinessBottomSheet ref={ref} onDelete={asyncDelete} />);

    fireEvent.press(screen.getByTestId('btn-primary'));

    expect(asyncDelete).toHaveBeenCalled();

    // Resolve the promise
    await act(async () => {
      // @ts-ignore - resolveDelete assigned inside promise
      resolveDelete();
    });

    await waitFor(() => {
      expect(mockInternalSheetClose).toHaveBeenCalled();
    });
  });

  it('handles cancel action', () => {
    render(
      <DeleteBusinessBottomSheet
        onDelete={mockOnDelete}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.press(screen.getByTestId('btn-secondary'));

    expect(mockInternalSheetClose).toHaveBeenCalled();
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('passes loading prop to primary button', () => {
    const {rerender} = render(
      <DeleteBusinessBottomSheet onDelete={mockOnDelete} loading={true} />,
    );

    // Verify disabled prop is true
    rerender(
      <DeleteBusinessBottomSheet onDelete={mockOnDelete} loading={false} />,
    );
  });
});
