import React from 'react';
import {Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';

import {mockTheme} from '../../../../setup/mockTheme';
import {PaymentsEmptyState} from '@/features/payments/components/PaymentsEmptyState/PaymentsEmptyState';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Ionicons / MaterialIcons are globally mocked in jest.setup.js: each icon
// renders as a Text node with testID `icon-<name>` and accessibilityLabel
// `<name>`, forwarding the size/color props.

describe('PaymentsEmptyState', () => {
  it('renders the container, serif title and default medallion glyph', () => {
    const {getByTestId, getByText, queryByTestId} = render(
      <PaymentsEmptyState testID="payments-empty" title="Nothing due" />,
    );

    // Container is addressable by the passed testID.
    expect(getByTestId('payments-empty')).toBeTruthy();
    // Serif title copy.
    expect(getByText('Nothing due')).toBeTruthy();

    // Default checkmark-done medallion icon with theme success color.
    const icon = getByTestId('icon-checkmark-done-outline');
    expect(icon.props.accessibilityLabel).toBe('checkmark-done-outline');
    expect(icon.props.size).toBe(42);
    expect(icon.props.color).toBe(mockTheme.colors.success);

    // With neither an action label nor a handler, the tertiary link is absent.
    expect(queryByTestId('payments-empty-action')).toBeNull();
  });

  it('renders the description when one is provided and omits it otherwise', () => {
    const {getByText, queryByText, rerender} = render(
      <PaymentsEmptyState
        title="All settled"
        description="You have no outstanding invoices."
      />,
    );
    expect(getByText('You have no outstanding invoices.')).toBeTruthy();

    rerender(<PaymentsEmptyState title="All settled" />);
    expect(queryByText('You have no outstanding invoices.')).toBeNull();
  });

  it('renders a custom icon node in place of the default glyph', () => {
    const {getByText, queryByTestId} = render(
      <PaymentsEmptyState title="Empty" icon={<Text>CUSTOM_ICON</Text>} />,
    );

    expect(getByText('CUSTOM_ICON')).toBeTruthy();
    // The default medallion glyph is not rendered when a custom icon is given.
    expect(queryByTestId('icon-checkmark-done-outline')).toBeNull();
  });

  it('shows the tertiary action only when both label and handler are supplied', () => {
    const onAction = jest.fn();
    const {getByTestId, getByText, queryByTestId, rerender} = render(
      <PaymentsEmptyState
        testID="payments-empty"
        title="Nothing due"
        actionLabel="View past payments"
        onAction={onAction}
      />,
    );

    // Action label copy and trailing arrow glyph render.
    expect(getByText('View past payments')).toBeTruthy();
    const arrow = getByTestId('icon-arrow-forward');
    expect(arrow.props.size).toBe(14);
    expect(arrow.props.color).toBe(mockTheme.colors.blueText);

    // The pressable is derived from the testID and fires the handler.
    const action = getByTestId('payments-empty-action');
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityLabel).toBe('View past payments');
    fireEvent.press(action);
    expect(onAction).toHaveBeenCalledTimes(1);

    // Drop the handler: the action (and its label) disappear.
    rerender(
      <PaymentsEmptyState
        testID="payments-empty"
        title="Nothing due"
        actionLabel="View past payments"
      />,
    );
    expect(queryByTestId('payments-empty-action')).toBeNull();
    expect(queryByTestId('icon-arrow-forward')).toBeNull();
  });

  it('does not render the action when only a handler is supplied', () => {
    const {queryByTestId} = render(
      <PaymentsEmptyState
        testID="payments-empty"
        title="Nothing due"
        onAction={jest.fn()}
      />,
    );
    expect(queryByTestId('payments-empty-action')).toBeNull();
  });

  it('renders the action without a testID and stays reachable by label', () => {
    const onAction = jest.fn();
    const {getByLabelText, queryByTestId} = render(
      <PaymentsEmptyState
        title="Nothing due"
        actionLabel="View past payments"
        onAction={onAction}
      />,
    );

    // No container testID => the action gets an undefined testID.
    const action = getByLabelText('View past payments');
    expect(action.props.testID).toBeUndefined();
    fireEvent.press(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(queryByTestId('payments-empty-action')).toBeNull();
  });
});
