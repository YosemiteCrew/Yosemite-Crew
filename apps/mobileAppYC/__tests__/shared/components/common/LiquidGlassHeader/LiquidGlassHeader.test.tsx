import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';

const mockLiquidGlassCard = jest.fn();
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  return {
    LiquidGlassCard: (props: any) => {
      mockLiquidGlassCard(props);
      return <View testID="liquid-glass-card">{props.children}</View>;
    },
  };
});

describe('LiquidGlassHeader', () => {
  const {Text} = require('react-native');

  const baseProps = {
    insetsTop: 20,
    currentHeight: 0,
    onHeightChange: jest.fn(),
    topSectionStyle: {backgroundColor: 'red'},
    cardStyle: {padding: 10},
    fallbackStyle: {padding: 5},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children inside the LiquidGlassCard', () => {
    const {getByText} = render(
      <LiquidGlassHeader {...baseProps}>
        <Text>Header content</Text>
      </LiquidGlassHeader>,
    );
    expect(getByText('Header content')).toBeTruthy();
  });

  it('merges insetsTop into the cardStyle passed to LiquidGlassCard', () => {
    render(
      <LiquidGlassHeader {...baseProps}>
        <Text>Content</Text>
      </LiquidGlassHeader>,
    );

    expect(mockLiquidGlassCard).toHaveBeenCalledWith(
      expect.objectContaining({
        style: [baseProps.cardStyle, {paddingTop: 20}],
        fallbackStyle: baseProps.fallbackStyle,
      }),
    );
  });

  it('calls onHeightChange when the measured layout height differs from currentHeight', () => {
    const onHeightChange = jest.fn();
    const {UNSAFE_root} = render(
      <LiquidGlassHeader
        {...baseProps}
        currentHeight={0}
        onHeightChange={onHeightChange}>
        <Text>Content</Text>
      </LiquidGlassHeader>,
    );

    const outerView = UNSAFE_root.findByProps({
      style: baseProps.topSectionStyle,
    });
    fireEvent(outerView, 'layout', {
      nativeEvent: {layout: {height: 120}},
    });

    expect(onHeightChange).toHaveBeenCalledWith(120);
  });

  it('does not call onHeightChange when the measured layout height matches currentHeight', () => {
    const onHeightChange = jest.fn();
    const {UNSAFE_root} = render(
      <LiquidGlassHeader
        {...baseProps}
        currentHeight={120}
        onHeightChange={onHeightChange}>
        <Text>Content</Text>
      </LiquidGlassHeader>,
    );

    const outerView = UNSAFE_root.findByProps({
      style: baseProps.topSectionStyle,
    });
    fireEvent(outerView, 'layout', {
      nativeEvent: {layout: {height: 120}},
    });

    expect(onHeightChange).not.toHaveBeenCalled();
  });
});
