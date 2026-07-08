import React from 'react';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import InfoBottomSheet from '@/features/appointments/components/InfoBottomSheet/InfoBottomSheet';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

let lastBottomSheetProps: any = null;

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactMock = require('react');
  const {View} = require('react-native');
  return ReactMock.forwardRef((props: any, ref: any) => {
    lastBottomSheetProps = props;
    ReactMock.useImperativeHandle(ref, () => ({
      open: jest.fn(),
      close: jest.fn(),
    }));
    return <View testID="bottom-sheet">{props.children}</View>;
  });
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress}: any) => (
        <TouchableOpacity testID="cta-btn" onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

describe('InfoBottomSheet', () => {
  beforeEach(() => {
    lastBottomSheetProps = null;
  });

  it('renders the title and message', () => {
    render(<InfoBottomSheet title="Some title" message="Some message" />);
    expect(screen.getByText('Some title')).toBeTruthy();
    expect(screen.getByText('Some message')).toBeTruthy();
  });

  it('defaults the cta label to "Close"', () => {
    render(<InfoBottomSheet title="T" message="M" />);
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('renders a custom cta label when provided', () => {
    render(<InfoBottomSheet title="T" message="M" cta="Got it" />);
    expect(screen.getByText('Got it')).toBeTruthy();
  });

  it('calls onCta when the button is pressed', () => {
    const onCta = jest.fn();
    render(<InfoBottomSheet title="T" message="M" onCta={onCta} />);
    fireEvent.press(screen.getByTestId('cta-btn'));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('does not throw when pressed without an onCta handler', () => {
    render(<InfoBottomSheet title="T" message="M" />);
    expect(() => fireEvent.press(screen.getByTestId('cta-btn'))).not.toThrow();
  });

  it('forwards the ref to the underlying BottomSheet', () => {
    const ref = React.createRef<any>();
    render(<InfoBottomSheet ref={ref} title="T" message="M" />);
    expect(ref.current).toBeTruthy();
  });

  it('shows the backdrop once the sheet opens and hides it once closed', () => {
    render(<InfoBottomSheet title="T" message="M" />);

    expect(lastBottomSheetProps.behavior.backdrop).toBe(false);

    act(() => {
      lastBottomSheetProps.onChange(0);
    });
    expect(lastBottomSheetProps.behavior.backdrop).toBe(true);

    act(() => {
      lastBottomSheetProps.onChange(-1);
    });
    expect(lastBottomSheetProps.behavior.backdrop).toBe(false);
  });
});
