import React from 'react';
import {Text} from 'react-native';
import {render} from '@testing-library/react-native';
import {useResolvedUserCurrency} from '@/shared/hooks/useResolvedUserCurrency';

const mockUsePreferences = jest.fn();
jest.mock('@/features/preferences/PreferencesContext', () => ({
  usePreferences: () => mockUsePreferences(),
}));

const Probe = () => <Text>{useResolvedUserCurrency()}</Text>;

describe('useResolvedUserCurrency', () => {
  it('returns whatever the preferences context resolved', () => {
    mockUsePreferences.mockReturnValue({currency: 'EUR'});
    expect(render(<Probe />).getByText('EUR')).toBeTruthy();

    mockUsePreferences.mockReturnValue({currency: 'USD'});
    expect(render(<Probe />).getByText('USD')).toBeTruthy();
  });
});
