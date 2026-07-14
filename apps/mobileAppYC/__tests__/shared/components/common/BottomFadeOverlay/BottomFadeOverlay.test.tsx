import React from 'react';
import {render, screen} from '@testing-library/react-native';
import LinearGradient from 'react-native-linear-gradient';
import {mockTheme} from '../../../../setup/mockTheme';
import {BottomFadeOverlay} from '@/shared/components/common/BottomFadeOverlay/BottomFadeOverlay';

const LinearGradientType = (LinearGradient as any).type ?? LinearGradient;

let mockThemeOverride: any = mockTheme;

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockThemeOverride, isDark: false}),
}));

describe('BottomFadeOverlay', () => {
  beforeEach(() => {
    mockThemeOverride = mockTheme;
  });

  it('renders a gradient fading from transparent to the theme background at medium intensity', () => {
    render(<BottomFadeOverlay />);

    const gradient = screen.UNSAFE_getByType(LinearGradientType);
    expect(gradient.props.colors).toEqual([
      'rgba(255, 254, 254, 0)',
      'rgba(255, 254, 254, 0.65)',
      'rgb(255, 254, 254)',
    ]);
    expect(gradient.props.locations).toEqual([0, 0.4, 1]);
  });

  it('uses a lighter mid-opacity when intensity is "light"', () => {
    render(<BottomFadeOverlay intensity="light" />);
    const gradient = screen.UNSAFE_getByType(LinearGradientType);
    expect(gradient.props.colors[1]).toBe('rgba(255, 254, 254, 0.4)');
  });

  it('uses a stronger mid-opacity when intensity is "strong"', () => {
    render(<BottomFadeOverlay intensity="strong" />);
    const gradient = screen.UNSAFE_getByType(LinearGradientType);
    expect(gradient.props.colors[1]).toBe('rgba(255, 254, 254, 0.85)');
  });

  it('applies the custom height and bottomOffset to the container style', () => {
    const {toJSON} = render(
      <BottomFadeOverlay height={120} bottomOffset={24} />,
    );
    const tree = toJSON();
    const containerStyle = Array.isArray(tree?.props?.style)
      ? Object.assign({}, ...tree!.props.style)
      : tree?.props?.style;
    expect(containerStyle).toEqual(
      expect.objectContaining({height: 120, bottom: 24}),
    );
  });

  it('defaults height to 80 and bottomOffset to 0 when not provided', () => {
    const {toJSON} = render(<BottomFadeOverlay />);
    const tree = toJSON();
    const containerStyle = Array.isArray(tree?.props?.style)
      ? Object.assign({}, ...tree!.props.style)
      : tree?.props?.style;
    expect(containerStyle).toEqual(
      expect.objectContaining({height: 80, bottom: 0}),
    );
  });

  it('passes rgba/rgb colors through unchanged when the theme background is not a hex string', () => {
    mockThemeOverride = {
      ...mockTheme,
      colors: {...mockTheme.colors, background: 'rgb(10, 20, 30)'},
    };

    render(<BottomFadeOverlay />);
    const gradient = screen.UNSAFE_getByType(LinearGradientType);
    expect(gradient.props.colors).toEqual([
      'rgba(10, 20, 30, 0)',
      'rgba(10, 20, 30, 0.65)',
      'rgb(10, 20, 30)',
    ]);
  });

  it('is not interactive, allowing touches to pass through', () => {
    const {toJSON} = render(<BottomFadeOverlay />);
    const tree = toJSON();
    expect(tree?.props?.pointerEvents).toBe('none');
  });
});
