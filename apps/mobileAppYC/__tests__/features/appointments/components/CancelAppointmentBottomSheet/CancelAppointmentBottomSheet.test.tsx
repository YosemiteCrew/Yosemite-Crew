import React from 'react';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import CancelAppointmentBottomSheet, {
  type CancelAppointmentBottomSheetRef,
} from '@/features/appointments/components/CancelAppointmentBottomSheet/CancelAppointmentBottomSheet';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();
let lastConfirmSheetProps: any = null;

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const ReactMock = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      __esModule: true,
      default: ReactMock.forwardRef((props: any, ref: any) => {
        lastConfirmSheetProps = props;
        ReactMock.useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));
        return (
          <View testID="confirm-sheet">
            <Text testID="sheet-title">{props.title}</Text>
            <Text testID="sheet-message">{props.message}</Text>
            <TouchableOpacity
              testID="primary-btn"
              disabled={props.primaryButton.disabled}
              onPress={props.primaryButton.onPress}>
              <Text>{props.primaryButton.label}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="secondary-btn"
              disabled={props.secondaryButton?.disabled}
              onPress={props.secondaryButton?.onPress}>
              <Text>{props.secondaryButton?.label}</Text>
            </TouchableOpacity>
          </View>
        );
      }),
    };
  },
);

describe('CancelAppointmentBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastConfirmSheetProps = null;
  });

  it('renders default title, message and button labels', () => {
    render(<CancelAppointmentBottomSheet onConfirm={jest.fn()} />);

    expect(screen.getByTestId('sheet-title').props.children).toBe(
      'Cancel appointment',
    );
    expect(screen.getByTestId('sheet-message').props.children).toBe(
      'Are you sure you want to cancel this appointment?',
    );
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Keep')).toBeTruthy();
  });

  it('renders custom title, message and button labels when provided', () => {
    render(
      <CancelAppointmentBottomSheet
        onConfirm={jest.fn()}
        title="Custom title"
        message="Custom message"
        confirmLabel="Yes"
        cancelLabel="No"
      />,
    );

    expect(screen.getByTestId('sheet-title').props.children).toBe(
      'Custom title',
    );
    expect(screen.getByTestId('sheet-message').props.children).toBe(
      'Custom message',
    );
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
  });

  it('confirms successfully, shows loading state, and closes the sheet', async () => {
    let resolveConfirm: () => void;
    const onConfirm = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveConfirm = resolve;
        }),
    );

    render(<CancelAppointmentBottomSheet onConfirm={onConfirm} />);

    let pressPromise: Promise<void>;
    act(() => {
      pressPromise = fireEvent.press(screen.getByTestId('primary-btn')) as any;
    });

    expect(lastConfirmSheetProps.primaryButton.loading).toBe(true);
    expect(lastConfirmSheetProps.primaryButton.label).toBe('Cancelling...');

    await act(async () => {
      resolveConfirm!();
      await pressPromise!;
    });

    expect(onConfirm).toHaveBeenCalled();
    expect(mockSheetClose).toHaveBeenCalled();
    expect(lastConfirmSheetProps.primaryButton.loading).toBe(false);
    expect(lastConfirmSheetProps.primaryButton.label).toBe('Cancel');
  });

  it('logs a warning and does not close the sheet when onConfirm rejects', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onConfirm = jest.fn(() => Promise.reject(new Error('failed')));

    render(<CancelAppointmentBottomSheet onConfirm={onConfirm} />);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('primary-btn'));
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[CancelAppointmentBottomSheet] confirm failed',
      expect.any(Error),
    );
    expect(mockSheetClose).not.toHaveBeenCalled();
    expect(lastConfirmSheetProps.primaryButton.loading).toBe(false);

    warnSpy.mockRestore();
  });

  it('calls onCancel and closes the sheet when the secondary button is pressed', () => {
    const onCancel = jest.fn();
    render(
      <CancelAppointmentBottomSheet
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.press(screen.getByTestId('secondary-btn'));

    expect(onCancel).toHaveBeenCalled();
    expect(mockSheetClose).toHaveBeenCalled();
  });

  it('closes the sheet on cancel even without an onCancel handler', () => {
    render(<CancelAppointmentBottomSheet onConfirm={jest.fn()} />);

    expect(() =>
      fireEvent.press(screen.getByTestId('secondary-btn')),
    ).not.toThrow();
    expect(mockSheetClose).toHaveBeenCalled();
  });

  it('forwards open/close through the exposed ref', () => {
    const ref = React.createRef<CancelAppointmentBottomSheetRef>();
    render(<CancelAppointmentBottomSheet ref={ref} onConfirm={jest.fn()} />);

    ref.current?.open();
    expect(mockSheetOpen).toHaveBeenCalled();

    ref.current?.close();
    expect(mockSheetClose).toHaveBeenCalled();
  });
});
