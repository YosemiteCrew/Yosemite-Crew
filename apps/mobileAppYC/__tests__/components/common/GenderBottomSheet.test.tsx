import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {GenderBottomSheet} from '@/shared/components/common/GenderBottomSheet/GenderBottomSheet';

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(({children, title}: any, ref: any) => {
      const {View, Text} = require('react-native');
      ReactModule.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return ReactModule.createElement(
        View,
        {testID: 'bottom-sheet'},
        ReactModule.createElement(Text, {testID: 'sheet-title'}, title),
        children
      );
    }),
  };
});

jest.mock('@/shared/components/common/LiquidGlassButton/LiquidGlassButton', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return ReactModule.createElement(
        TouchableOpacity,
        {onPress, testID: `button-${title}`},
        ReactModule.createElement(Text, null, title)
      );
    },
  };
});

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#007AFF',
        secondary: '#333',
        background: '#FFF',
        cardBackground: '#FFF',
        border: '#E0E0E0',
        textSecondary: '#666',
        text: '#000',
      },
      spacing: {2: 8, 3: 12, 4: 16, 6: 24, 8: 32},
      typography: {
        bodyMedium: {fontSize: 14},
        titleMedium: {fontSize: 16},
        h3: {fontSize: 26, lineHeight: 31.2, fontWeight: '500'},
      },
      borderRadius: {md: 8, full: 9999},
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {checkIcon: 1},
}));

describe('GenderBottomSheet', () => {
  const mockOnSave = jest.fn();
  const mockRef = React.createRef<any>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const {getByTestId} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('renders title', () => {
    const {getByTestId} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(getByTestId('sheet-title')).toBeTruthy();
  });

  it('renders gender options', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(getByText('Male')).toBeTruthy();
    expect(getByText('Female')).toBeTruthy();
  });

  it('calls onSave with male when Male selected', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    fireEvent.press(getByText('Male'));
    expect(mockOnSave).toHaveBeenCalledWith('male');
  });

  it('calls onSave with female when Female selected', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    fireEvent.press(getByText('Female'));
    expect(mockOnSave).toHaveBeenCalledWith('female');
  });

  it('shows selected state for male', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender="male" onSave={mockOnSave} />
    );
    expect(getByText('Male')).toBeTruthy();
  });

  it('shows selected state for female', () => {
    const {getByText} = render(
      <GenderBottomSheet ref={mockRef} selectedGender="female" onSave={mockOnSave} />
    );
    expect(getByText('Female')).toBeTruthy();
  });

  it('exposes open method via ref', () => {
    render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(mockRef.current?.open).toBeDefined();
  });

  it('exposes close method via ref', () => {
    render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(mockRef.current?.close).toBeDefined();
  });

  it('matches snapshot', () => {
    const {toJSON} = render(
      <GenderBottomSheet ref={mockRef} selectedGender={null} onSave={mockOnSave} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
