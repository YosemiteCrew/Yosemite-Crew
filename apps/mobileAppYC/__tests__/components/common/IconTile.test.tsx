import React from 'react';
import {Image, StyleSheet, Text} from 'react-native';
import {render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {
  IconTile,
  type IconTileTone,
} from '../../../src/shared/components/common/IconTile/IconTile';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Numeric ImageSourcePropType ref (require() returns a number in RN).
const ICON = 1 as never;

const tileStyle = (node: {props: {style: unknown}}) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

const iconOf = (node: {findAllByType: (t: unknown) => unknown[]}) =>
  node.findAllByType(Image)[0] as {
    props: {style: unknown; [k: string]: unknown};
  };

describe('IconTile', () => {
  it('renders the icon image with the source and a default contain resize', () => {
    const {getByTestId} = render(<IconTile testID="t" icon={ICON} />);
    const images = getByTestId('t').findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toBe(ICON);
    expect(images[0].props.resizeMode).toBe('contain');
  });

  it('defaults to the neutral tone, rounded shape and md size', () => {
    const {getByTestId} = render(<IconTile testID="t" icon={ICON} />);
    const s = tileStyle(getByTestId('t'));
    expect(s.backgroundColor).toBe(mockTheme.colors.screen2);
    expect(s.borderRadius).toBe(mockTheme.borderRadius.lg);
    expect(s.width).toBe(44);
    expect(s.height).toBe(44);
  });

  it.each([
    ['info', mockTheme.colors.blueSoft],
    ['indigo', mockTheme.colors.indigoSurface],
    ['violet', mockTheme.colors.violetSurface],
    ['success', mockTheme.colors.successSurface],
    ['warning', mockTheme.colors.warningSurface],
    ['danger', mockTheme.colors.dangerSurface],
    ['brand', mockTheme.colors.cardBackground],
    ['neutral', mockTheme.colors.screen2],
  ] as [IconTileTone, string][])(
    'paints the %s tone background',
    (tone, expected) => {
      const {getByTestId} = render(
        <IconTile testID="t" icon={ICON} tone={tone} />,
      );
      expect(tileStyle(getByTestId('t')).backgroundColor).toBe(expected);
    },
  );

  it('lets an explicit backgroundColor override the tone', () => {
    const {getByTestId} = render(
      <IconTile
        testID="t"
        icon={ICON}
        tone="danger"
        backgroundColor="#123456"
      />,
    );
    expect(tileStyle(getByTestId('t')).backgroundColor).toBe('#123456');
  });

  it('renders a full circle when shape is circle', () => {
    const {getByTestId} = render(
      <IconTile testID="t" icon={ICON} shape="circle" />,
    );
    expect(tileStyle(getByTestId('t')).borderRadius).toBe(
      mockTheme.borderRadius.full,
    );
  });

  it.each([
    ['sm', 40],
    ['md', 44],
    ['lg', 48],
  ] as ['sm' | 'md' | 'lg', number][])(
    'maps the %s size preset',
    (size, px) => {
      const {getByTestId} = render(
        <IconTile testID="t" icon={ICON} size={size} />,
      );
      const s = tileStyle(getByTestId('t'));
      expect(s.width).toBe(px);
      expect(s.height).toBe(px);
    },
  );

  it('accepts an explicit numeric size and derives the icon size', () => {
    const {getByTestId} = render(<IconTile testID="t" icon={ICON} size={60} />);
    expect(tileStyle(getByTestId('t')).width).toBe(60);
    const iconStyle = StyleSheet.flatten(
      iconOf(getByTestId('t')).props.style as never,
    ) as Record<string, unknown>;
    expect(iconStyle.width).toBe(30);
  });

  it('honours an explicit iconSize', () => {
    const {getByTestId} = render(
      <IconTile testID="t" icon={ICON} size={48} iconSize={18} />,
    );
    const iconStyle = StyleSheet.flatten(
      iconOf(getByTestId('t')).props.style as never,
    ) as Record<string, unknown>;
    expect(iconStyle.width).toBe(18);
    expect(iconStyle.height).toBe(18);
  });

  it('tints the icon only when iconTintColor is provided', () => {
    const {getByTestId, rerender} = render(<IconTile testID="t" icon={ICON} />);
    const untinted = StyleSheet.flatten(
      iconOf(getByTestId('t')).props.style as never,
    ) as Record<string, unknown>;
    expect(untinted.tintColor).toBeUndefined();

    rerender(
      <IconTile
        testID="t"
        icon={ICON}
        iconTintColor={mockTheme.colors.white}
      />,
    );
    const tinted = StyleSheet.flatten(
      iconOf(getByTestId('t')).props.style as never,
    ) as Record<string, unknown>;
    expect(tinted.tintColor).toBe(mockTheme.colors.white);
  });

  it('passes a cover resize mode when requested', () => {
    const {getByTestId} = render(
      <IconTile testID="t" icon={ICON} iconResizeMode="cover" />,
    );
    expect(iconOf(getByTestId('t')).props.resizeMode).toBe('cover');
  });

  it('renders a custom iconNode instead of an image', () => {
    const {getByTestId, getByText} = render(
      <IconTile testID="t" icon={ICON} iconNode={<Text>star</Text>} />,
    );
    expect(getByText('star')).toBeTruthy();
    expect(getByTestId('t').findAllByType(Image)).toHaveLength(0);
  });

  it('renders an empty tile when neither icon nor iconNode is given', () => {
    const {getByTestId} = render(<IconTile testID="t" />);
    expect(getByTestId('t').findAllByType(Image)).toHaveLength(0);
  });

  it('merges an external style onto the tile', () => {
    const {getByTestId} = render(
      <IconTile testID="t" icon={ICON} style={{margin: 7}} />,
    );
    expect(tileStyle(getByTestId('t')).margin).toBe(7);
  });
});
