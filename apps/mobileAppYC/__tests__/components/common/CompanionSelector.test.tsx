import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import {
  CompanionSelector,
  type CompanionBase,
} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  spacing: {
    '1': 2,
    '2.5': 6,
    '3': 8,
  },
  colors: {
    primaryTint: 'mock-primaryTint',
    cardBackground: 'mock-cardBackground',
    primary: 'mock-primary',
    secondary: 'mock-secondary',
    lightBlueBackground: 'mock-lightBlueBackground',
    primaryTintStrong: 'mock-primaryTintStrong',
    primarySurface: 'mock-primarySurface',
  },
  borderRadius: {
    full: 50,
  },
  typography: {
    titleMedium: { fontSize: 18 },
    titleSmall: { fontSize: 16 },
    labelXsBold: { fontSize: 10, fontWeight: 'bold' },
  },
};

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// 2. Mock assets
jest.mock('@/assets/images', () => ({
  Images: {
    blueAddIcon: 98765, // Mocked image source
  },
}));

// 3. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string, testID?: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(name, {
        ...props,
        ref,
        testID: props.testID || testID,
      }),
    );

  // FIX: Mock that respects 'disabled' and provides a stable testID
  const MockTouchableOpacity = React.forwardRef((props: any, ref: any) => {
    const { onPress, disabled, ...rest } = props;

    const handlePress = () => {
      if (!disabled) {
        onPress?.();
      }
    };

    return React.createElement('TouchableOpacity', {
      ...rest,
      ref,
      onPress: handlePress,
      disabled: disabled,
      // FIX: Use a generic, stable testID. Do NOT access props.key
      testID: props.testID || 'mock-touchable-opacity',
    });
  });

  return {
    ScrollView: createMockComponent('ScrollView', 'mock-scroll-view'),
    TouchableOpacity: MockTouchableOpacity, // Use the new mock
    Text: createMockComponent('Text', 'mock-text'),
    View: createMockComponent('View', 'mock-view'),
    Image: createMockComponent('Image', 'mock-image'),
    Animated: {
      View: createMockComponent('Animated.View', 'mock-animated-view'),
    },
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
  };
});

// --- Test Setup ---
const mockCompanions: CompanionBase[] = [
  { id: '1', name: 'Buddy', profileImage: 'http://image.url/buddy.png', taskCount: 2 },
  { id: '2', name: 'Lucy', profileImage: null, taskCount: 0 },
  { id: '3', name: 'Max', profileImage: undefined /* no taskCount */ },
];

const createWrapper = (ui: React.ReactElement, preloadedState: any = {}) => {
  const store = configureStore({
    reducer: () => ({
      coParent: {
        accessByCompanionId: {},
        defaultAccess: null,
        lastFetchedRole: null,
        lastFetchedPermissions: null,
        ...preloadedState?.coParent,
      },
    }),
  });

  return render(<Provider store={store}>{ui}</Provider>);
};

describe('CompanionSelector', () => {
  const mockOnSelect = jest.fn();
  const mockOnAddCompanion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
  });

  it('renders all companions and the add button by default', () => {
    const { getByText, getAllByTestId } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        onAddCompanion={mockOnAddCompanion}
      />,
    );

    expect(getByText('Buddy')).toBeTruthy();
    expect(getByText('Lucy')).toBeTruthy();
    expect(getByText('Max')).toBeTruthy();
    expect(getByText('Add companion')).toBeTruthy();

    const addIcon = getAllByTestId('mock-image').find(
      (img) => img.props.source === Images.blueAddIcon,
    );
    expect(addIcon).toBeTruthy();
  });

  it('renders profileImage for companion with one', () => {
    const { getAllByTestId } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    const images = getAllByTestId('mock-image');
    const buddyAvatar = images.find(
      (img) => img.props.source.uri === 'http://image.url/buddy.png',
    );
    expect(buddyAvatar).toBeTruthy();
  });

  it('renders placeholder with initial for companions without profileImage', () => {
    const { getByText } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('M')).toBeTruthy();
  });

  it('applies selected styles only to the selected companion', () => {
    const { getAllByTestId } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId="1" // Buddy is selected
        onSelect={mockOnSelect}
      />,
    );

    const rings = getAllByTestId('mock-animated-view');
    const buddyRing = rings[0];
    const lucyRing = rings[1];

    expect(buddyRing.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ transform: [{ scale: 1.08 }] })]),
    );
    expect(lucyRing.props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ transform: [{ scale: 1.08 }] })]),
    );
  });

  it('calls onSelect with the correct id when a companion is pressed', () => {
    // FIX: Use getAllByTestId
    const { getAllByTestId } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );

    const touchables = getAllByTestId('mock-touchable-opacity');
    // 0: Buddy, 1: Lucy, 2: Max
    // Press 'Lucy' (id: '2')
    act(() => {
      fireEvent.press(touchables[1]);
    });
    expect(mockOnSelect).toHaveBeenCalledWith('2');
  });

  it('calls onAddCompanion when the add button is pressed', () => {
    // FIX: Use getAllByTestId
    const { getAllByTestId } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        onAddCompanion={mockOnAddCompanion}
      />,
    );

    const touchables = getAllByTestId('mock-touchable-opacity');
    // 0: Buddy, 1: Lucy, 2: Max, 3: Add button
    act(() => {
      fireEvent.press(touchables[3]);
    });
    expect(mockOnAddCompanion).toHaveBeenCalledTimes(1);
  });

  it('hides the add button when showAddButton is false', () => {
    const { queryByText } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        onAddCompanion={mockOnAddCompanion}
        showAddButton={false}
      />,
    );
    expect(queryByText('Add companion')).toBeNull();
  });

  it('hides the add button when onAddCompanion is not provided', () => {
    const { queryByText } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        onAddCompanion={undefined}
        showAddButton={true}
      />,
    );
    expect(queryByText('Add companion')).toBeNull();
  });

  it('applies containerStyle to the ScrollView', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = createWrapper(
      <CompanionSelector
        companions={[]}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        containerStyle={customStyle}
      />,
    );
    expect(getByTestId('mock-scroll-view').props.contentContainerStyle).toEqual(
      expect.arrayContaining([customStyle]),
    );
  });

  it('uses getBadgeText function for badge text (Priority 1)', () => {
    const mockGetBadgeText = jest.fn((c: CompanionBase) => `Custom: ${c.name}`);
    const { getByText, queryByText } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
        getBadgeText={mockGetBadgeText}
      />,
    );
    expect(mockGetBadgeText).toHaveBeenCalledWith(mockCompanions[0]);
    expect(getByText('Custom: Buddy')).toBeTruthy();
    expect(queryByText('2 Tasks')).toBeNull();
  });

  it('uses taskCount for badge text when getBadgeText is absent (Priority 2)', () => {
    const { getByText } = createWrapper(
      <CompanionSelector
        companions={mockCompanions}
        selectedCompanionId={null}
        onSelect={mockOnSelect}
      />,
    );
    expect(getByText('2 Tasks')).toBeTruthy(); // For Buddy
    expect(getByText('0 Tasks')).toBeTruthy(); // For Lucy
  });
});
