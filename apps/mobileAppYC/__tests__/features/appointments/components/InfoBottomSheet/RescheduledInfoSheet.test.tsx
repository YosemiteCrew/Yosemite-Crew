import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {RescheduledInfoSheet} from '@/features/appointments/components/InfoBottomSheet/RescheduledInfoSheet';

const mockInfoBottomSheet = jest.fn();
jest.mock(
  '@/features/appointments/components/InfoBottomSheet/InfoBottomSheet',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      __esModule: true,
      default: (props: any) => {
        mockInfoBottomSheet(props);
        return (
          <TouchableOpacity testID="cta-button" onPress={props.onCta}>
            <Text>{props.title}</Text>
          </TouchableOpacity>
        );
      },
    };
  },
);

describe('RescheduledInfoSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the rescheduled title, message, and cta text', () => {
    const {getByText} = render(<RescheduledInfoSheet />);
    expect(getByText('Appointment rescheduled')).toBeTruthy();
    expect(mockInfoBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Appointment rescheduled',
        message:
          'We will notify you once the organisation accepts your request.',
        cta: 'Close',
      }),
    );
  });

  it('calls onClose when the cta is pressed', () => {
    const onClose = jest.fn();
    const {getByTestId} = render(<RescheduledInfoSheet onClose={onClose} />);
    fireEvent.press(getByTestId('cta-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the cta is pressed without an onClose handler', () => {
    const {getByTestId} = render(<RescheduledInfoSheet />);
    expect(() => fireEvent.press(getByTestId('cta-button'))).not.toThrow();
  });
});
