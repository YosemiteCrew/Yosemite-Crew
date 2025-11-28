import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {NotificationsScreen} from '../../../src/features/notifications/screens/NotificationsScreen/NotificationsScreen';
import {useDispatch, useSelector} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {
  markNotificationAsRead,
  archiveNotification,
} from '../../../src/features/notifications/thunks';
import {
  setNotificationFilter,
  setSortBy,
  injectMockNotifications,
} from '../../../src/features/notifications/notificationSlice';
import {
  selectDisplayNotifications,
  selectUnreadCount,
  selectNotificationFilter,
  selectNotificationSortBy,
  selectUnreadCountByCategory,
} from '../../../src/features/notifications/selectors';
// Import ScrollView to use in UNSAFE_getByType
import {ScrollView} from 'react-native';

// --- 1. Mocks ---

// Mock Redux
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

// Mock Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// Mock Theme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        primary: '#000',
        border: '#ccc',
        cardBackground: '#eee',
        text: '#000',
        textSecondary: '#666',
        secondary: '#888',
      },
      spacing: {2: 8, 3: 12, 4: 16, 10: 40},
      typography: {
        labelSmall: {fontSize: 12},
        businessSectionTitle20: {fontSize: 20},
        subtitleRegular14: {fontSize: 14},
      },
    },
  }),
}));

// Mock Child Components
// We use require() inside the mock to prevent "out-of-scope variable" errors
jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View testID="header-view">
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back-btn">
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '../../../src/features/notifications/components/NotificationFilterPills/NotificationFilterPills',
  () => ({
    NotificationFilterPills: ({onFilterChange}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID="filter-pills"
          onPress={() => onFilterChange('appointments')}>
          <Text>Filter Pills</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock(
  '../../../src/features/notifications/components/NotificationCard/NotificationCard',
  () => ({
    NotificationCard: ({notification, onPress, onDismiss, onArchive}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          testID={`notification-card-${notification.id}`}
          onPress={onPress}>
          <Text>{notification.title}</Text>
          <TouchableOpacity
            testID={`dismiss-btn-${notification.id}`}
            onPress={onDismiss}>
            <Text>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`archive-btn-${notification.id}`}
            onPress={onArchive}>
            <Text>Archive</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
  }),
);

// Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    emptyNotifications: {uri: 'empty-img'},
  },
}));

// Mock Thunks/Actions
jest.mock('../../../src/features/notifications/thunks', () => ({
  markNotificationAsRead: jest.fn(),
  archiveNotification: jest.fn(),
}));
jest.mock('../../../src/features/notifications/notificationSlice', () => ({
  setNotificationFilter: jest.fn(),
  setSortBy: jest.fn(),
  injectMockNotifications: jest.fn(),
}));

// Mock Selectors
jest.mock('../../../src/features/notifications/selectors', () => ({
  selectDisplayNotifications: jest.fn(),
  selectUnreadCount: jest.fn(),
  selectNotificationFilter: jest.fn(),
  selectNotificationSortBy: jest.fn(),
  selectUnreadCountByCategory: jest.fn(),
}));

// --- 2. Test Data ---
const mockNotificationsData = [
  {
    id: '1',
    title: 'Task Notif',
    status: 'unread',
    companionId: 'comp1',
    relatedType: 'task',
    relatedId: 'task-123',
  },
  {
    id: '2',
    title: 'DeepLink Notif',
    status: 'read',
    companionId: 'comp2',
    deepLink: '/appointments/appt-123',
    relatedId: 'appt-123',
  },
];

