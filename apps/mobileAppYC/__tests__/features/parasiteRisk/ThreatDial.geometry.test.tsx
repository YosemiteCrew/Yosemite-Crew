import React from 'react';
import {render} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';
import {ThreatDial} from '@/features/parasiteRisk/components/ThreatDial/ThreatDial';

// The real react-native-svg, so the assertion is on the matrix the native
// group receives rather than on the props we happen to pass it.
jest.unmock('react-native-svg');

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

const SIZE = 208;
/** The open-bottom gauge is turned 140 degrees so its gap sits at the bottom. */
const START_ANGLE = 140;

/** SVG matrix [a, b, c, d, e, f] for a rotation about (cx, cy). */
const rotationAbout = (degrees: number, cx: number, cy: number) => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    cos,
    sin,
    -sin,
    cos,
    cx - cx * cos + cy * sin,
    cy - cx * sin - cy * cos,
  ];
};

describe('ThreatDial geometry', () => {
  it('rotates the gauge about its own centre, so the gap sits at the bottom', () => {
    const {UNSAFE_root} = render(
      <ThreatDial tier="HIGH" index={62} tierLabel="High" />,
    );

    const transformed = UNSAFE_root.findAll(
      (node: {type: unknown; props: {matrix?: number[]}}) =>
        typeof node.type === 'string' && node.props.matrix !== undefined,
    );

    // Only the arc group is transformed; the arcs inherit it.
    expect(transformed.map(node => node.type)).toEqual(['RNSVGGroup']);
    const expected = rotationAbout(START_ANGLE, SIZE / 2, SIZE / 2);
    transformed[0].props.matrix.forEach((value: number, i: number) => {
      expect(value).toBeCloseTo(expected[i], 9);
    });
  });
});
