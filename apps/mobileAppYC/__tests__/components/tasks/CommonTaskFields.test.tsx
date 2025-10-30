import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {useSelector} from 'react-redux';
// FIX 1: Update component import path
import {CommonTaskFields} from '@/features/tasks/components/CommonTaskFields/CommonTaskFields';
import {selectAuthUser} from '@/features/auth/selectors';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';
import type {User} from '@/features/auth/types';

// --- Mocks ---

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));
const mockUseSelector = useSelector as unknown as jest.Mock;

jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: jest.fn(),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: 'dropdown.png',
  },
}));

// FIX 2: Update mocked util path
jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 16, height: 16},
  })),
}));

// FIX 3: Update mocked component path
jest.mock('@/shared/components/common', () => {
  const MockView = require('react-native').View;
  return {
    Input: jest.fn(({value, onChangeText, ...props}) => (
      <MockView
        testID="mock-input-additionalNote"
        value={value}
        onChangeText={onChangeText}
        {...props}
      />
    )),
    TouchableInput: jest.fn(({value, onPress, ...props}) => (
      <MockView
        testID="mock-touchable-input-assignedTo"
        value={value}
        onPress={onPress}
        {...props}
      />
    )),
  };
});

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockImage = (props: any) => <MockView testID="mock-image" {...props} />;
  MockImage.displayName = 'Image';
  return MockImage;
});

// --- Mock Data ---

const mockTheme = {
  spacing: {1: 4, 3: 8, 4: 12},
  typography: {
    labelXsBold: {fontSize: 12, fontWeight: 'bold'},
  },
  colors: {
    error: 'red',
  },
};

const mockCurrentUser: User = {
  id: 'user-1',
  firstName: 'Current',
  email: 'current@user.com',
} as User;

// --- Helper ---

interface TestProps {
  formData?: Partial<TaskFormData>;
  errors?: Partial<TaskFormErrors>;
  currentUser?: User | null;
}

const renderComponent = ({
  formData = {},
  errors = {},
  currentUser = mockCurrentUser,
}: TestProps = {}) => {
  mockUseSelector.mockImplementation(selector => {
    if (selector === selectAuthUser) {
      return currentUser;
    }
    return undefined;
  });

  const mockUpdateField = jest.fn();
  const mockOnOpenAssignTaskSheet = jest.fn();

  const props = {
    formData: {
      assignedTo: undefined,
      additionalNote: '',
      ...formData,
    } as TaskFormData,
    errors: errors as TaskFormErrors,
    updateField: mockUpdateField,
    onOpenAssignTaskSheet: mockOnOpenAssignTaskSheet,
    theme: mockTheme,
  };

  render(<CommonTaskFields {...props} />);

  return {mockUpdateField, mockOnOpenAssignTaskSheet};
};

// --- Tests ---

describe('CommonTaskFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Interactions', () => {
    it('calls onOpenAssignTaskSheet when "Assign to" is pressed', () => {
      const {mockOnOpenAssignTaskSheet} = renderComponent();
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      fireEvent.press(assignInput);
      expect(mockOnOpenAssignTaskSheet).toHaveBeenCalledTimes(1);
    });

    it('calls updateField when "Additional note" text is changed', () => {
      const {mockUpdateField} = renderComponent();
      const noteInput = screen.getByTestId('mock-input-additionalNote');
      noteInput.props.onChangeText('New note');
      expect(mockUpdateField).toHaveBeenCalledTimes(1);
      expect(mockUpdateField).toHaveBeenCalledWith(
        'additionalNote',
        'New note',
      );
    });
  });

  describe('Assigned User Logic (getAssignedUserName)', () => {
    it('shows placeholder and no label when no user is assigned', () => {
      renderComponent({formData: {assignedTo: undefined}});
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('');
      expect(assignInput.props.placeholder).toBe('Assign to');
      expect(assignInput.props.label).toBeUndefined();
    });

    it('shows current user first name when assignedTo matches currentUser id', () => {
      renderComponent({formData: {assignedTo: 'user-1'}});
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('Current');
      expect(assignInput.props.label).toBe('Assign to');
    });

    it('shows current user email as fallback if firstName is missing', () => {
      const userWithEmail: User = {
        id: 'user-1',
        email: 'current@user.com',
      } as User;
      renderComponent({
        formData: {assignedTo: 'user-1'},
        currentUser: userWithEmail,
      });
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('current@user.com');
    });

    it('shows "You" as ultimate fallback if firstName and email are missing', () => {
      const userNoDetails: User = {id: 'user-1'} as User;
      renderComponent({
        formData: {assignedTo: 'user-1'},
        currentUser: userNoDetails,
      });
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('You');
    });

    it('shows the ID as fallback if assignedTo is a different user', () => {
      renderComponent({formData: {assignedTo: 'user-2'}});
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('user-2');
      expect(assignInput.props.label).toBe('Assign to');
    });

    it('handles the case where currentUser is null', () => {
      renderComponent({
        formData: {assignedTo: 'user-1'},
        currentUser: null,
      });
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.value).toBe('user-1');
    });
  });

  describe('Error Display', () => {
    it('passes the assignedTo error to the TouchableInput', () => {
      renderComponent({errors: {assignedTo: 'This field is required.'}});
      const assignInput = screen.getByTestId('mock-touchable-input-assignedTo');
      expect(assignInput.props.error).toBe('This field is required.');
    });

    it('renders the additionalNote error message when present', () => {
      renderComponent({errors: {additionalNote: 'Note is too long.'}});
      const errorText = screen.getByText('Note is too long.');
      expect(errorText).toBeTruthy();
      expect(errorText.props.style).toEqual(
        expect.objectContaining({
          color: mockTheme.colors.error,
          fontSize: 12,
        }),
      );
    });

    it('does not render the additionalNote error message when not present', () => {
      renderComponent({errors: {}});
      const errorText = screen.queryByText('Note is too long.');
      expect(errorText).toBeNull();
    });
  });
});