// --- 3. Tests ---
describe('NotificationsScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // FIX: Cast to unknown first to satisfy TypeScript
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });

    // Default Selector Setup
    // FIX: Cast to unknown first to satisfy TypeScript
    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      if (selector === selectDisplayNotifications) {
        return mockNotificationsData;
      }
      if (selector === selectUnreadCount) {
        return 1;
      }
      if (selector === selectNotificationFilter) {
        return 'all';
      }
      if (selector === selectNotificationSortBy) {
        return 'new';
      }
      // Mock inline state selectors
      if (typeof selector === 'function') {
        const mockState = {
          notifications: {loading: false},
          companion: {
            companions: [{id: 'comp1', name: 'Buddy'}],
          },
        };
        try {
          return selector(mockState);
        } catch {
          return 0;
        }
      }
      return undefined;
    });

    // Mock factory selector
    (selectUnreadCountByCategory as jest.Mock).mockReturnValue(() => 0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders list with notifications correctly', () => {
    const {getByText} = render(<NotificationsScreen />);

    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Task Notif')).toBeTruthy();
    expect(getByText('DeepLink Notif')).toBeTruthy();
    expect(getByText('New')).toBeTruthy();
    expect(getByText('Seen')).toBeTruthy();
  });

  it('renders empty state and injects mock data when list is empty', () => {
    // Override selector to return empty list
    // FIX: Cast to unknown first
    (useSelector as unknown as jest.Mock).mockImplementation(selector => {
      if (selector === selectDisplayNotifications) {
        return [];
      }
      if (typeof selector === 'function') {
        return selector({
          notifications: {loading: false},
          companion: {companions: []},
        });
      }
    });

    const {getByText} = render(<NotificationsScreen />);

    expect(getByText('Nothing in the box!')).toBeTruthy();
    // Verify mock injection logic on mount
    expect(mockDispatch).toHaveBeenCalledWith(
      injectMockNotifications(expect.anything()),
    );
  });

  it('handles filter change', () => {
    const {getByTestId} = render(<NotificationsScreen />);
    fireEvent.press(getByTestId('filter-pills'));
    expect(mockDispatch).toHaveBeenCalledWith(
      setNotificationFilter('appointments'),
    );
  });

  it('handles sort toggle', () => {
    const {getByText} = render(<NotificationsScreen />);

    fireEvent.press(getByText('Seen'));
    expect(mockDispatch).toHaveBeenCalledWith(setSortBy('seen'));

    fireEvent.press(getByText('New'));
    expect(mockDispatch).toHaveBeenCalledWith(setSortBy('new'));
  });

  it('triggers refresh logic', () => {
    const {UNSAFE_getByType} = render(<NotificationsScreen />);
    // FIX: Use the imported ScrollView component reference, not a string
    const scrollComponent = UNSAFE_getByType(ScrollView);

    const {refreshControl} = scrollComponent.props;

    // Trigger refresh
    act(() => {
      refreshControl.props.onRefresh();
    });

    // Advance timers to hit the setTimeout inside handleRefresh
    act(() => {
      jest.advanceTimersByTime(300);
    });
  });

  describe('Interaction & Navigation Logic', () => {
    it('handles dismissing a notification', () => {
      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('dismiss-btn-1'));
      expect(mockDispatch).toHaveBeenCalledWith(
        markNotificationAsRead({notificationId: '1'}),
      );
    });

    it('handles archiving a notification', () => {
      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('archive-btn-1'));
      expect(mockDispatch).toHaveBeenCalledWith(
        archiveNotification({notificationId: '1'}),
      );
    });

    it('navigates via relatedType (Task)', () => {
      const {getByTestId} = render(<NotificationsScreen />);
      // ID 1 is unread, has relatedType 'task'
      fireEvent.press(getByTestId('notification-card-1'));

      // Should mark as read first
      expect(mockDispatch).toHaveBeenCalledWith(
        markNotificationAsRead({notificationId: '1'}),
      );

      // Should navigate
      expect(mockNavigate).toHaveBeenCalledWith('Tasks', {
        screen: 'TaskView',
        params: {taskId: 'task-123'},
      });
    });

    it('navigates via Deep Link (Appointment)', () => {
      const {getByTestId} = render(<NotificationsScreen />);
      // ID 2 is read (no dispatch), has deepLink
      fireEvent.press(getByTestId('notification-card-2'));

      expect(mockDispatch).not.toHaveBeenCalledWith(
        markNotificationAsRead({notificationId: '2'}),
      );

      expect(mockNavigate).toHaveBeenCalledWith('Appointments', {
        screen: 'ViewAppointment',
        params: {appointmentId: 'appt-123'},
      });
    });

    it('handles header back navigation', () => {
      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('header-back-btn'));
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Edge Cases & Error Handling', () => {
    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      (console.warn as jest.Mock).mockRestore();
    });

    it('fails gracefully when deep link does not match any target', () => {
      // FIX: Cast to unknown first
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectDisplayNotifications) {
          return [
            {
              id: '3',
              status: 'read',
              deepLink: '/unknown/path',
              relatedId: '123',
            },
          ];
        }
        if (typeof selector === 'function') {
          return selector({
            notifications: {},
            companion: {companions: []},
          });
        }
      });

      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('notification-card-3'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('fails gracefully when relatedType is missing/invalid', () => {
      // FIX: Cast to unknown first
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectDisplayNotifications) {
          return [
            {
              id: '4',
              status: 'read',
              relatedType: 'unknownType',
              relatedId: '123',
            },
            {
              id: '5',
              status: 'read',
            },
          ];
        }
        if (typeof selector === 'function') {
          return selector({
            notifications: {},
            companion: {companions: []},
          });
        }
      });

      const {getByTestId} = render(<NotificationsScreen />);

      fireEvent.press(getByTestId('notification-card-4'));
      expect(mockNavigate).not.toHaveBeenCalled();

      fireEvent.press(getByTestId('notification-card-5'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('catches errors during deep link navigation', () => {
      // FIX: Cast to unknown first
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectDisplayNotifications) {
          return [
            {
              id: '6',
              status: 'read',
              deepLink: '/tasks/error',
              relatedId: '123',
            },
          ];
        }
        if (typeof selector === 'function') {
          return selector({
            notifications: {},
            companion: {companions: []},
          });
        }
      });

      mockNavigate.mockImplementationOnce(() => {
        throw new Error('Navigation Boom');
      });

      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('notification-card-6'));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Deep link navigation failed'),
        expect.any(Error),
      );
    });

    it('catches errors during related type navigation', () => {
      // FIX: Cast to unknown first
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectDisplayNotifications) {
          return [
            {
              id: '7',
              status: 'read',
              relatedType: 'task',
              relatedId: '123',
            },
          ];
        }
        if (typeof selector === 'function') {
          return selector({
            notifications: {},
            companion: {companions: []},
          });
        }
      });

      mockNavigate.mockImplementationOnce(() => {
        throw new Error('Navigation Boom');
      });

      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('notification-card-7'));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('relatedType navigation failed'),
        expect.any(Error),
      );
    });

    it('handles missing deepLink or relatedId safely', () => {
      // FIX: Cast to unknown first
      (useSelector as unknown as jest.Mock).mockImplementation(selector => {
        if (selector === selectDisplayNotifications) {
          return [
            {
              id: '8',
              status: 'read',
              deepLink: null,
              relatedId: null,
            },
          ];
        }
        if (typeof selector === 'function') {
          return selector({
            notifications: {},
            companion: {companions: []},
          });
        }
      });

      const {getByTestId} = render(<NotificationsScreen />);
      fireEvent.press(getByTestId('notification-card-8'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
