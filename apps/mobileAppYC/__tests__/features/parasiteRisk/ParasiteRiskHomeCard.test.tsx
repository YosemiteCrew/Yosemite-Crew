import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';
import {parasiteRiskInitialState} from '@/features/parasiteRisk/parasiteRiskSlice';

let mockRiskState: Record<string, unknown> = {};

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: (s: unknown) => unknown) =>
    selector({parasiteRisk: mockRiskState}),
}));

const mockT = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${Object.values(values).join(',')}` : key;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: mockT}),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

import {ParasiteRiskHomeCard} from '@/features/parasiteRisk/components/ParasiteRiskHomeCard/ParasiteRiskHomeCard';

const onPress = jest.fn();

describe('ParasiteRiskHomeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRiskState = {...parasiteRiskInitialState};
  });

  it('prompts when nothing has been looked up yet', () => {
    render(<ParasiteRiskHomeCard onPress={onPress} />);

    expect(screen.getByText('parasiteRisk.homePrompt')).toBeTruthy();
  });

  it('summarises the last known headline reading', () => {
    mockRiskState = {
      ...parasiteRiskInitialState,
      location: {label: 'Brisbane', lat: -27.375, lon: 153.125},
      reading: {
        readings: [
          {
            parasiteId: 'paralysis_tick',
            group: 'TICK',
            index: 72,
            tier: 'HIGH',
            trend: 'RISING',
          },
        ],
      },
    };

    render(<ParasiteRiskHomeCard onPress={onPress} />);

    expect(
      screen.getByText(
        'parasiteRisk.homeSummary:parasiteRisk.parasite.paralysis_tick.name,Brisbane',
      ),
    ).toBeTruthy();
    // Tier carried as a word, not colour alone.
    expect(screen.getByText('parasiteRisk.tier.high')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'parasiteRisk.homeAccessibility:parasiteRisk.homeSummary:parasiteRisk.parasite.paralysis_tick.name,Brisbane,parasiteRisk.tier.high',
      ),
    ).toBeTruthy();
  });

  it('does not claim a reading when a location is known but the reading is not', () => {
    mockRiskState = {
      ...parasiteRiskInitialState,
      location: {label: 'Brisbane', lat: -27.375, lon: 153.125},
    };

    render(<ParasiteRiskHomeCard onPress={onPress} />);
    expect(screen.getByText('parasiteRisk.homePrompt')).toBeTruthy();
  });

  it('opens the feature when tapped', () => {
    render(<ParasiteRiskHomeCard onPress={onPress} />);

    fireEvent.press(
      screen.getByLabelText('parasiteRisk.title. parasiteRisk.homePrompt'),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
