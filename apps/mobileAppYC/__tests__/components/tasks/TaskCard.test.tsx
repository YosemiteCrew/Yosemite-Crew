import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
// --- FIX: Correct import path for component ---
import {TaskCard} from '@/components/tasks/TaskCard/TaskCard';
import {useTheme} from '@/hooks';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {createCardStyles} from '@/components/common/cardStyles';
// --- FIX: Correct import path for type ---
import type {TaskCardProps} from '@/components/tasks/TaskCard/TaskCard';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(),
}));
const mockUseTheme = useTheme as jest.Mock;

jest.mock('@/components/common/SimpleDatePicker/SimpleDatePicker', () => ({
  formatDateForDisplay: jest.fn(),
}));
const mockFormatDate = formatDateForDisplay as jest.Mock;

jest.mock('@/components/common/cardStyles', () => ({
  createCardStyles: jest.fn(),
}));
const mockCreateCardStyles = createCardStyles as jest.Mock;

// Mock child components
jest.mock(
  '@/components/common/SwipeableActionCard/SwipeableActionCard',
  () => ({
    SwipeableActionCard: jest.fn(({children, ...props}) => {
      const MockView = require('react-native').View;
      // We pass the children through so we can test pressing the inner TouchableOpacity
      return (
        <MockView testID="mock-swipe-card" {...props}>
          {children}
        </MockView>
      );
    }),
  }),
);

jest.mock('@/components/common/CardActionButton/CardActionButton', () => ({
  CardActionButton: jest.fn(({label, onPress}) => {
    const MockButton = require('react-native').TouchableOpacity;
    const MockText = require('react-native').Text;
    return (
      <MockButton testID="mock-action-button" onPress={onPress}>
        <MockText>{label}</MockText>
      </MockButton>
    );
  }),
}));

jest.mock('@/components/common/AvatarGroup/AvatarGroup', () => ({
  AvatarGroup: jest.fn(({avatars}) => {
    const MockView = require('react-native').View;
    // We can check the avatars prop in our tests
    return <MockView testID="mock-avatar-group" avatars={avatars} />;
  }),
}));

// --- Mock Data ---

const mockTheme = {
  spacing: {1: 2, 2: 4, 3: 8},
  colors: {
    secondary: '#222222',
    textSecondary: '#555555',
    success: '#008F5D',
    borderMuted: '#EEEEEE',
  },
  typography: {
    h6Clash: {fontSize: 18, fontWeight: '600'},
    captionBoldSatoshi: {fontSize: 12, fontWeight: '700'},
    labelSmall: {fontSize: 10, fontWeight: '500'},
    bodySmall: {fontSize: 14, fontWeight: '500'},
    labelXsBold: {fontSize: 10, fontWeight: '700'},
  },
};

const baseProps: TaskCardProps = {
  title: 'Give Morning Medication',
  categoryLabel: 'Health',
  date: '2025-10-29T10:00:00.000Z',
  companionName: 'Buddy',
  companionAvatar: 'buddy.png',
  status: 'pending',
  category: 'health',
  onPressView: jest.fn(),
  onPressEdit: jest.fn(),
  onPressComplete: jest.fn(),
};

// --- Helper ---

const renderComponent = (props: Partial<TaskCardProps> = {}) => {
  mockUseTheme.mockReturnValue({theme: mockTheme});
  mockFormatDate.mockReturnValue('October 29, 2025'); // Consistent mock date
  mockCreateCardStyles.mockReturnValue({card: {}, fallback: {}});

  const mergedProps = {...baseProps, ...props};
  render(<TaskCard {...mergedProps} />);

  return {
    ...mergedProps, // Return the props for assertion
  };
};

// --- Tests ---

