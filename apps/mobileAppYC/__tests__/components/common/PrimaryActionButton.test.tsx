import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {
  PrimaryActionButton,
  PrimaryActionButtonProps,
} from '../../../src/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import {StyleSheet, ActivityIndicator} from 'react-native';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

describe('PrimaryActionButton Component', () => {
  const defaultProps: PrimaryActionButtonProps = {
    title: 'Click Me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title as a flat CTA button', () => {
    const {getByText, getByRole} = render(
      <PrimaryActionButton {...defaultProps} />,
    );
    expect(getByText('Click Me')).toBeTruthy();
    expect(getByRole('button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const {getByRole} = render(
      <PrimaryActionButton {...defaultProps} onPress={onPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const {getByRole} = render(
      <PrimaryActionButton {...defaultProps} onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner and hides the title while loading', () => {
    const {queryByText, UNSAFE_getAllByType} = render(
      <PrimaryActionButton {...defaultProps} loading />,
    );
    expect(queryByText('Click Me')).toBeNull();
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBe(1);
  });

  it('merges container style correctly', () => {
    const customStyle = {marginTop: 10};
    const {getByRole} = render(
      <PrimaryActionButton {...defaultProps} style={customStyle} />,
    );
    const flatStyle = StyleSheet.flatten(getByRole('button').props.style);
    expect(flatStyle).toMatchObject(expect.objectContaining(customStyle));
    // Full-width flat CTA default
    expect(flatStyle).toHaveProperty('width', '100%');
  });

  it('merges text style correctly', () => {
    const customTextStyle = {color: 'blue', fontSize: 20};
    const {getByText} = render(
      <PrimaryActionButton {...defaultProps} textStyle={customTextStyle} />,
    );
    const flatStyle = StyleSheet.flatten(getByText('Click Me').props.style);
    expect(flatStyle).toMatchObject(expect.objectContaining(customTextStyle));
    expect(flatStyle).toHaveProperty('textAlign', 'center');
  });
});
