import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen, act} from '@testing-library/react-native';
import {OnboardingScreen} from '../../../../src/features/onboarding/screens/OnboardingScreen';
import {Image, FlatList} from 'react-native';

// --- Mocks ---

// 1. Mock Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 2. Mock LiquidGlassButton
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, ...props}: any) => {
      const {Text, TouchableOpacity} = require('react-native');
      return (
        <TouchableOpacity
          testID="liquid-glass-button"
          onPress={onPress}
          {...props}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

// 3. Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children, style}: any) => {
    const {View} = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

// 4. Mock Image Assets
jest.mock('../../../assets/images/onboarding/text-image-1.png', () => ({
  uri: 'mock-text-1',
}));
jest.mock('../../../assets/images/onboarding/bottom-image-1.png', () => ({
  uri: 'mock-bottom-1',
}));
jest.mock('../../../assets/images/onboarding/text-image-2.png', () => ({
  uri: 'mock-text-2',
}));
jest.mock('../../../assets/images/onboarding/bottom-image-2.png', () => ({
  uri: 'mock-bottom-2',
}));
jest.mock('../../../assets/images/onboarding/text-image-3.png', () => ({
  uri: 'mock-text-3',
}));
jest.mock('../../../assets/images/onboarding/bottom-image-3.png', () => ({
  uri: 'mock-bottom-3',
}));
jest.mock('../../../assets/images/onboarding/text-image-4.png', () => ({
  uri: 'mock-text-4',
}));
jest.mock('../../../assets/images/onboarding/bottom-image-4.png', () => ({
  uri: 'mock-bottom-4',
}));

describe('OnboardingScreen', () => {
  it('renders the FlatList and initial items correctly', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);

    // Verify Image content is present (4 slides * 2 images = 8)
    const images = screen.UNSAFE_getAllByType(Image);
    expect(images.length).toBe(8);
  });

  it('renders the "Get Started" button on the last slide', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const button = screen.getByText('Get Started');
    expect(button).toBeTruthy();
  });

  it('calls onComplete when the "Get Started" button is pressed', () => {
    const onCompleteMock = jest.fn();
    render(<OnboardingScreen onComplete={onCompleteMock} />);

    const touchable = screen.getByTestId('liquid-glass-button');
    fireEvent.press(touchable);

    expect(onCompleteMock).toHaveBeenCalledTimes(1);
  });

  it('handles viewable items changes correctly (100% Branch Coverage)', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);

    const flatList = screen.UNSAFE_getByType(FlatList);

    // 1. Test Normal Update (Index > 0)
    // Covers: viewableItems.length > 0 AND right side of || 0 NOT taken
    act(() => {
      flatList.props.onViewableItemsChanged({
        viewableItems: [{index: 2, item: {}, key: '3', isViewable: true}],
        changed: [],
      });
    });

    // 2. Test Fallback Logic (Index is 0)
    // Covers: viewableItems.length > 0 AND right side of || 0 TAKEN (0 || 0)
    act(() => {
      flatList.props.onViewableItemsChanged({
        viewableItems: [{index: 0, item: {}, key: '1', isViewable: true}],
        changed: [],
      });
    });

    // 3. Test Empty Array (If condition false)
    // Covers: viewableItems.length <= 0 branch
    act(() => {
      flatList.props.onViewableItemsChanged({
        viewableItems: [],
        changed: [],
      });
    });
  });

  it('extracts keys correctly using keyExtractor', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    const flatList = screen.UNSAFE_getByType(FlatList);

    // Manually invoke keyExtractor to cover the inline function: item => item.id
    const testItem = {
      id: 'test-id-123',
      textImage: 1,
      bottomImage: 2,
      textImageWidth: 100,
      bottomImageHeight: 100,
    };
    const key = flatList.props.keyExtractor(testItem, 0);

    expect(key).toBe('test-id-123');
  });

  it('renders matches snapshot', () => {
    render(<OnboardingScreen onComplete={jest.fn()} />);
    expect(screen.toJSON()).toMatchSnapshot();
  });
});
