import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {BookedInfoSheet} from '@/features/appointments/components/InfoBottomSheet/BookedInfoSheet';

jest.mock(
  '@/features/appointments/components/InfoBottomSheet/InfoBottomSheet',
  () => {
    const {View, Text, Button} = require('react-native');
    return {
      __esModule: true,
      default: ({title, message, cta, onCta, ref}: any) => (
        <View testID="info-bottom-sheet" ref={ref}>
          <Text testID="title">{title}</Text>
          <Text testID="message">{message}</Text>
          <Button title={cta} onPress={() => onCta?.()} testID="cta-btn" />
        </View>
      ),
    };
  },
);

describe('BookedInfoSheet', () => {
  it('renders the booked title, message and cta via InfoBottomSheet', () => {
    const {getByTestId, getByText} = render(<BookedInfoSheet />);

    expect(getByTestId('title').props.children).toBe('Appointment booked');
    expect(getByTestId('message').props.children).toBe(
      'We will notify you once the organisation accepts your request.',
    );
    expect(getByText('Close')).toBeTruthy();
  });

  it('calls onClose when the cta is pressed', () => {
    const onClose = jest.fn();
    const {getByTestId} = render(<BookedInfoSheet onClose={onClose} />);

    fireEvent.press(getByTestId('cta-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not throw when pressed without an onClose handler', () => {
    const {getByTestId} = render(<BookedInfoSheet />);

    expect(() => fireEvent.press(getByTestId('cta-btn'))).not.toThrow();
  });

  it('forwards the ref through to InfoBottomSheet', () => {
    const ref = React.createRef<any>();
    render(<BookedInfoSheet ref={ref} />);

    expect(ref.current).toBeTruthy();
  });
});
