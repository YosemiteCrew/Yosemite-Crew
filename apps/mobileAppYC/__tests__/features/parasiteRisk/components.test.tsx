import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';
import type {
  ParasiteRiskReading,
  RiskTier,
} from '@/features/parasiteRisk/types';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the key plus any interpolated values, so assertions can check both
    // that the right key was used and that the values reached it.
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

import {ThreatDial} from '@/features/parasiteRisk/components/ThreatDial/ThreatDial';
import {RiskTierBadge} from '@/features/parasiteRisk/components/RiskTierBadge/RiskTierBadge';
import {ParasiteRiskCard} from '@/features/parasiteRisk/components/ParasiteRiskCard/ParasiteRiskCard';
import {LapsedCoverBanner} from '@/features/parasiteRisk/components/LapsedCoverBanner/LapsedCoverBanner';

const TIERS: RiskTier[] = ['LOW', 'MODERATE', 'HIGH', 'EXTREME'];

const reading = (tier: RiskTier = 'HIGH'): ParasiteRiskReading => ({
  parasiteId: 'paralysis_tick',
  group: 'TICK',
  index: 62,
  tier,
  trend: 'RISING',
});

describe('ThreatDial', () => {
  it.each(TIERS)('renders the written tier label for %s', tier => {
    render(<ThreatDial tier={tier} index={50} tierLabel={`Tier ${tier}`} />);
    expect(screen.getByText(`Tier ${tier}`)).toBeTruthy();
  });

  it('exposes the tier and index to screen readers', () => {
    render(<ThreatDial tier="EXTREME" index={91} tierLabel="Extreme" />);

    // The gauge is decorative on its own, so the reading has to be spoken.
    expect(
      screen.getByLabelText('parasiteRisk.dialAccessibility:Extreme,91'),
    ).toBeTruthy();
  });

  it('renders the caption when one is supplied', () => {
    render(
      <ThreatDial
        tier="HIGH"
        index={60}
        tierLabel="High"
        caption="Paralysis tick"
      />,
    );
    expect(screen.getByText('Paralysis tick')).toBeTruthy();
  });
});

describe('RiskTierBadge', () => {
  it.each(TIERS)('renders %s as a word, not only a colour', tier => {
    render(<RiskTierBadge tier={tier} label={`Label ${tier}`} />);
    expect(screen.getByText(`Label ${tier}`)).toBeTruthy();
  });
});

describe('ParasiteRiskCard', () => {
  const props = {
    reading: reading(),
    name: 'Paralysis tick',
    summary: 'A tick of humid coastal Australia.',
    tierLabel: 'High',
    trendLabel: 'Rising over the next week',
    onPress: jest.fn(),
  };

  it('shows the name, summary, tier and trend together', () => {
    render(<ParasiteRiskCard {...props} />);

    expect(screen.getByText('Paralysis tick')).toBeTruthy();
    expect(screen.getByText('A tick of humid coastal Australia.')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText('Rising over the next week')).toBeTruthy();
  });

  it('calls through on press', () => {
    const onPress = jest.fn();
    render(<ParasiteRiskCard {...props} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText(/Paralysis tick\. High\./));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('LapsedCoverBanner', () => {
  const handlers = {onAddPrevention: jest.fn(), onBookVisit: jest.fn()};

  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when cover is current', () => {
    const {toJSON} = render(
      <LapsedCoverBanner
        cover={{status: 'covered', lastCompletedAt: null}}
        companionName="Milo"
        {...handlers}
      />,
    );

    // No nagging when there is nothing to act on.
    expect(toJSON()).toBeNull();
  });

  it('names the pet and the number of days when cover has lapsed', () => {
    render(
      <LapsedCoverBanner
        cover={{status: 'lapsed', daysOverdue: 9}}
        companionName="Milo"
        {...handlers}
      />,
    );

    expect(
      screen.getByText('parasiteRisk.cover.lapsedBody:Milo,9'),
    ).toBeTruthy();
  });

  it('uses the no-cover wording when nothing is scheduled', () => {
    render(
      <LapsedCoverBanner
        cover={{status: 'none'}}
        companionName="Milo"
        {...handlers}
      />,
    );

    expect(screen.getByText('parasiteRisk.cover.noneBody:Milo')).toBeTruthy();
  });

  it('offers both a prevention and a booking route', () => {
    render(
      <LapsedCoverBanner
        cover={{status: 'none'}}
        companionName="Milo"
        {...handlers}
      />,
    );

    fireEvent.press(screen.getByText('parasiteRisk.cover.addPrevention'));
    fireEvent.press(screen.getByText('parasiteRisk.cover.bookVisit'));

    expect(handlers.onAddPrevention).toHaveBeenCalledTimes(1);
    expect(handlers.onBookVisit).toHaveBeenCalledTimes(1);
  });

  it('announces the alert without swallowing either action', () => {
    render(
      <LapsedCoverBanner
        cover={{status: 'none'}}
        companionName="Milo"
        {...handlers}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('parasiteRisk.cover.title')).toBeTruthy();

    // `accessible` collapses a view and everything under it into one node, so
    // anything the alert wraps stops being reachable on its own. The buttons
    // therefore have to sit outside it.
    expect(within(alert).queryAllByRole('button')).toHaveLength(0);

    const actions = screen.getAllByRole('button');
    expect(actions).toHaveLength(2);

    fireEvent.press(actions[0]);
    fireEvent.press(actions[1]);
    expect(handlers.onAddPrevention).toHaveBeenCalledTimes(1);
    expect(handlers.onBookVisit).toHaveBeenCalledTimes(1);
  });
});
