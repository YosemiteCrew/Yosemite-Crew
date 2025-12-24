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
import {fetchNotificationsForCompanion, markNotificationAsRead, archiveNotification} from '../../thunks';
import {
  setNotificationFilter,
  setSortBy,
} from '../../notificationSlice';
import {NotificationCard} from '../../components/NotificationCard/NotificationCard';
import {NotificationFilterPills} from '../../components/NotificationFilterPills/NotificationFilterPills';
// Removed Clear All button for minimal UI
import type {Notification, NotificationCategory} from '../../types';
import {useAuth} from '@/features/auth/context/AuthContext';

const NAVIGATION_TARGETS = {
  task: {
    stack: 'Tasks',
    screen: 'TaskView',
    param: 'taskId',
  },
  appointment: {
    stack: 'Appointments',
    screen: 'ViewAppointment',
    param: 'appointmentId',
  },
  document: {
    stack: 'Documents',
    screen: 'DocumentPreview',
    param: 'documentId',
  },
} as const;

type NavigationTarget = keyof typeof NAVIGATION_TARGETS;

const DEEP_LINK_TARGETS: Array<{prefix: string; type: NavigationTarget}> = [
  {prefix: '/tasks/', type: 'task'},
  {prefix: '/appointments/', type: 'appointment'},
  {prefix: '/documents/', type: 'document'},
];

export const NotificationsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation();
  const {isLoggedIn} = useAuth();

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
    appointments: useSelector(selectUnreadCountByCategory('appointments')),
    payment: useSelector(selectUnreadCountByCategory('payment')),
    health: useSelector(selectUnreadCountByCategory('health')),
    messages: useSelector(selectUnreadCountByCategory('messages')),
    tasks: useSelector(selectUnreadCountByCategory('tasks')),
    documents: useSelector(selectUnreadCountByCategory('documents')),
  } as const;

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    dispatch(fetchNotificationsForCompanion({companionId: 'default-companion'}));
  }, [dispatch, isLoggedIn]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isLoggedIn) {
        await dispatch(
          fetchNotificationsForCompanion({companionId: 'default-companion'}),
        ).unwrap();
      }
    } catch (error) {
      console.warn('[Notifications] Refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, isLoggedIn]);

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

  const navigateToRelatedEntity = useCallback(
    (type: NavigationTarget, relatedId: string) => {
      const config = NAVIGATION_TARGETS[type];
      (navigation as any).navigate(config.stack, {
        screen: config.screen,
        params: {[config.param]: relatedId},
      });
    },
    [navigation],
  );

  const tryNavigateByDeepLink = useCallback(
    (deepLink?: string | null, relatedId?: string | null) => {
      if (!deepLink || typeof deepLink !== 'string' || !relatedId) {
        return false;
      }

      try {
        const match = DEEP_LINK_TARGETS.find(target =>
          deepLink.startsWith(target.prefix),
        );
        if (match) {
          navigateToRelatedEntity(match.type, relatedId);
          return true;
        }
      } catch (error) {
        console.warn('[Notifications] Deep link navigation failed', error);
      }

      return false;
    },
    [navigateToRelatedEntity],
  );

  const tryNavigateByRelatedType = useCallback(
    (
      relatedType?: Notification['relatedType'],
      relatedId?: string | null,
    ) => {
      if (!relatedType || !relatedId) {
        return false;
      }

      if (!Object.hasOwn(NAVIGATION_TARGETS, relatedType)) {
        return false;
      }

      try {
        navigateToRelatedEntity(relatedType as NavigationTarget, relatedId);
        return true;
      } catch (error) {
        console.warn('[Notifications] relatedType navigation failed', error);
      }

      return false;
    },
    [navigateToRelatedEntity],
  );

  // Handle notification tap (navigate by deepLink/relatedType)
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (notification.status === 'unread') {
        dispatch(markNotificationAsRead({notificationId: notification.id}));
      }

      const didNavigateByDeepLink = tryNavigateByDeepLink(
        notification.deepLink,
        notification.relatedId,
      );

      if (!didNavigateByDeepLink) {
        tryNavigateByRelatedType(notification.relatedType, notification.relatedId);
      }
    },
    [dispatch, tryNavigateByDeepLink, tryNavigateByRelatedType],
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
      <Image source={Images.emptyNotifications} style={styles.emptyImage} />
      <Text style={styles.emptyTitle}>Nothing in the box!</Text>
      <Text style={styles.emptySubtitle}>
        Your notification box is empty right now.{'\n'}
        Sit, stay, and we’ll fetch updates soon.
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['10'],
      gap: theme.spacing['3'],
    },
    headerContent: {
      marginBottom: theme.spacing['2'],
      paddingHorizontal: theme.spacing['4'],
    },
    filtersWrapper: {
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['3'],
    },
    segmentContainer: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['3'],
      // horizontal padding inherited from headerContent
    },
    segmentInner: {
      flexDirection: 'row',
      backgroundColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['1'],
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: theme.spacing['2.5'],
      borderRadius: theme.borderRadius.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentItemActive: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.xs,
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
      paddingHorizontal: theme.spacing['4'],
      minHeight: 300,
    },
    emptyImage: {
      height: theme.spacing['40'],
      width: theme.spacing['40'],
      resizeMode: 'contain',
      marginBottom: theme.spacing['4'],
    },
    emptyTitle: {
      ...theme.typography.businessSectionTitle20,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
      textAlign: 'center',
    },
    emptySubtitle: {
      ...theme.typography.subtitleRegular14,
      color: theme.colors.secondary,
      textAlign: 'center',
      lineHeight: theme.typography.subtitleRegular14.lineHeight,
    },
  });
