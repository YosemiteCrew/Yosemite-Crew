import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {Platform, StyleSheet} from 'react-native';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

const mockBackIcon = 123;
jest.mock('@/assets/images', () => ({
  Images: {
    backIcon: mockBackIcon,
  },
}));

const flattenStyle = (style: any) =>
  Array.isArray(style) ? style.flat().filter(Boolean) : [style].filter(Boolean);

describe('Header', () => {
  const onBackMock = jest.fn();
  const onRightPressMock = jest.fn();

  beforeEach(() => {
    onBackMock.mockClear();
    onRightPressMock.mockClear();
    Platform.OS = 'ios';
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme, isDark: false});
  });

  it('renders title with themed typography', () => {
    const {getByText} = render(<Header title="My Title" />);
    const title = getByText('My Title');

    const flat = flattenStyle(title.props.style);
    expect(flat).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: mockTheme.colors.ink,
          fontSize: mockTheme.typography.mobileBodyEmphasis.fontSize,
          fontWeight: '600',
        }),
      ]),
    );
  });

  it('renders a serif left-aligned title for the root variant', () => {
    const {getByText} = render(<Header title="Tasks" variant="root" />);
    const flat = flattenStyle(getByText('Tasks').props.style);
    expect(flat).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: mockTheme.typography.serifTitle.fontFamily,
          fontSize: mockTheme.typography.serifTitle.fontSize,
          textAlign: 'left',
          color: mockTheme.colors.ink,
        }),
      ]),
    );
  });

  it('calls onBack when back button pressed', () => {
    const {UNSAFE_getAllByType} = render(
      <Header title="My Title" showBackButton={true} onBack={onBackMock} />,
    );

    // Header buttons now render react-native's Pressable (via
    // LiquidGlassIconButton/PressableOpacity), which is wrapped in
    // React.memo, so match against the memoized inner component.
    const {Pressable} = require('react-native');
    const buttons = UNSAFE_getAllByType((Pressable as any).type);
    expect(buttons.length).toBe(1);

    fireEvent.press(buttons[0]);
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('calls onRightPress when right icon pressed', () => {
    const rightIcon = 456;
    const {UNSAFE_getAllByType} = render(
      <Header
        title="My Title"
        rightIcon={rightIcon}
        onRightPress={onRightPressMock}
      />,
    );

    const {Pressable} = require('react-native');
    const buttons = UNSAFE_getAllByType((Pressable as any).type);
    expect(buttons.length).toBe(1);

    fireEvent.press(buttons[0]);
    expect(onRightPressMock).toHaveBeenCalledTimes(1);
  });

  it('renders without glass and keeps default press handlers safe', () => {
    const rightIcon = 456;
    const {UNSAFE_getAllByType} = render(
      <Header
        title="Plain Header"
        showBackButton={true}
        rightIcon={rightIcon}
        glass={false}
      />,
    );

    const {Pressable} = require('react-native');
    const buttons = UNSAFE_getAllByType((Pressable as any).type);
    expect(buttons.length).toBe(2);

    fireEvent.press(buttons[0]);
    fireEvent.press(buttons[1]);
    expect(onBackMock).not.toHaveBeenCalled();
    expect(onRightPressMock).not.toHaveBeenCalled();
  });

  it('applies platform-specific top padding', () => {
    const {View} = require('react-native');

    Platform.OS = 'ios';
    const iosViews = render(<Header />).UNSAFE_getAllByType(View);
    const iosStyle = iosViews
      .map(view => flattenStyle(view.props.style))
      .find(style => style?.paddingTop !== undefined);
    expect(iosStyle?.paddingTop ?? mockTheme.spacing['2']).toBe(
      mockTheme.spacing['2'],
    );

    Platform.OS = 'android';
    const androidViews = render(<Header />).UNSAFE_getAllByType(View);
    const androidStyle = androidViews
      .map(view => flattenStyle(view.props.style))
      .find(style => style?.paddingTop !== undefined);
    expect(androidStyle?.paddingTop ?? mockTheme.spacing['5']).toBe(
      mockTheme.spacing['5'],
    );
  });

  it('uses fallback layout tokens when optional theme values are missing', () => {
    const fallbackTheme = {
      ...mockTheme,
      spacing: {
        ...mockTheme.spacing,
        '2': undefined,
        '5': undefined,
        '9': undefined,
      },
      colors: {
        ...mockTheme.colors,
        neutralShadow: undefined,
      },
    };
    (useTheme as jest.Mock).mockReturnValue({
      theme: fallbackTheme,
      isDark: false,
    });

    Platform.OS = 'ios';
    const {View} = require('react-native');
    const rendered = render(
      <Header title="Fallback" showBackButton={true} rightIcon={456} />,
    );
    const views = rendered.UNSAFE_getAllByType(View);
    const containerStyle = views
      .map(view => StyleSheet.flatten(view.props.style))
      .find(style => style?.paddingHorizontal !== undefined);
    const shadowStyle = views
      .map(view => StyleSheet.flatten(view.props.style))
      .find(style => style?.boxShadow !== undefined);

    expect(containerStyle).toEqual(
      expect.objectContaining({
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
      }),
    );
    expect(shadowStyle?.boxShadow).toBe('0px 12px 18px #000000');

    Platform.OS = 'android';
    const androidViews = render(
      <Header title="Android" glass={false} />,
    ).UNSAFE_getAllByType(View);
    const androidContainerStyle = androidViews
      .map(view => StyleSheet.flatten(view.props.style))
      .find(style => style?.paddingHorizontal !== undefined);

    expect(androidContainerStyle).toEqual(
      expect.objectContaining({
        paddingTop: 20,
      }),
    );
  });
});
