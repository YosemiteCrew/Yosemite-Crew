import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {AppearanceSelector} from '../../../src/shared/components/common/AppearanceSelector/AppearanceSelector';

const mockSetTheme = jest.fn();
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: mockTheme,
    themeMode: 'system',
    setTheme: mockSetTheme,
  }),
}));

describe('AppearanceSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the label and all three modes', () => {
    const {getByText} = render(<AppearanceSelector />);
    expect(getByText('Appearance')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
  });

  it('marks the active mode as selected', () => {
    const {getByTestId} = render(<AppearanceSelector testID="appear" />);
    expect(
      getByTestId('appear-control-system').props.accessibilityState,
    ).toEqual({selected: true});
  });

  it('persists the chosen mode', () => {
    const {getByTestId} = render(<AppearanceSelector testID="appear" />);
    fireEvent.press(getByTestId('appear-control-dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('supports a custom label', () => {
    const {getByText} = render(<AppearanceSelector label="Theme" />);
    expect(getByText('Theme')).toBeTruthy();
  });
});
