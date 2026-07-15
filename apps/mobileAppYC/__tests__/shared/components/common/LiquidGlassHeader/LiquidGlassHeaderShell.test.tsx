import React from 'react';
import {render} from '@testing-library/react-native';
import {LiquidGlassHeaderShell} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderShell';

const mockLiquidGlassHeader = jest.fn();
jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeader: (props: any) => {
        mockLiquidGlassHeader(props);
        return <View testID="liquid-glass-header">{props.children}</View>;
      },
    };
  },
);

const mockBottomFadeOverlay = jest.fn();
jest.mock(
  '@/shared/components/common/BottomFadeOverlay/BottomFadeOverlay',
  () => {
    const {View} = require('react-native');
    return {
      BottomFadeOverlay: (props: any) => {
        mockBottomFadeOverlay(props);
        return <View testID="bottom-fade-overlay" />;
      },
    };
  },
);

const mockUseLiquidGlassHeaderLayout = jest.fn();
jest.mock('@/shared/hooks/useLiquidGlassHeaderLayout', () => ({
  useLiquidGlassHeaderLayout: (...args: any[]) =>
    mockUseLiquidGlassHeaderLayout(...args),
}));

describe('LiquidGlassHeaderShell', () => {
  const {Text} = require('react-native');
  const headerProps = {insetsTop: 10, currentHeight: 50};

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLiquidGlassHeaderLayout.mockReturnValue({
      headerProps,
      contentPaddingStyle: {paddingTop: 60},
    });
  });

  it('renders the header inside LiquidGlassHeader with layout-derived headerProps', () => {
    const {getByText} = render(
      <LiquidGlassHeaderShell header={<Text>My Header</Text>}>
        {() => <Text>Body</Text>}
      </LiquidGlassHeaderShell>,
    );

    expect(getByText('My Header')).toBeTruthy();
    expect(mockLiquidGlassHeader).toHaveBeenCalledWith(
      expect.objectContaining(headerProps),
    );
  });

  it('passes contentPaddingStyle through to the children render prop', () => {
    const childrenFn = jest.fn(() => <Text>Body</Text>);
    render(
      <LiquidGlassHeaderShell header={null}>
        {childrenFn}
      </LiquidGlassHeaderShell>,
    );

    expect(childrenFn).toHaveBeenCalledWith({paddingTop: 60});
  });

  it('forwards contentPadding and cardGap to the layout hook', () => {
    render(
      <LiquidGlassHeaderShell header={null} contentPadding={16} cardGap={8}>
        {() => <Text>Body</Text>}
      </LiquidGlassHeaderShell>,
    );

    expect(mockUseLiquidGlassHeaderLayout).toHaveBeenCalledWith({
      contentPadding: 16,
      cardGap: 8,
    });
  });

  it('does not render the bottom fade overlay by default', () => {
    const {queryByTestId} = render(
      <LiquidGlassHeaderShell header={null}>
        {() => <Text>Body</Text>}
      </LiquidGlassHeaderShell>,
    );

    expect(queryByTestId('bottom-fade-overlay')).toBeNull();
  });

  it('renders the bottom fade overlay with defaults when showBottomFade is true', () => {
    const {getByTestId} = render(
      <LiquidGlassHeaderShell header={null} showBottomFade>
        {() => <Text>Body</Text>}
      </LiquidGlassHeaderShell>,
    );

    expect(getByTestId('bottom-fade-overlay')).toBeTruthy();
    expect(mockBottomFadeOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 80,
        intensity: 'medium',
        bottomOffset: 0,
      }),
    );
  });

  it('renders the bottom fade overlay with custom height, intensity, and offset', () => {
    render(
      <LiquidGlassHeaderShell
        header={null}
        showBottomFade
        bottomFadeHeight={120}
        bottomFadeIntensity="strong"
        bottomFadeOffset={10}>
        {() => <Text>Body</Text>}
      </LiquidGlassHeaderShell>,
    );

    expect(mockBottomFadeOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 120,
        intensity: 'strong',
        bottomOffset: 10,
      }),
    );
  });
});
