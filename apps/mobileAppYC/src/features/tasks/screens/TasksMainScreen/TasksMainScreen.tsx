import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Image,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/features/tasks/components';
import {EmptyTasksScreen} from '../EmptyTasksScreen/EmptyTasksScreen';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {fetchTasksForCompanion, markTaskStatus} from '@/features/tasks';
import {
  selectHasHydratedCompanion,
  selectRecentTasksByCategory,
  selectTaskCountByCategory,
  selectTasksByCompanion,
} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {TaskCategory} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {formatMonthYear, getMonthDates, getPreviousMonth, getNextMonth, type DateInfo} from '@/shared/utils/dateHelpers';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TasksMain'>;

const TASK_CATEGORIES: TaskCategory[] = ['health', 'hygiene', 'dietary', 'custom'];

export const TasksMainScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateListRef = useRef<FlatList>(null);

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const authUser = useSelector(selectAuthUser);
  const selectedCompanion = useMemo(
    () => companions.find(c => c.id === selectedCompanionId),
    [companions, selectedCompanionId],
  );

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const hasHydrated = useSelector(
    selectHasHydratedCompanion(selectedCompanionId ?? null),
  );

  // Get all tasks for the selected companion
  const allTasks = useSelector(selectTasksByCompanion(selectedCompanionId ?? null));

  // Auto-select today's date
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);

  // Ensure selectedDate is always a Date object
  const effectiveSelectedDate = useMemo(() => selectedDate || new Date(), [selectedDate]);


  // Get dates with tasks for the selected companion
  const datesWithTasks = useMemo(() => {
    const dateSet = new Set<string>();
    for (const task of allTasks) {
      dateSet.add(task.date); // date is in YYYY-MM-DD format
    }
    return dateSet;
  }, [allTasks]);

  // Helper function to convert date to YYYY-MM-DD format
  const formatDateToISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get all dates in current month (grid view)
  const weekDates = useMemo(() => {
    const allMonthDates = getMonthDates(currentMonth, effectiveSelectedDate);

    const filtered = allMonthDates.map(dateInfo => {
      const dateStr = formatDateToISOString(dateInfo.date);
      const hasTask = datesWithTasks.has(dateStr);
      // Mark dates from other months as disabled
      const isCurrentMonth = dateInfo.date.getMonth() === currentMonth.getMonth();
      return {...dateInfo, hasTask, isCurrentMonth};
    });

    return filtered;
  }, [currentMonth, effectiveSelectedDate, datesWithTasks]);

  // Fetch tasks and counts for all categories at component level
  const healthTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, effectiveSelectedDate, 'health', 1),
  );
  const healthCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, effectiveSelectedDate, 'health'),
  );
  const hygieneTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, effectiveSelectedDate, 'hygiene', 1),
  );
  const hygieneCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, effectiveSelectedDate, 'hygiene'),
  );
  const dietaryTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, effectiveSelectedDate, 'dietary', 1),
  );
  const dietaryCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, effectiveSelectedDate, 'dietary'),
  );
  const customTasks = useSelector(
    selectRecentTasksByCategory(selectedCompanionId, effectiveSelectedDate, 'custom', 1),
  );
  const customCount = useSelector(
    selectTaskCountByCategory(selectedCompanionId, effectiveSelectedDate, 'custom'),
  );

  const categoryData = useMemo(
    () => ({
      health: {recentTasks: healthTasks, taskCount: healthCount},
      hygiene: {recentTasks: hygieneTasks, taskCount: hygieneCount},
      dietary: {recentTasks: dietaryTasks, taskCount: dietaryCount},
      custom: {recentTasks: customTasks, taskCount: customCount},
    }),
    [healthTasks, healthCount, hygieneTasks, hygieneCount, dietaryTasks, dietaryCount, customTasks, customCount],
  );

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (selectedCompanionId && !hasHydrated) {
        console.log('📡 Fetching tasks for companion:', selectedCompanionId);
        dispatch(fetchTasksForCompanion({companionId: selectedCompanionId}));
      }
    }, [dispatch, hasHydrated, selectedCompanionId]),
  );

  // Auto-scroll to center the selected date when screen focuses
  useFocusEffect(
    useCallback(() => {
      setTimeout(() => {
        if (dateListRef.current && weekDates.length > 0) {
          // Find the index of the selected date
          const selectedIndex = weekDates.findIndex(
            item =>
              item.date.getFullYear() === effectiveSelectedDate.getFullYear() &&
              item.date.getMonth() === effectiveSelectedDate.getMonth() &&
              item.date.getDate() === effectiveSelectedDate.getDate()
          );

          if (selectedIndex !== -1) {
            // Scroll to center the selected date (0.5 means center of viewport)
            dateListRef.current?.scrollToIndex({
              index: selectedIndex,
              viewPosition: 0.5,
              animated: true,
            });
            // Fallback: if scrollToIndex fails, retry after a delay
            setTimeout(() => {
              dateListRef.current?.scrollToIndex({
                index: selectedIndex,
                viewPosition: 0.5,
                animated: true,
              });
            }, 300);
          }
        }
      }, 100); // Small delay to ensure layout is complete
    }, [weekDates, effectiveSelectedDate]),
  );

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const handlePreviousMonth = () => {
    const prevMonth = getPreviousMonth(currentMonth);
    setCurrentMonth(prevMonth);
    // Update selected date to first day of previous month
    const firstDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  };

  const handleNextMonth = () => {
    const nextMonth = getNextMonth(currentMonth);
    setCurrentMonth(nextMonth);
    // Update selected date to first day of next month
    const firstDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddTask = () => {
    navigation.navigate('AddTask');
  };

  const handleViewMore = (category: TaskCategory) => {
    navigation.navigate('TasksList', {category});
  };

  const handleViewTask = (taskId: string) => {
    navigation.navigate('TaskView', {taskId});
  };

  const handleEditTask = (taskId: string) => {
    navigation.navigate('EditTask', {taskId});
  };

  const handleCompleteTask = (taskId: string) => {
    dispatch(markTaskStatus({taskId, status: 'completed'}));
  };


  const getItemLayout = useCallback((_: any, index: number) => {
    const itemLength = 70.5; 
    const gap = 8;
    return {
      length: itemLength,
      offset: index * (itemLength + gap),
      index,
    };
  }, []);

  const renderDateItem = ({item}: {item: DateInfo & {isCurrentMonth?: boolean}}) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.dateItem,
        item.isSelected && styles.dateItemSelected,
        item.isToday && styles.dateItemToday,
        !item.isCurrentMonth && styles.dateItemDisabled,
      ]}
      onPress={() => handleDateSelect(item.date)}
      disabled={!item.isCurrentMonth}>
      <Text
        style={[
          styles.dayName,
          item.isSelected && styles.dayNameSelected,
          item.isToday && styles.dayNameToday,
          !item.isCurrentMonth && styles.dayNameDisabled,
        ]}>
        {item.dayName}
      </Text>
      <Text
        style={[
          styles.dayNumber,
          item.isSelected && styles.dayNumberSelected,
          item.isToday && styles.dayNumberToday,
          !item.isCurrentMonth && styles.dayNumberDisabled,
        ]}>
        {item.dayNumber.toString().padStart(2, '0')}
      </Text>
      {item.hasTask && !item.isSelected && (
        <View style={styles.taskIndicator} />
      )}
    </TouchableOpacity>
  );

  const renderCategorySection = (category: TaskCategory) => {
    const data = categoryData[category];
    const recentTasks = data.recentTasks;
    const taskCount = data.taskCount;
    const task = recentTasks[0];
    const companion = companions.find(c => c.id === task?.companionId);

    // Get assigned user's profile image and name
    const assignedToData = task?.assignedTo === authUser?.id ? {
      avatar: authUser?.profilePicture,
      name: authUser?.firstName || 'User',
    } : undefined;

    return (
      <View key={category} style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{resolveCategoryLabel(category)}</Text>
          {taskCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleViewMore(category)}>
              <Text style={styles.viewMore}>View More</Text>
            </TouchableOpacity>
          )}
        </View>

        {task && companion ? (
          <TaskCard
            title={task.title}
            categoryLabel={resolveCategoryLabel(task.category)}
            subcategoryLabel={task.subcategory ? task.subcategory : undefined}
            date={task.date}
            time={task.time}
            companionName={companion.name}
            companionAvatar={companion.profileImage ?? undefined}
            assignedToName={assignedToData?.name}
            assignedToAvatar={assignedToData?.avatar}
            status={task.status}
            onPressView={() => handleViewTask(task.id)}
            onPressEdit={() => handleEditTask(task.id)}
            onPressComplete={() => handleCompleteTask(task.id)}
            showEditAction
            showCompleteButton={task.status === 'pending'}
            category={task.category}
            details={task.details}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No {resolveCategoryLabel(category).toLowerCase()} tasks
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Show empty screen if no companion is selected
  if (!selectedCompanionId) {
    return <EmptyTasksScreen />;
  }

  return (
    <SafeArea>
      <Header
        title="Tasks"
        showBackButton={false}
        rightIcon={Images.addIconDark}
        onRightPress={handleAddTask}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}>
        <CompanionSelector
          companions={companions}
          selectedCompanionId={selectedCompanionId}
          onSelect={handleCompanionSelect}
          showAddButton={false}
          containerStyle={styles.companionSelectorTask}
        />

        {/* Month Navigation */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePreviousMonth}
            style={styles.monthArrow}>
            <Image source={Images.leftArrowIcon} style={styles.arrowIcon} />
          </TouchableOpacity>

          <View style={styles.monthTextContainer}>
            <Text style={styles.monthText}>{formatMonthYear(currentMonth)}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleNextMonth}
            style={styles.monthArrow}>
            <Image source={Images.rightArrowIcon} style={styles.arrowIcon} />
          </TouchableOpacity>
        </View>

        {/* Horizontal Date Scroller - All month dates in one row */}
        <FlatList
          ref={dateListRef}
          horizontal
          data={weekDates}
          renderItem={renderDateItem}
          keyExtractor={item => item.date.toISOString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScroller}
          style={styles.dateList}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={(error) => {
            // Silently ignore if scrollToIndex fails
            console.warn('ScrollToIndex failed:', error.index);
          }}
        />

        {/* Category Sections */}
        {allTasks.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateTitle}>No tasks yet</Text>
            <Text style={styles.emptyStateText}>
              Start by adding a task for {selectedCompanion?.name || 'your companion'}
            </Text>
          </View>
        ) : (
          TASK_CATEGORIES.map(category => renderCategorySection(category))
        )}
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingBottom: theme.spacing[20],
    },
    companionSelectorTask: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[4],
      paddingHorizontal: theme.spacing[4],
    },
    monthNavigation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing[4],
      marginBottom: theme.spacing[4],
    },
    monthArrow: {
      padding: theme.spacing[2],
    },
    arrowIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
    monthTextContainer: {
      flex: 1,
      alignItems: 'center',
    },
    monthText: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    dateList: {
      marginBottom: theme.spacing[6],
    },
    dateScroller: {
      paddingHorizontal: theme.spacing[4],
      gap: theme.spacing[2],
    },
    dateItem: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      borderRadius: theme.borderRadius.md,
      minWidth: 70,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateItemSelected: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
      borderWidth: 1,
      borderRadius: 12,
    },
    dateItemToday: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    dayName: {
      ...theme.typography.h6Clash,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[1],
      textAlign: 'center',
    },
    dayNameSelected: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    dayNameToday: {
      fontWeight: '500',
    },
    dayNumber: {
      ...theme.typography.h6Clash,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    dayNumberSelected: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    dayNumberToday: {
      fontWeight: '500',
      color: theme.colors.primary,
    },
    dateItemDisabled: {
      opacity: 0.3,
      backgroundColor: theme.colors.background,
    },
    dayNameDisabled: {
      color: theme.colors.textSecondary,
    },
    dayNumberDisabled: {
      color: theme.colors.textSecondary,
    },
    taskIndicator: {
      position: 'absolute',
      bottom: theme.spacing[1],
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    categorySection: {
      marginBottom: theme.spacing[6],
      paddingHorizontal: theme.spacing[4],
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[3],
    },
    categoryTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      fontWeight: '600',
    },
    viewMore: {
      ...theme.typography.h6Clash,
      color: theme.colors.primary,
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 14,
      letterSpacing: -0.14,
      textAlign: 'center',
    },
    emptyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      paddingVertical: theme.spacing[6],
      paddingHorizontal: theme.spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    emptyStateContainer: {
      marginHorizontal: theme.spacing[4],
      marginVertical: theme.spacing[8],
      paddingVertical: theme.spacing[10],
      paddingHorizontal: theme.spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyStateTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
      fontWeight: '600',
    },
    emptyStateText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
