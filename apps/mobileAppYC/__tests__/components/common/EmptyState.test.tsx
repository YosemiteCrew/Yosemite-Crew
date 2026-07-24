import React from 'react';
import {Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

import {mockTheme} from '../setup/mockTheme';
import {EmptyState} from '../../../src/shared/components/common/EmptyState/EmptyState';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

describe('EmptyState', () => {
  it('renders the title and optional description', () => {
    const {getByText, queryByText, rerender} = render(
      <EmptyState title="No companions yet" description="Add your first pet" />,
    );
    expect(getByText('No companions yet')).toBeTruthy();
    expect(getByText('Add your first pet')).toBeTruthy();

    rerender(<EmptyState title="Only title" />);
    expect(queryByText('Add your first pet')).toBeNull();
  });

  it('renders a custom icon node', () => {
    const {getByText} = render(
      <EmptyState title="Empty" icon={<Text>ICON</Text>} />,
    );
    expect(getByText('ICON')).toBeTruthy();
  });

  it('shows the CTA only when both label and handler are provided', () => {
    const onAction = jest.fn();
    const {getByTestId, queryByTestId, rerender} = render(
      <EmptyState
        testID="empty"
        title="Empty"
        actionLabel="Add companion"
        onAction={onAction}
      />,
    );
    fireEvent.press(getByTestId('empty-action'));
    expect(onAction).toHaveBeenCalledTimes(1);

    rerender(<EmptyState testID="empty" title="Empty" actionLabel="Add" />);
    expect(queryByTestId('empty-action')).toBeNull();
  });

  it('does not render the CTA without a label', () => {
    const {queryByTestId} = render(
      <EmptyState testID="empty" title="Empty" onAction={jest.fn()} />,
    );
    expect(queryByTestId('empty-action')).toBeNull();
  });

  it('renders the CTA without a testID and stays accessible by label', () => {
    const onAction = jest.fn();
    const {getByLabelText} = render(
      <EmptyState
        title="Empty"
        actionLabel="Add companion"
        onAction={onAction}
      />,
    );
    const cta = getByLabelText('Add companion');
    expect(cta.props.testID).toBeUndefined();
    fireEvent.press(cta);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
