import React from 'react';
import {render} from '@testing-library/react-native';

import {ListLoadingState} from '@/shared/components/common/ListLoadingState/ListLoadingState';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'common.loading' ? 'Loading...' : key),
  }),
}));

jest.mock('@/shared/components/common/GifLoader/GifLoader', () => ({
  GifLoader: () => null,
}));

describe('ListLoadingState', () => {
  it('renders with a default testID', () => {
    const {getByTestId} = render(<ListLoadingState />);
    expect(getByTestId('list-loading-state')).toBeTruthy();
  });

  it('accepts a custom testID', () => {
    const {getByTestId} = render(<ListLoadingState testID="tasks-loading" />);
    expect(getByTestId('tasks-loading')).toBeTruthy();
  });

  // Announced to screen readers rather than leaving the region silent, which is
  // what a blank list area did.
  it('announces itself as progress', () => {
    const {getByTestId} = render(<ListLoadingState testID="x" />);
    expect(getByTestId('x').props.accessibilityRole).toBe('progressbar');
    expect(getByTestId('x').props.accessibilityLabel).toBe('Loading...');
  });
});
