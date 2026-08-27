import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {ListStaleBanner} from '@/shared/components/common/ListStaleBanner/ListStaleBanner';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../../setup/mockTheme');
  return {__esModule: true, useTheme: jest.fn(() => ({theme, isDark: false}))};
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: {count?: number}) => {
      const copy: Record<string, string> = {
        'common.stale_title': 'Showing older information',
        'common.stale_updated_just_now': 'Updated just now',
        'common.stale_updated_minutes': 'Updated {{count}} min ago',
        'common.stale_updated_hours': 'Updated {{count}} h ago',
        'common.stale_updated_days': 'Updated {{count}} d ago',
        'common.stale_updated_unknown': 'Could not refresh',
        'common.try_again': 'Try Again',
      };
      return (copy[key] ?? key).replace('{{count}}', String(opts?.count ?? ''));
    },
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

describe('ListStaleBanner', () => {
  const MINUTE = 60 * 1000;

  it('says the content may be out of date', () => {
    const {getByText} = render(<ListStaleBanner />);
    expect(getByText('Showing older information')).toBeTruthy();
  });

  it('reports how old the content is', () => {
    const {getByText} = render(
      <ListStaleBanner lastLoadedAt={Date.now() - 5 * MINUTE} />,
    );
    expect(getByText('Updated 5 min ago')).toBeTruthy();
  });

  it('says so plainly when there has never been a successful fetch', () => {
    const {getByText} = render(<ListStaleBanner />);
    expect(getByText('Could not refresh')).toBeTruthy();
  });

  it('retries when the control is pressed', () => {
    const onRetry = jest.fn();
    const {getByTestId} = render(<ListStaleBanner onRetry={onRetry} />);

    fireEvent.press(getByTestId('list-stale-banner-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry control when no handler is given', () => {
    const {queryByTestId} = render(<ListStaleBanner />);
    expect(queryByTestId('list-stale-banner-retry')).toBeNull();
  });

  it('uses a custom testID for itself and its retry control', () => {
    const {getByTestId} = render(
      <ListStaleBanner testID="tasks-stale-banner" onRetry={jest.fn()} />,
    );
    expect(getByTestId('tasks-stale-banner')).toBeTruthy();
    expect(getByTestId('tasks-stale-banner-retry')).toBeTruthy();
  });

  // Announced, because the whole point is that a silent stale list is the bug.
  it('announces itself with both the warning and the age', () => {
    const {getByTestId} = render(
      <ListStaleBanner testID="b" lastLoadedAt={Date.now()} />,
    );
    const label = getByTestId('b').props.accessibilityLabel;
    expect(getByTestId('b').props.accessibilityRole).toBe('alert');
    expect(label).toContain('Showing older information');
    expect(label).toContain('Updated just now');
  });
});
