import React, {useEffect, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  RefreshControl,
} from 'react-native';
import type {SectionListRenderItem, ViewStyle} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
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
  selectNotificationsLoadFailure,
  selectHasHydratedCompanion,
  selectUnreadCountByCategory,
} from '../../selectors';
import {ListErrorState} from '@/shared/components/common/ListErrorState/ListErrorState';
import {resolveListPhase} from '@/shared/utils/listPhase';
import {
  fetchNotificationsForCompanion,
  markNotificationAsRead,
  archiveNotification,
} from '../../thunks';
import {setNotificationFilter, setSortBy} from '../../notificationSlice';
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

const NOTIFICATIONS_COMPANION_ID = 'default-companion';

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
  const loading = useSelector(
    (state: RootState) => state.notifications.loading,
  );
  const loadFailure = useSelector(
    selectNotificationsLoadFailure(NOTIFICATIONS_COMPANION_ID),
  );
  const hasHydrated = useSelector(
    selectHasHydratedCompanion(NOTIFICATIONS_COMPANION_ID),
  );
  const companions = useSelector(
    (state: RootState) => state.companion.companions,
  );
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

  const refetchNotifications = useCallback(() => {
    if (!isLoggedIn) {
      return;
    }
    dispatch(
      fetchNotificationsForCompanion({companionId: NOTIFICATIONS_COMPANION_ID}),
    );
  }, [dispatch, isLoggedIn]);

  useEffect(() => {
    refetchNotifications();
  }, [refetchNotifications]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isLoggedIn) {
        await dispatch(
          fetchNotificationsForCompanion({
            companionId: NOTIFICATIONS_COMPANION_ID,
          }),
        ).unwrap();
      }
    } catch (error) {
      console.warn('[Notifications] Refresh failed', error);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, isLoggedIn]);

  const listPhase = useMemo(
    () =>
      resolveListPhase({
        loading,
        loadError: loadFailure,
        hasLoaded: hasHydrated,
        itemCount: notifications.length,
      }),
    [loading, loadFailure, hasHydrated, notifications.length],
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing || loading}
        onRefresh={handleRefresh}
        tintColor={theme.colors.primary}
      />
    ),
    [refreshing, loading, handleRefresh, theme.colors.primary],
  );

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
    (relatedType?: Notification['relatedType'], relatedId?: string | null) => {
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
        tryNavigateByRelatedType(
          notification.relatedType,
          notification.relatedId,
        );
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

  // Group the real feed into Today / Yesterday / Earlier sections.
  const sections = useMemo<Array<{title: string; data: Notification[]}>>(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfYesterday = startOfToday - 86400000;

    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    for (const item of notifications) {
      const time = new Date(item.timestamp).getTime();
      if (!Number.isNaN(time) && time >= startOfToday) {
        today.push(item);
      } else if (!Number.isNaN(time) && time >= startOfYesterday) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }

    const grouped: Array<{title: string; data: Notification[]}> = [];
    if (today.length) grouped.push({title: 'Today', data: today});
    if (yesterday.length) grouped.push({title: 'Yesterday', data: yesterday});
    if (earlier.length) grouped.push({title: 'Earlier', data: earlier});
    return grouped;
  }, [notifications]);

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
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Notifications"
          showBackButton
          onBack={() => (navigation as any).goBack?.()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['2']}
      useSafeAreaView
      containerStyle={styles.container}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <>
          {/* Header content placed above the list to preserve internal scroll state */}
          <NotificationsListHeader
            filter={filter}
            onFilterChange={handleFilterChange}
            unreadCounts={unreadCounts as any}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            contentPaddingStyle={contentPaddingStyle}
            styles={styles}
          />

          <NotificationsSectionList
            sections={sections}
            renderItem={renderNotificationItem}
            refreshControl={refreshControl}
            emptyComponent={
              // A failed fetch used to render the same "you're all caught up"
              // copy as an genuinely empty inbox, with no way to retry.
              listPhase === 'error' ? (
                <ListErrorState
                  testID="notifications-load-error"
                  onRetry={refetchNotifications}
                />
              ) : (
                <NotificationsEmptyState styles={styles} />
              )
            }
            styles={styles}
          />
        </>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['10'],
    },
    sectionHeader: {
      ...theme.typography.eyebrow,
      color: theme.colors.inkMuted,
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
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
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing['1'],
      borderColor: theme.colors.hairline,
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
      borderColor: theme.colors.hairline,
      ...theme.shadows.xs,
    },
    segmentText: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkMuted,
    },
    segmentTextActive: {
      color: theme.colors.inkBody,
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
      ...theme.typography.emptyStateTitle,
      color: theme.colors.ink,
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
};

