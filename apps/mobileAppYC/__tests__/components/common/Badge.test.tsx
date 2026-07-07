import React from 'react';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {
  Badge,
  type BadgeStatus,
} from '../../../src/shared/components/common/Badge/Badge';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const bgOf = (node: {props: {style: unknown}}) =>
  StyleSheet.flatten(node.props.style as never).backgroundColor;

describe('Badge', () => {
  it('renders the label text', () => {
    const {getByText} = render(<Badge label="Upcoming" />);
    expect(getByText('Upcoming')).toBeTruthy();
  });

  it('defaults to the neutral tone', () => {
    const {getByTestId} = render(<Badge testID="b" label="Draft" />);
    expect(bgOf(getByTestId('b'))).toBe(mockTheme.colors.screen2);
  });

  it.each([
    ['info', mockTheme.colors.blueSoft],
    ['success', mockTheme.colors.successSurface],
    ['warning', mockTheme.colors.warningSurface],
    ['danger', mockTheme.colors.dangerSurface],
  ] as const)('paints the %s tone', (tone, expected) => {
    const {getByTestId} = render(<Badge testID="b" label="x" tone={tone} />);
    expect(bgOf(getByTestId('b'))).toBe(expected);
  });

  it.each([
    ['upcoming', mockTheme.colors.blueSoft],
    ['requested', mockTheme.colors.screen2],
    ['checkedIn', mockTheme.colors.blueSoft],
    ['inProgress', mockTheme.colors.blueSoft],
    ['completed', mockTheme.colors.successSurface],
    ['pending', mockTheme.colors.warningSurface],
    ['cancelled', mockTheme.colors.dangerSurface],
  ] as [BadgeStatus, string][])(
    'maps the %s status onto its tone',
    (status, expected) => {
      const {getByTestId} = render(
        <Badge testID="b" label="x" status={status} />,
      );
      expect(bgOf(getByTestId('b'))).toBe(expected);
    },
  );

  it('supports a medium size', () => {
    const {getByText} = render(<Badge label="Big" size="md" />);
    expect(StyleSheet.flatten(getByText('Big').props.style).fontSize).toBe(12);
  });

  it('exposes an accessible text role', () => {
    const {getByTestId} = render(<Badge testID="b" label="x" />);
    expect(getByTestId('b').props.accessibilityRole).toBe('text');
  });
});
