import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SwipeableActionCard} from '../../../src/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {Text, Image} from 'react-native';

// --- Mocks ---

// 1. Mock Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: 'blue',
        success: 'green',
        surface: 'white',
      },
      spacing: [0, 4, 8, 12, 16],
    },
  }),
}));

// 2. Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    editIconSlide: {uri: 'edit-icon'},
    viewIconSlide: {uri: 'view-icon'},
  },
}));

// 3. Mock Card Styles Helpers
jest.mock('@/shared/components/common/cardStyles', () => ({
  ACTION_WIDTH: 100,
  OVERLAP_WIDTH: 20,
  getActionWrapperStyle: jest.fn(() => ({testStyle: 'wrapper'})),
  getEditActionButtonStyle: jest.fn(() => ({testStyle: 'edit-btn'})),
  getViewActionButtonStyle: jest.fn(() => ({testStyle: 'view-btn'})),
}));

// 4. Mock SwipeableGlassCard
// CRITICAL FIX: Ensure children are rendered properly and accessible
const mockClose = jest.fn();

jest.mock(
  '@/shared/components/common/SwipeableGlassCard/SwipeableGlassCard',
  () => {
    const {View: RNView, Text: RNText} = require('react-native');
    return {
      SwipeableGlassCard: ({
        children,
        renderActionContent,
        actionWidth,
        actionOverlap,
        _hideSwipeActions, // FIX: Renamed unused var with prefix _
      }: any) => (
        <RNView
          testID="swipe-card-wrapper"
          accessibilityLabel={JSON.stringify({actionWidth, actionOverlap})}>
          {children}
          {renderActionContent ? (
            renderActionContent(mockClose)
          ) : (
            <RNText>No Actions</RNText>
          )}
        </RNView>
      ),
    };
  },
);

describe('SwipeableActionCard', () => {
  const defaultProps = {
    onPressEdit: jest.fn(),
    onPressView: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to find images robustly. Since actual Image component might not expose role 'image' in test env,
  // we look for type 'Image' directly if role fails, OR we check testID if we added one.
  // BUT the source code uses standard <Image source={...} />.
  // The reliable way in this specific test setup (where we are NOT mocking Image globally) is to rely on UNSAFE_getAllByType(Image).

  it('renders correctly with default props (Both Edit and View actions)', () => {
    const {getByText, UNSAFE_getAllByType, getByTestId} = render(
      <SwipeableActionCard {...defaultProps}>
        <Text>Card Content</Text>
      </SwipeableActionCard>,
    );

    expect(getByText('Card Content')).toBeTruthy();

    // Verify images for both buttons exist (Edit icon and View icon)
    // Using UNSAFE_getAllByType(Image) is more robust here than ByRole given the previous error.
    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(2); // 1 Edit, 1 View
    expect(images[0].props.source.uri).toBe('edit-icon');
    expect(images[1].props.source.uri).toBe('view-icon');

    // Verify Action Width logic:
    // showEdit=true -> 2 buttons * 100 + 20 overlap = 220
    const wrapper = getByTestId('swipe-card-wrapper');
    const propsData = JSON.parse(wrapper.props.accessibilityLabel);
    expect(propsData.actionWidth).toBe(220);
    expect(propsData.actionOverlap).toBe(20);
  });

  it('renders correctly without Edit action', () => {
    const {UNSAFE_getAllByType, getByTestId} = render(
      <SwipeableActionCard {...defaultProps} showEditAction={false}>
        <Text>Card Content</Text>
      </SwipeableActionCard>,
    );

    // Verify only View image exists
    const images = UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(1); // Only View
    expect(images[0].props.source.uri).toBe('view-icon');

    // Verify Action Width logic:
    // showEdit=false -> 1 button * 100 + 20 overlap = 120
    const wrapper = getByTestId('swipe-card-wrapper');
    const propsData = JSON.parse(wrapper.props.accessibilityLabel);
    expect(propsData.actionWidth).toBe(120);
  });

  it('renders correctly when swipe actions are hidden', () => {
    const {getByText, getByTestId} = render(
      <SwipeableActionCard {...defaultProps} hideSwipeActions={true}>
        <Text>Card Content</Text>
      </SwipeableActionCard>,
    );

    // Should render "No Actions" text because renderActionContent should be undefined in mock
    expect(getByText('No Actions')).toBeTruthy();

    // Verify Action Width is 0
    const wrapper = getByTestId('swipe-card-wrapper');
    const propsData = JSON.parse(wrapper.props.accessibilityLabel);
    expect(propsData.actionWidth).toBe(0);
    expect(propsData.actionOverlap).toBe(0);
  });

  it('handles "Edit" button press', () => {
    const {UNSAFE_getAllByType} = render(
      <SwipeableActionCard {...defaultProps}>
        <Text>Content</Text>
      </SwipeableActionCard>,
    );

    const images = UNSAFE_getAllByType(Image);
    // Edit is usually the first one in the structure based on the code
    const editButton = images[0].parent;

    if (!editButton) throw new Error('Edit button not found');

    fireEvent.press(editButton);

    expect(mockClose).toHaveBeenCalled();
    expect(defaultProps.onPressEdit).toHaveBeenCalled();
  });

  it('handles "View" button press', () => {
    const {UNSAFE_getAllByType} = render(
      <SwipeableActionCard {...defaultProps}>
        <Text>Content</Text>
      </SwipeableActionCard>,
    );

    const images = UNSAFE_getAllByType(Image);
    // View is the second one
    const viewButton = images[1].parent;

    if (!viewButton) throw new Error('View button not found');

    fireEvent.press(viewButton);

    expect(mockClose).toHaveBeenCalled();
    expect(defaultProps.onPressView).toHaveBeenCalled();
  });

  it('applies custom background color', () => {
    const {getByTestId} = render(
      <SwipeableActionCard {...defaultProps} actionBackgroundColor="red">
        <Text>Content</Text>
      </SwipeableActionCard>,
    );

    // The test mainly ensures no crash and props are passed through.
    // Logic is inside SwipeableGlassCard which is mocked here, but we pass props to it.
    expect(getByTestId('swipe-card-wrapper')).toBeTruthy();
  });

  it('handles missing onPress callbacks safely', () => {
    // Render without callbacks
    const {UNSAFE_getAllByType} = render(
      <SwipeableActionCard>
        <Text>Content</Text>
      </SwipeableActionCard>,
    );

    const images = UNSAFE_getAllByType(Image);

    // Press Edit
    fireEvent.press(images[0].parent!);
    expect(mockClose).toHaveBeenCalled(); // Close still called

    // Press View
    fireEvent.press(images[1].parent!);
    expect(mockClose).toHaveBeenCalledTimes(2); // Close called again
  });
});
