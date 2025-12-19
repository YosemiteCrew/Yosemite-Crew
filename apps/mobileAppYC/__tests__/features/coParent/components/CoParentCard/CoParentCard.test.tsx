import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {CoParentCard} from '../../../../../src/features/coParent/components/CoParentCard/CoParentCard';

// --- Mocks ---

// 1. Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/components/common/cardStyles', () => ({
  createCardStyles: () => ({
    card: {backgroundColor: 'white'},
    fallback: {backgroundColor: 'gray'},
  }),
}));

// 2. Components
jest.mock(
  '@/shared/components/common/SwipeableActionCard/SwipeableActionCard',
  () => ({
    SwipeableActionCard: ({children, onPressEdit, showEditAction}: any) => {
      const {View, TouchableOpacity, Text} = require('react-native');
      return (
        <View testID="swipeable-card">
          {children}
          {showEditAction && onPressEdit && (
            <TouchableOpacity onPress={onPressEdit} testID="swipe-edit-btn">
              <Text>Edit Action</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
  }),
);

describe('CoParentCard', () => {
  const mockCoParent = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CO_PARENT',
    email: 'john@test.com',
    profilePicture: null,
    companions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly as a standard Co-Parent with initials', () => {
    const {getByText} = render(<CoParentCard coParent={mockCoParent as any} />);

    expect(getByText('John Doe')).toBeTruthy();
    expect(getByText('Co-parent')).toBeTruthy();
    expect(getByText('J')).toBeTruthy();
  });

  it('renders correctly as a Primary Parent', () => {
    const primaryParent = {
      ...mockCoParent,
      role: 'PRIMARY',
      firstName: 'Jane',
    };
    const {getByText} = render(
      <CoParentCard coParent={primaryParent as any} />,
    );

    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText('Primary Parent')).toBeTruthy();
  });

  it('renders profile picture when available', () => {
    const picParent = {
      ...mockCoParent,
      profilePicture: 'https://example.com/pic.jpg',
    };
    const {queryByText} = render(<CoParentCard coParent={picParent as any} />);
    expect(queryByText('J')).toBeNull();
  });

  it('handles missing first/last name for Primary role', () => {
    const unnamedPrimary = {
      ...mockCoParent,
      firstName: undefined,
      lastName: undefined,
      role: 'PRIMARY_OWNER',
    };

    const {getAllByText, getByText} = render(
      <CoParentCard coParent={unnamedPrimary as any} />,
    );

    const elements = getAllByText('Primary Parent');
    expect(elements.length).toBeGreaterThanOrEqual(2);

    expect(getByText('C')).toBeTruthy();
  });

  it('calls onPressView when the card body is pressed', () => {
    const onPressView = jest.fn();
    const {getByText} = render(
      <CoParentCard coParent={mockCoParent as any} onPressView={onPressView} />,
    );

    fireEvent.press(getByText('John Doe'));
    expect(onPressView).toHaveBeenCalled();
  });

  it('calls onPressEdit when the edit action is pressed', () => {
    const onPressEdit = jest.fn();
    const {getByTestId} = render(
      <CoParentCard
        coParent={mockCoParent as any}
        onPressEdit={onPressEdit}
        showEditAction={true}
      />,
    );

    fireEvent.press(getByTestId('swipe-edit-btn'));
    expect(onPressEdit).toHaveBeenCalled();
  });
});
