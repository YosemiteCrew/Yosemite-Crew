import React, {useMemo, useState, useEffect, useRef, useCallback} from 'react';
import {FlatList, StyleSheet, Text, View, TouchableOpacity, Image} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import {TaskCard} from '@/features/tasks/components';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {setSelectedCompanion} from '@/features/companion';
import {markTaskStatus} from '@/features/tasks';
import {selectAllTasksByCategory} from '@/features/tasks/selectors';
import {selectAuthUser} from '@/features/auth/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskStackParamList} from '@/navigation/types';
import type {Task} from '@/features/tasks/types';
import {resolveCategoryLabel} from '@/features/tasks/utils/taskLabels';
import {formatMonthYear, getMonthDates, getPreviousMonth, getNextMonth, type DateInfo} from '@/shared/utils/dateHelpers';

type Navigation = NativeStackNavigationProp<TaskStackParamList, 'TasksList'>;
type Route = RouteProp<TaskStackParamList, 'TasksList'>;

export const TasksListScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateListRef = useRef<FlatList>(null);

  const {category} = route.params;

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );
  const authUser = useSelector(selectAuthUser);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get all tasks for the category
  const allCategoryTasks = useSelector(selectAllTasksByCategory(selectedCompanionId, category));

  // Auto-select today's date
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);

  // Ensure selectedDate is always a Date object
  const effectiveSelectedDate = useMemo(() => selectedDate || new Date(), [selectedDate]);

  // Helper function to convert date to YYYY-MM-DD format
  const formatDateToISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filter tasks by selected date
  const tasks = useMemo(() => {
    const selectedDateStr = formatDateToISOString(effectiveSelectedDate);
    return allCategoryTasks.filter(task => task.date === selectedDateStr);
  }, [allCategoryTasks, effectiveSelectedDate]);

  // Get dates with tasks for the selected category
  const datesWithTasks = useMemo(() => {
    const dateSet = new Set<string>();
    for (const task of allCategoryTasks) {
      dateSet.add(task.date);
    }
    return dateSet;
  }, [allCategoryTasks]);

  // Get all dates in current month (grid view)
  const weekDates = useMemo(() => {
    const allMonthDates = getMonthDates(currentMonth, effectiveSelectedDate);

    const filtered = allMonthDates.map(dateInfo => {
      const dateStr = formatDateToISOString(dateInfo.date);
      const hasTask = datesWithTasks.has(dateStr);
      const isCurrentMonth = dateInfo.date.getMonth() === currentMonth.getMonth();
      return {...dateInfo, hasTask, isCurrentMonth};
    });

    return filtered;
  }, [currentMonth, effectiveSelectedDate, datesWithTasks]);

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
    const firstDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  };

  const handleNextMonth = () => {
    const nextMonth = getNextMonth(currentMonth);
    setCurrentMonth(nextMonth);
    const firstDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
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

  const handleStartObservationalTool = (taskId: string) => {
    navigation.navigate('ObservationalTool', {taskId});
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

  const renderTask = ({item}: {item: Task}) => {
    const companion = companions.find(c => c.id === item.companionId);
    const statusUpper = String(item.status).toUpperCase();
    const isPending = statusUpper === 'PENDING';
    const isCompleted = statusUpper === 'COMPLETED';

    if (!companion) return null;

    // Get assigned user's profile image and name
    const selfId = authUser?.parentId ?? authUser?.id;
    const assignedToData = item.assignedTo === selfId ? {
      avatar: authUser?.profilePicture,
      name: authUser?.firstName || 'User',
    } : undefined;

    const isObservationalToolTask =
      item.category === 'health' &&
      item.details &&
      'taskType' in item.details &&
      item.details.taskType === 'take-observational-tool';

    return (
      <TaskCard
        title={item.title}
        categoryLabel={resolveCategoryLabel(item.category)}
        subcategoryLabel={item.subcategory ? item.subcategory : undefined}
        date={item.date}
        time={item.time}
        companionName={companion.name}
        companionAvatar={companion.profileImage ?? undefined}
        assignedToName={assignedToData?.name}
        assignedToAvatar={assignedToData?.avatar}
        status={item.status}
        onPressView={() => handleViewTask(item.id)}
        onPressEdit={() => handleEditTask(item.id)}
        onPressComplete={() => handleCompleteTask(item.id)}
        onPressTakeObservationalTool={
          isObservationalToolTask ? () => handleStartObservationalTool(item.id) : undefined
        }
        showEditAction={!isCompleted}
        showCompleteButton={isPending}
        category={item.category}
        details={item.details}
      />
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No {resolveCategoryLabel(category).toLowerCase()} tasks yet
      </Text>
    </View>
  );

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={`${resolveCategoryLabel(category)} tasks`}
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['1']}>
      {contentPaddingStyle => (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <CompanionSelector
                companions={companions}
                selectedCompanionId={selectedCompanionId}
                onSelect={handleCompanionSelect}
                showAddButton={false}
                containerStyle={styles.companionSelector}
                requiredPermission="tasks"
                permissionLabel="tasks"
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

              {/* Horizontal Date Scroller */}
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
                  console.warn('ScrollToIndex failed:', error.index);
                }}
              />
            </>
          }
          contentContainerStyle={[styles.listContent, contentPaddingStyle]}
          ListEmptyComponent={renderEmpty}
          style={styles.list}
        />
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    list: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    companionSelector: {
      paddingHorizontal: theme.spacing['4'],
      marginTop: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    monthNavigation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing['4'],
      marginBottom: theme.spacing['4'],
    },
    monthArrow: {
      padding: theme.spacing['2'],
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
      marginBottom: theme.spacing['6'],
    },
    dateScroller: {
      paddingHorizontal: theme.spacing['4'],
      gap: theme.spacing['2'],
    },
    dateItem: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      borderRadius: theme.borderRadius.md,
      minWidth: 70,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateItemSelected: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
    },
    dateItemToday: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    dateItemDisabled: {
      opacity: 0.3,
      backgroundColor: theme.colors.background,
    },
    dayName: {
      ...theme.typography.h6Clash,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['1'],
      textAlign: 'center',
    },
    dayNameSelected: {
      color: theme.colors.primary,
      fontWeight: '500',
    },
    dayNameToday: {
      fontWeight: '500',
    },
    dayNameDisabled: {
      color: theme.colors.textSecondary,
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
    dayNumberDisabled: {
      color: theme.colors.textSecondary,
    },
    taskIndicator: {
      position: 'absolute',
      bottom: theme.spacing['1'],
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['2'],
      paddingBottom: theme.spacing['16'],
      gap: theme.spacing['3'],
    },
    emptyContainer: {
      paddingVertical: theme.spacing['12'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default TasksListScreen;