type NotificationStyles = ReturnType<typeof createStyles>;

interface NotificationsListHeaderProps {
  filter: NotificationCategory;
  onFilterChange: (selectedFilter: NotificationCategory) => void;
  unreadCounts: Partial<Record<NotificationCategory, number>>;
  sortBy: 'new' | 'seen';
  onSortChange: (selectedSort: 'new' | 'seen') => void;
  contentPaddingStyle: ViewStyle | null;
  styles: NotificationStyles;
}

// Filter pills + New/Seen segment shown above the list.
const NotificationsListHeader: React.FC<NotificationsListHeaderProps> = ({
  filter,
  onFilterChange,
  unreadCounts,
  sortBy,
  onSortChange,
  contentPaddingStyle,
  styles,
}) => (
  <View style={[styles.headerContent, contentPaddingStyle]}>
    <View style={styles.filtersWrapper}>
      <NotificationFilterPills
        selectedFilter={filter}
        onFilterChange={onFilterChange}
        unreadCounts={unreadCounts}
      />
    </View>

    <View style={styles.segmentContainer}>
      <View style={styles.segmentInner}>
        {(['new', 'seen'] as const).map(option => (
          <PressableOpacity
            key={option}
            onPress={() => onSortChange(option)}
            activeOpacity={0.9}
            style={[
              styles.segmentItem,
              sortBy === option && styles.segmentItemActive,
            ]}
            accessibilityRole="radio"
            accessibilityState={{selected: sortBy === option}}
            accessibilityLabel={option === 'new' ? 'New' : 'Seen'}>
            <Text
              style={[
                styles.segmentText,
                sortBy === option && styles.segmentTextActive,
              ]}>
              {option === 'new' ? 'New' : 'Seen'}
            </Text>
          </PressableOpacity>
        ))}
      </View>
    </View>
  </View>
);

type NotificationSection = {title: string; data: Notification[]};

interface NotificationsSectionListProps {
  sections: NotificationSection[];
  renderItem: SectionListRenderItem<Notification, NotificationSection>;
  refreshControl: React.ReactElement<
    React.ComponentProps<typeof RefreshControl>
  >;
  emptyComponent: React.ReactElement;
  styles: NotificationStyles;
}

// Grouped Today / Yesterday / Earlier notification list.
const NotificationsSectionList: React.FC<NotificationsSectionListProps> = ({
  sections,
  renderItem,
  refreshControl,
  emptyComponent,
  styles,
}) => (
  <SectionList
    style={styles.list}
    contentContainerStyle={styles.listContent}
    sections={sections}
    renderItem={renderItem}
    renderSectionHeader={({section}) => (
      <Text style={styles.sectionHeader}>{section.title}</Text>
    )}
    keyExtractor={item => item.id}
    ListEmptyComponent={emptyComponent}
    refreshControl={refreshControl}
    stickySectionHeadersEnabled={false}
    showsVerticalScrollIndicator={false}
    scrollEventThrottle={16}
  />
);

interface NotificationsEmptyStateProps {
  styles: NotificationStyles;
}

// Empty state shown when there are no notifications.
const NotificationsEmptyState: React.FC<NotificationsEmptyStateProps> = ({
  styles,
}) => (
  <View style={styles.emptyContainer}>
    <Image source={Images.emptyNotifications} style={styles.emptyImage} />
    <Text style={styles.emptyTitle}>Nothing in the box!</Text>
    <Text style={styles.emptySubtitle}>
      Your notification box is empty right now.{'\n'}
      Sit, stay, and we’ll fetch updates soon.
    </Text>
  </View>
);
