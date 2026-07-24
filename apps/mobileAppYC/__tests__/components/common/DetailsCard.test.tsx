import React from 'react';
import {mockTheme} from '../../setup/mockTheme';
import {render} from '@testing-library/react-native';
import {
  DetailsCard,
  DetailItem,
  DetailBadge,
} from '../../../src/shared/components/common/DetailsCard/DetailsCard';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View: RNView} = require('react-native');
  return {
    LiquidGlassCard: (props: any) => (
      <RNView testID="liquid-glass-card">{props.children}</RNView>
    ),
  };
});

describe('DetailsCard Component', () => {
  const items: DetailItem[] = [
    {label: 'Name', value: 'Poppy'},
    {label: 'Weight', value: '12kg', bold: true},
    {label: 'Secret', value: 'hidden-value', hidden: true},
  ];

  it('renders the title and all visible detail rows', () => {
    const {getByText} = render(
      <DetailsCard title="Companion Details" items={items} />,
    );

    expect(getByText('Companion Details')).toBeTruthy();
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Poppy')).toBeTruthy();
    expect(getByText('Weight')).toBeTruthy();
    expect(getByText('12kg')).toBeTruthy();
  });

  it('does not render items marked hidden', () => {
    const {queryByText} = render(
      <DetailsCard title="Companion Details" items={items} />,
    );

    expect(queryByText('Secret')).toBeNull();
    expect(queryByText('hidden-value')).toBeNull();
  });

  it('renders no badges when badges prop is omitted', () => {
    const {queryByText} = render(
      <DetailsCard title="Companion Details" items={items} />,
    );

    expect(queryByText('Active')).toBeNull();
  });

  it('renders badges when provided', () => {
    const badges: DetailBadge[] = [
      {text: 'Active', backgroundColor: '#e0ffe0', textColor: '#008000'},
      {text: 'Insured', backgroundColor: '#e0e0ff', textColor: '#0000ff'},
    ];

    const {getByText} = render(
      <DetailsCard title="Companion Details" items={items} badges={badges} />,
    );

    expect(getByText('Active')).toBeTruthy();
    expect(getByText('Insured')).toBeTruthy();
  });

  it('renders numeric item values', () => {
    const numericItems: DetailItem[] = [{label: 'Age', value: 3}];
    const {getByText} = render(
      <DetailsCard title="Companion Details" items={numericItems} />,
    );

    expect(getByText('3')).toBeTruthy();
  });
});
