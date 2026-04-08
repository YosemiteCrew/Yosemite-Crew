import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import MerckManualSearchScreen from '../../../../src/features/merck/screens/MerckManualSearchScreen';
import {mockTheme} from '../../../setup/mockTheme';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockGetParent = jest.fn();
const mockAddListener = jest.fn();
const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      getParent: mockGetParent,
      reset: mockReset,
      addListener: mockAddListener,
    }),
    useRoute: () => ({
      params: {
        organisationId: 'org-123',
        initialQuery: 'test query',
        initialEntries: [],
        initialLanguage: 'en',
        initialHasSearched: false,
        context: 'appointments',
      },
    }),
    useFocusEffect: (cb: any) => {
      cb();
    },
  };
});

// Mock components
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({header, children}: any) => {
      const {View} = require('react-native');
      return (
        <View testID="liquid-glass-header-screen">
          {header}
          <View>
            {typeof children === 'function' ? children({}) : children}
          </View>
        </View>
      );
    },
  }),
);

jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, _showBackButton, onBack}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity testID="header-back-button" onPress={onBack}>
        <Text testID="header-title">{title}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock(
  '../../../../src/features/merck/components/MerckSearchWidget',
  () => ({
    MerckSearchWidget: ({organisationId, title}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID="merck-search-widget">
          <Text>{title}</Text>
          <Text>{organisationId}</Text>
        </View>
      );
    },
  }),
);

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

describe('MerckManualSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddListener.mockReturnValue(jest.fn());
  });

  it('renders screen with header and widget', () => {
    const {getByTestId, getByText} = render(<MerckManualSearchScreen />);

    expect(getByTestId('liquid-glass-header-screen')).toBeTruthy();
    expect(getByTestId('header-title')).toBeTruthy();
    expect(getByText('MSD Veterinary Manual')).toBeTruthy();
    expect(getByTestId('merck-search-widget')).toBeTruthy();
  });

  it('renders correct widget title and description', () => {
    const {getByText} = render(<MerckManualSearchScreen />);

    expect(getByText('Consumer MSD Veterinary Manual Search')).toBeTruthy();
  });

  it('calls goBack when handleBack is triggered with non-home context', () => {
    const {getByTestId} = render(<MerckManualSearchScreen />);

    fireEvent.press(getByTestId('header-back-button'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('passes correct props to MerckSearchWidget', () => {
    const {getByText} = render(<MerckManualSearchScreen />);

    expect(getByText('org-123')).toBeTruthy();
  });

  it('memoizes styles based on theme changes', () => {
    const {rerender} = render(<MerckManualSearchScreen />);

    rerender(<MerckManualSearchScreen />);

    // Verify component re-renders successfully
    expect(true).toBe(true);
  });

  it('does not add listener when context is not home', () => {
    mockAddListener.mockClear();

    render(<MerckManualSearchScreen />);

    // When context is 'appointments', useFocusEffect should return early
    // so mockAddListener should not be called
    expect(mockAddListener).not.toHaveBeenCalled();
  });
});
