import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {Header} from '@/shared/components/common/Header/Header';
import {Platform} from 'react-native';

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

const mockBackIcon = 123;
jest.mock('@/assets/images', () => ({
  Images: {
    backIcon: mockBackIcon,
  },
}));

const flattenStyle = (style: any) => (Array.isArray(style) ? style.flat().filter(Boolean) : [style].filter(Boolean));

describe('Header', () => {
  const onBackMock = jest.fn();
  const onRightPressMock = jest.fn();

  beforeEach(() => {
    onBackMock.mockClear();
    onRightPressMock.mockClear();
    Platform.OS = 'ios';
  });

  it('renders title with themed typography', () => {
    const {getByText} = render(<Header title="My Title" />);
    const title = getByText('My Title');

    const flat = flattenStyle(title.props.style);
    expect(flat).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: mockTheme.colors.text,
          fontSize: mockTheme.typography.h3.fontSize,
        }),
      ]),
    );
  });

  it('calls onBack when back button pressed', () => {
    const {UNSAFE_getAllByType} = render(
      <Header title="My Title" showBackButton={true} onBack={onBackMock} />,
    );

    const {TouchableOpacity} = require('react-native');
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons.length).toBe(1);

    fireEvent.press(buttons[0]);
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it('calls onRightPress when right icon pressed', () => {
    const rightIcon = 456;
    const {UNSAFE_getAllByType} = render(
      <Header title="My Title" rightIcon={rightIcon} onRightPress={onRightPressMock} />,
    );

    const {TouchableOpacity} = require('react-native');
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons.length).toBe(1);

    fireEvent.press(buttons[0]);
    expect(onRightPressMock).toHaveBeenCalledTimes(1);
  });

  it('applies platform-specific top padding', () => {
    const {View} = require('react-native');

    Platform.OS = 'ios';
    const iosTree = render(<Header />).UNSAFE_getAllByType(View)[0];
    const iosStyle = flattenStyle(iosTree.props.style);
    expect(iosStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({paddingTop: mockTheme.spacing['2']})]),
    );

    Platform.OS = 'android';
    const androidTree = render(<Header />).UNSAFE_getAllByType(View)[0];
    const androidStyle = flattenStyle(androidTree.props.style);
    expect(androidStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({paddingTop: mockTheme.spacing['5']})]),
    );
  });
});

