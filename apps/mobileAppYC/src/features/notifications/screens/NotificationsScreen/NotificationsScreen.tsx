import React, {useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {Images} from '@/assets/images';
import type {AppDispatch, RootState} from '@/app/store';
import {
  selectDisplayNotifications,
  selectUnreadCount,
  selectNotificationFilter,
  selectNotificationSortBy,
  selectUnreadCountByCategory,
} from '../../selectors';
import {markNotificationAsRead, archiveNotification} from '../../thunks';
import {
  setNotificationFilter,
  setSortBy,
  injectMockNotifications,
} from '../../notificationSlice';
import {NotificationCard} from '../../components/NotificationCard/NotificationCard';
import {NotificationFilterPills} from '../../components/NotificationFilterPills/NotificationFilterPills';
// Removed Clear All button for minimal UI
import {mockNotifications} from '../../data/mockNotifications';
import type {Notification, NotificationCategory} from '../../types';

export const NotificationsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();

  // Redux selectors
  const notifications = useSelector(selectDisplayNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const filter = useSelector(selectNotificationFilter);
  const sortBy = useSelector(selectNotificationSortBy);
  const loading = useSelector((state: RootState) => state.notifications.loading);
  const companions = useSelector((state: RootState) => state.companion.companions);
  // Unread counts per category (avoid hooks in nested functions)
  const unreadCounts = {
    all: unreadCount,
    messages: useSelector(selectUnreadCountByCategory('messages')),
    appointments: useSelector(selectUnreadCountByCategory('appointments')),
    tasks: useSelector(selectUnreadCountByCategory('tasks')),
    documents: useSelector(selectUnreadCountByCategory('documents')),
    health: useSelector(selectUnreadCountByCategory('health')),
    dietary: useSelector(selectUnreadCountByCategory('dietary')),
    hygiene: useSelector(selectUnreadCountByCategory('hygiene')),
    payment: useSelector(selectUnreadCountByCategory('payment')),
  } as const;

  const [refreshing, setRefreshing] = React.useState(false);

  // Initialize with mock data on mount
  useEffect(() => {
    if (notifications.length === 0) {
      dispatch(injectMockNotifications(mockNotifications));
    }
  }, [dispatch, notifications.length]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 300);
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback(
    (selectedFilter: NotificationCategory) => {
      dispatch(setNotificationFilter(selectedFilter));
    },
    [dispatch],
  );

  // Handle status sort toggle (New vs Seen)
  const handleSortChange = useCallback(
    (selectedSort: 'new' | 'seen') => {
      dispatch(setSortBy(selectedSort));
    },
    [dispatch],
  );

  // Handle notification tap (navigate by deepLink/relatedType)
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (notification.status === 'unread') {
        dispatch(markNotificationAsRead({notificationId: notification.id}));
      }

      const deepLink = notification.deepLink;
      const relatedType = notification.relatedType;
      const relatedId = notification.relatedId;

      // Attempt deep-link based navigation
      try {
        if (deepLink && typeof deepLink === 'string') {
          if (deepLink.startsWith('/tasks/') && relatedId) {
            (navigation as any).navigate('Tasks', {
              screen: 'TaskView',
              params: {taskId: relatedId},
            });
            return;
          }
          if (deepLink.startsWith('/appointments/') && relatedId) {
            (navigation as any).navigate('Appointments', {
              screen: 'ViewAppointment',
              params: {appointmentId: relatedId},
            });
            return;
          }
          if (deepLink.startsWith('/documents/') && relatedId) {
            (navigation as any).navigate('Documents', {
              screen: 'DocumentPreview',
              params: {documentId: relatedId},
            });
            return;
          }
        }
      } catch (e) {
        console.warn('[Notifications] Deep link navigation failed', e);
      }

      // Fallback based on relatedType
      try {
        if (relatedType && relatedId) {
          if (relatedType === 'task') {
            (navigation as any).navigate('Tasks', {
              screen: 'TaskView',
              params: {taskId: relatedId},
            });
          } else if (relatedType === 'appointment') {
            (navigation as any).navigate('Appointments', {
              screen: 'ViewAppointment',
              params: {appointmentId: relatedId},
            });
          } else if (relatedType === 'document') {
            (navigation as any).navigate('Documents', {
              screen: 'DocumentPreview',
              params: {documentId: relatedId},
            });
          }
        }
      } catch (e) {
        console.warn('[Notifications] relatedType navigation failed', e);
      }
    },
    [dispatch, navigation],
  );

  // Handle dismiss: mark as read so item moves to Seen tab
  const handleDismiss = useCallback(
    (notificationId: string) => {
      dispatch(markNotificationAsRead({notificationId}));
    },
    [dispatch],
  );

  // Handle archive
  const handleArchive = useCallback(
    (notificationId: string) => {
      dispatch(archiveNotification({notificationId}));
    },
    [dispatch],
  );

  // Clear All removed by design

  // Get companion by ID
  const getCompanionById = useCallback(
    (companionId: string) => {
      return companions.find(c => c.id === companionId);
    },
    [companions],
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Image source={Images.notificationIcon} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        You'll see notifications here when something important happens
      </Text>
    </View>
  );

  // Render notification item
  const renderNotificationItem = ({item}: {item: Notification}) => {
    const comp = getCompanionById(item.companionId);
    const companion = comp
      ? {name: comp.name, profileImage: comp.profileImage ?? undefined}
      : undefined;
    return (
      <NotificationCard
        notification={item}
        companion={companion}
        onPress={() => handleNotificationPress(item)}
        onDismiss={() => handleDismiss(item.id)}
        onArchive={() => handleArchive(item.id)}
        swipeEnabled={sortBy === 'new'}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Header
        title="Notifications"
        showBackButton
        onBack={() => (navigation as any).goBack?.()}
      />

      {/* Header content placed above FlatList to preserve internal scroll state */}
      <View style={styles.headerContent}>
        <View style={styles.filtersWrapper}>
          <NotificationFilterPills
            selectedFilter={filter}
            onFilterChange={handleFilterChange}
            unreadCounts={unreadCounts as any}
          />
        </View>

        <View style={styles.segmentContainer}>
          <View style={styles.segmentInner}>
            {(['new', 'seen'] as const).map(option => (
              <TouchableOpacity
                key={option}
                onPress={() => handleSortChange(option)}
                activeOpacity={0.9}
                style={[styles.segmentItem, sortBy === option && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, sortBy === option && styles.segmentTextActive]}>
                  {option === 'new' ? 'New' : 'Seen'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[10],
      gap: theme.spacing[3],
    },
    headerContent: {
      marginBottom: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
    },
    filtersWrapper: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[3],
    },
    segmentContainer: {
      marginTop: theme.spacing[2],
      marginBottom: theme.spacing[3],
      // horizontal padding inherited from headerContent
    },
    segmentInner: {
      flexDirection: 'row',
      backgroundColor: '#EAEAEA',
      borderRadius: 12,
      padding: 4,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: {width: 0, height: 1},
    },
    segmentText: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    segmentTextActive: {
      color: theme.colors.text,
      fontWeight: '700',
    },
    // Clear All styles removed
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
      minHeight: 300,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      marginBottom: theme.spacing[4],
      tintColor: theme.colors.textSecondary,
      opacity: 0.5,
    },
    emptyTitle: {
      ...theme.typography.titleLarge,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
      textAlign: 'center',
    },
    emptySubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
