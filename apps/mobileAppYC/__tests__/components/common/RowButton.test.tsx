import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {RowButton} from '@/shared/components/common/RowButton';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    rightArrow: {uri: 'right-arrow-icon'},
  },
}));

describe('RowButton', () => {
  it('renders the label and value', () => {
    render(<RowButton label="Weight" value="12 kg" onPress={jest.fn()} />);
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('12 kg')).toBeTruthy();
  });

  it('shows a placeholder dash when the value is empty', () => {
    render(<RowButton label="Breed" value="" onPress={jest.fn()} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows a placeholder dash when the value is only whitespace', () => {
    render(<RowButton label="Breed" value="   " onPress={jest.fn()} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<RowButton label="Weight" value="12 kg" onPress={onPress} />);
    fireEvent.press(screen.getByText('Weight'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes button role and a combined label/value accessibility label', () => {
    const {getByLabelText} = render(
      <RowButton label="Weight" value="12 kg" onPress={jest.fn()} />,
    );
    const button = getByLabelText('Weight, 12 kg');
    expect(button.props.accessibilityRole).toBe('button');
  });

  it('reflects the placeholder dash in the accessibility label when value is empty', () => {
    const {getByLabelText} = render(
      <RowButton label="Breed" value="" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Breed, —')).toBeTruthy();
  });
});
