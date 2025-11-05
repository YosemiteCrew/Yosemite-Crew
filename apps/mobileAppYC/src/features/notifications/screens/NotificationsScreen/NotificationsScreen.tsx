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
  selectSortedNotificationsForCompanion,
  selectUnreadCountByCategory,
} from '../../selectors';
import {
  fetchNotificationsForCompanion,
  markNotificationAsRead,
  deleteNotification,
  archiveNotification,
  markAllNotificationsAsRead,
  clearAllNotifications,
} from '../../thunks';
import {
  setNotificationFilter,
  setSortBy,
  injectMockNotifications,
} from '../../notificationSlice';
import {NotificationCard} from '../../components/NotificationCard/NotificationCard';
import {NotificationFilterPills} from '../../components/NotificationFilterPills/NotificationFilterPills';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {mockNotifications} from '../../data/mockNotifications';
import type {Notification, NotificationCategory} from '../../types';

export const NotificationsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Redux selectors
  const notifications = useSelector(selectDisplayNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const filter = useSelector(selectNotificationFilter);
  const sortBy = useSelector(selectNotificationSortBy);
  const loading = useSelector((state: RootState) => state.notifications.loading);
  const companions = useSelector((state: RootState) => state.companion.companions);

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

  // Handle sort change
  const handleSortChange = useCallback(
    (selectedSort: 'newest' | 'oldest' | 'priority') => {
      dispatch(setSortBy(selectedSort));
    },
    [dispatch],
  );

  // Handle notification tap
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (notification.status === 'unread') {
        dispatch(markNotificationAsRead({notificationId: notification.id}));
      }
      // TODO: Handle deep linking based on notification.deepLink
    },
    [dispatch],
  );

  // Handle dismiss (mark as read)
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

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    dispatch(markAllNotificationsAsRead({}));
  }, [dispatch]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    dispatch(clearAllNotifications());
  }, [dispatch]);

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
    const companion = getCompanionById(item.companionId);
    return (
      <NotificationCard
        notification={item}
        companion={companion}
        onPress={() => handleNotificationPress(item)}
        onDismiss={() => handleDismiss(item.id)}
        onArchive={() => handleArchive(item.id)}
        showActions
      />
    );
  };

  // Render header
  const renderHeaderComponent = () => (
    <>
      <View style={styles.headerContent}>
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Pills */}
      <NotificationFilterPills
        selectedFilter={filter}
        onFilterChange={handleFilterChange}
        unreadCounts={
          {
            all: unreadCount,
            messages: useSelector(selectUnreadCountByCategory('messages')),
            appointments: useSelector(selectUnreadCountByCategory('appointments')),
            tasks: useSelector(selectUnreadCountByCategory('tasks')),
            documents: useSelector(selectUnreadCountByCategory('documents')),
            health: useSelector(selectUnreadCountByCategory('health')),
            dietary: useSelector(selectUnreadCountByCategory('dietary')),
            hygiene: useSelector(selectUnreadCountByCategory('hygiene')),
            payment: useSelector(selectUnreadCountByCategory('payment')),
          } as any
        }
      />

      {/* Sort options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <View style={styles.sortButtons}>
          {(['newest', 'oldest', 'priority'] as const).map(option => (
            <TouchableOpacity
              key={option}
              onPress={() => handleSortChange(option)}
              style={[
                styles.sortButton,
                sortBy === option && styles.sortButtonActive,
              ]}>
              <Text
                style={[
                  styles.sortButtonText,
                  sortBy === option && styles.sortButtonTextActive,
                ]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Clear all button */}
      {notifications.length > 0 && (
        <View style={styles.actionBar}>
          <LiquidGlassButton
            title="Clear All"
            onPress={handleClearAll}
            height={40}
            borderRadius={10}
            tintColor={theme.colors.error}
            forceBorder
            borderColor={theme.colors.error}
            textStyle={styles.clearButtonText}
            shadowIntensity="none"
            style={styles.clearButton}
          />
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Notifications"
        showBackButton={false}
        rightIcon={Images.addIconDark}
        onRightPress={handleMarkAllAsRead}
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeaderComponent}
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
      marginBottom: theme.spacing[4],
    },
    titleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[2],
    },
    mainTitle: {
      ...theme.typography.h2,
      color: theme.colors.secondary,
    },
    unreadBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[1.5],
    },
    unreadBadgeText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.white,
      fontSize: 11,
    },
    markAllText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    sortContainer: {
      marginBottom: theme.spacing[3],
      gap: theme.spacing[2],
    },
    sortLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    sortButtons: {
      flexDirection: 'row',
      gap: theme.spacing[2],
    },
    sortButton: {
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[1.5],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    sortButtonActive: {
      backgroundColor: theme.colors.primaryTint,
      borderColor: theme.colors.primary,
    },
    sortButtonText: {
      ...theme.typography.labelSmall,
      color: theme.colors.textSecondary,
    },
    sortButtonTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    actionBar: {
      marginTop: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    clearButton: {
      alignSelf: 'flex-start',
    },
    clearButtonText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.error,
    },
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