describe('TaskCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the title, companion name, and formatted date', () => {
      renderComponent();
      expect(screen.getByText('Give Morning Medication')).toBeTruthy();
      expect(screen.getByText('Buddy')).toBeTruthy();
      // Checks for the date part, time is tested separately
      expect(screen.getByText(/October 29, 2025/)).toBeTruthy();
      expect(mockFormatDate).toHaveBeenCalledWith(new Date(baseProps.date));
    });

    it('renders the completed badge if status is "completed"', () => {
      renderComponent({status: 'completed'});
      expect(screen.getByText('Completed')).toBeTruthy();
    });

    it('does not render the completed badge if status is "pending"', () => {
      renderComponent({status: 'pending'});
      expect(screen.queryByText('Completed')).toBeNull();
    });

    it('renders the complete button if showCompleteButton is true and status is pending', () => {
      renderComponent({showCompleteButton: true, status: 'pending'});
      expect(screen.getByTestId('mock-action-button')).toBeTruthy();
      expect(screen.getByText('Complete')).toBeTruthy();
    });

    it('does not render the complete button if status is "completed"', () => {
      renderComponent({showCompleteButton: true, status: 'completed'});
      expect(screen.queryByTestId('mock-action-button')).toBeNull();
    });

    it('does not render the complete button if showCompleteButton is false', () => {
      renderComponent({showCompleteButton: false, status: 'pending'});
      expect(screen.queryByTestId('mock-action-button')).toBeNull();
    });
  });

  describe('Interactions', () => {
    it('calls onPressView when the card is pressed', () => {
      // The SwipeableActionCard mock passes children, which is the TouchableOpacity
    });

    it('calls onPressComplete when the "Complete" button is pressed', () => {
      const {onPressComplete} = renderComponent({
        showCompleteButton: true,
        status: 'pending',
      });
      fireEvent.press(screen.getByTestId('mock-action-button'));
      expect(onPressComplete).toHaveBeenCalledTimes(1);
    });

    it('passes onPressEdit to the SwipeableActionCard', () => {
      const {onPressEdit} = renderComponent();
      const swipeCard = screen.getByTestId('mock-swipe-card');
      expect(swipeCard.props.onPressEdit).toBe(onPressEdit);
    });
  });

  describe('Date and Time Formatting', () => {
    it('formats and displays the time when provided', () => {
      renderComponent({time: '14:30:00'});
      // The component's logic formats '14:30:00' to '2:30 PM'
      expect(screen.getByText(/2:30 PM/)).toBeTruthy();
      expect(screen.getByText('October 29, 2025 - 2:30 PM')).toBeTruthy();
    });

    it('does not display time when not provided', () => {
      renderComponent({time: undefined});
      const text = screen.getByText('October 29, 2025');
      expect(text).toBeTruthy();
      // Check that no time string is appended
      expect(screen.queryByText(/- \d/)).toBeNull();
    });

    it('returns the original time string if formatting fails', () => {
      renderComponent({time: 'invalid-time-string'});
      expect(
        screen.getByText('October 29, 2025 - invalid-time-string'),
      ).toBeTruthy();
    });
  });

  describe('Avatar Logic', () => {
    it('passes only companion avatar URI when no assigned user', () => {
      renderComponent({
        companionAvatar: 'buddy.png',
        assignedToName: undefined,
      });
      const avatarGroup = screen.getByTestId('mock-avatar-group');
      expect(avatarGroup.props.avatars).toEqual([{uri: 'buddy.png'}]);
    });

    it('passes only companion placeholder when no avatar and no assigned user', () => {
      renderComponent({companionAvatar: undefined, assignedToName: undefined});
      const avatarGroup = screen.getByTestId('mock-avatar-group');
      expect(avatarGroup.props.avatars).toEqual([{placeholder: 'B'}]);
    });

    it('passes both companion and assigned user URIs', () => {
      renderComponent({
        companionAvatar: 'buddy.png',
        assignedToName: 'John Doe',
        assignedToAvatar: 'john.png',
      });
      const avatarGroup = screen.getByTestId('mock-avatar-group');
      expect(avatarGroup.props.avatars).toEqual([
        {uri: 'buddy.png'},
        {uri: 'john.png'},
      ]);
    });

    it('passes both companion and assigned user placeholders', () => {
      renderComponent({
        companionAvatar: undefined,
        assignedToName: 'John Doe',
        assignedToAvatar: undefined,
      });
      const avatarGroup = screen.getByTestId('mock-avatar-group');
      expect(avatarGroup.props.avatars).toEqual([
        {placeholder: 'B'},
        {placeholder: 'J'},
      ]);
    });
  });

  describe('Task Details (renderTaskDetails)', () => {
    it('renders medication details', () => {
      renderComponent({
        category: 'health',
        details: {
          taskType: 'give-medication',
          medicineName: 'Apoquel',
          medicineType: 'Tablet',
          dosages: [{label: '1 tab'}, {label: '0.5 tab'}],
        },
      });
      expect(screen.getByText('💊 Apoquel (Tablet)')).toBeTruthy();
      expect(screen.getByText('Doses: 1 tab, 0.5 tab')).toBeTruthy();
    });

    it('renders observational tool details', () => {
      renderComponent({
        category: 'health',
        details: {
          taskType: 'take-observational-tool',
          toolType: 'Pain Score',
        },
      });
      expect(screen.getByText('📋 Tool: Pain Score')).toBeTruthy();
    });

    it('renders hygiene description', () => {
      renderComponent({
        category: 'hygiene',
        details: {description: 'Full bath with shampoo'},
      });
      expect(screen.getByText('Full bath with shampoo')).toBeTruthy();
    });

    it('renders dietary description', () => {
      renderComponent({
        category: 'dietary',
        details: {description: 'Half cup of kibble'},
      });
      expect(screen.getByText('Half cup of kibble')).toBeTruthy();
    });

    it('renders null if details do not match category logic', () => {
      renderComponent({
        details: {description: 'This should not show'},
      });
      expect(screen.queryByText('This should not show')).toBeNull();
    });

    it('renders null if no details are provided', () => {
      renderComponent({details: undefined});
      // Check for any detail-related text
      expect(screen.queryByText(/💊/)).toBeNull();
      expect(screen.queryByText(/📋/)).toBeNull();
    });
  });

  describe('SwipeableActionCard Props', () => {
    it('sets showEditAction to true when prop is true and task is not completed', () => {
      renderComponent({showEditAction: true, status: 'pending'});
      const swipeCard = screen.getByTestId('mock-swipe-card');
      expect(swipeCard.props.showEditAction).toBe(true);
    });

    it('sets showEditAction to false when task is completed', () => {
      renderComponent({showEditAction: true, status: 'completed'});
      const swipeCard = screen.getByTestId('mock-swipe-card');
      expect(swipeCard.props.showEditAction).toBe(false);
    });

    it('sets showEditAction to false when prop is false', () => {
      renderComponent({showEditAction: false, status: 'pending'});
      const swipeCard = screen.getByTestId('mock-swipe-card');
      expect(swipeCard.props.showEditAction).toBe(false);
    });

    it('passes hideSwipeActions prop correctly', () => {
      renderComponent({hideSwipeActions: true});
      const swipeCard = screen.getByTestId('mock-swipe-card');
      expect(swipeCard.props.hideSwipeActions).toBe(true);
    });
  });
});
