import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {ListErrorState} from '@/shared/components/common/ListErrorState/ListErrorState';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.load_failed_title': 'We could not load this',
        'common.load_failed_message':
          'Something went wrong on our side. Check your connection and try again.',
        'common.try_again': 'Try Again',
      })[key] ?? key,
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

describe('ListErrorState', () => {
  it('renders the default failure copy', () => {
    const {getByText} = render(<ListErrorState />);

    expect(getByText('We could not load this')).toBeTruthy();
    expect(
      getByText(
        'Something went wrong on our side. Check your connection and try again.',
      ),
    ).toBeTruthy();
  });

  it('accepts overridden copy', () => {
    const {getByText} = render(
      <ListErrorState title="No tasks loaded" description="Try once more." />,
    );

    expect(getByText('No tasks loaded')).toBeTruthy();
    expect(getByText('Try once more.')).toBeTruthy();
  });

  it('renders a retry control and calls back when pressed', () => {
    const onRetry = jest.fn();
    const {getByTestId, getByText} = render(
      <ListErrorState onRetry={onRetry} />,
    );

    expect(getByText('Try Again')).toBeTruthy();
    fireEvent.press(getByTestId('list-error-state-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry control when no handler is given', () => {
    const {queryByTestId} = render(<ListErrorState />);

    expect(queryByTestId('list-error-state-retry')).toBeNull();
  });

  it('honours a custom retry label', () => {
    const {getByText} = render(
      <ListErrorState onRetry={jest.fn()} retryLabel="Reload" />,
    );

    expect(getByText('Reload')).toBeTruthy();
  });

  it('uses a custom testID for itself and its retry control', () => {
    const {getByTestId} = render(
      <ListErrorState testID="tasks-load-error" onRetry={jest.fn()} />,
    );

    expect(getByTestId('tasks-load-error')).toBeTruthy();
    expect(getByTestId('tasks-load-error-retry')).toBeTruthy();
  });

  // Screen readers announce the failure rather than leaving the user staring at
  // a silent screen, which is what the empty state did.
  it('announces itself as an alert', () => {
    const {getByTestId} = render(<ListErrorState testID="err" />);

    expect(getByTestId('err').props.accessibilityRole).toBe('alert');
    expect(getByTestId('err').props.accessibilityLabel).toContain(
      'We could not load this',
    );
  });
});
