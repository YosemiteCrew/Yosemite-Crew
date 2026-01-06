import React, {useMemo, useCallback, useRef} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View, Image} from 'react-native';
import {Images} from '@/assets/images';
import {
  formatDateToISODate,
  formatMonthYear,
  getMonthDates,
  getPreviousMonth,
  getNextMonth,
  type DateInfo,
} from '@/shared/utils/dateHelpers';

interface TaskMonthDateSelectorProps {
  currentMonth: Date;
  selectedDate: Date;
  datesWithTasks: Set<string>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (month: Date) => void;
  theme: any;
  autoScroll?: boolean;
}

export const TaskMonthDateSelector: React.FC<TaskMonthDateSelectorProps> = ({
  currentMonth,
  selectedDate,
  datesWithTasks,
  onDateSelect,
  onMonthChange,
  theme,
  autoScroll = true,
}) => {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateListRef = useRef<FlatList>(null);

  const weekDates = useMemo(() => {
    const allMonthDates = getMonthDates(currentMonth, selectedDate);
    return allMonthDates.map(dateInfo => {
      const dateStr = formatDateToISODate(dateInfo.date);
      const hasTask = datesWithTasks.has(dateStr);
      const isCurrentMonth = dateInfo.date.getMonth() === currentMonth.getMonth();
      return {...dateInfo, hasTask, isCurrentMonth};
    });
  }, [currentMonth, selectedDate, datesWithTasks]);

  const selectedDateIndex = useMemo(
    () =>
      weekDates.findIndex(
        item =>
          item.date.getFullYear() === selectedDate.getFullYear() &&
          item.date.getMonth() === selectedDate.getMonth() &&
          item.date.getDate() === selectedDate.getDate(),
      ),
    [weekDates, selectedDate],
  );

  const scrollToSelected = useCallback(() => {
    if (!autoScroll || !dateListRef.current || weekDates.length === 0 || selectedDateIndex === -1) {
      return;
    }
    setTimeout(() => {
      dateListRef.current?.scrollToIndex({
        index: selectedDateIndex,
        viewPosition: 0.5,
        animated: true,
      });
      setTimeout(() => {
        dateListRef.current?.scrollToIndex({
          index: selectedDateIndex,
          viewPosition: 0.5,
          animated: true,
        });
      }, 300);
    }, 100);
  }, [autoScroll, weekDates.length, selectedDateIndex]);

  React.useEffect(() => {
    scrollToSelected();
  }, [scrollToSelected]);

  const handlePreviousMonth = useCallback(() => {
    const prevMonth = getPreviousMonth(currentMonth);
    onMonthChange(prevMonth);
  }, [currentMonth, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    const nextMonth = getNextMonth(currentMonth);
    onMonthChange(nextMonth);
  }, [currentMonth, onMonthChange]);

  const getItemLayout = useCallback((_data: any, index: number) => {
    const itemLength = 70.5;
    const gap = 8;
    return {
      length: itemLength,
      offset: index * (itemLength + gap),
      index,
    };
  }, []);

  const renderDateItem = useCallback(
    (props: {item: DateInfo & {isCurrentMonth?: boolean; hasTask?: boolean}}) => {
      const dateInfo = props.item;
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.dateItem,
            dateInfo.isSelected && styles.dateItemSelected,
            dateInfo.isToday && styles.dateItemToday,
            !dateInfo.isCurrentMonth && styles.dateItemDisabled,
          ]}
          onPress={() => onDateSelect(dateInfo.date)}
          disabled={!dateInfo.isCurrentMonth}>
          <Text
            style={[
              styles.dayName,
              dateInfo.isSelected && styles.dayNameSelected,
              dateInfo.isToday && styles.dayNameToday,
              !dateInfo.isCurrentMonth && styles.dayNameDisabled,
            ]}>
            {dateInfo.dayName}
          </Text>
          <Text
            style={[
              styles.dayNumber,
              dateInfo.isSelected && styles.dayNumberSelected,
              dateInfo.isToday && styles.dayNumberToday,
              !dateInfo.isCurrentMonth && styles.dayNumberDisabled,
            ]}>
            {dateInfo.dayNumber.toString().padStart(2, '0')}
          </Text>
          {dateInfo.hasTask && !dateInfo.isSelected && <View style={styles.taskIndicator} />}
        </TouchableOpacity>
      );
    },
    [styles, onDateSelect],
  );

  return (
    <>
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

      <FlatList
        ref={dateListRef}
        horizontal
        data={weekDates}
        renderItem={renderDateItem}
        keyExtractor={item => item.date.toISOString()}
        initialScrollIndex={selectedDateIndex === -1 ? undefined : selectedDateIndex}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateScroller}
        style={styles.dateList}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={error => {
          console.warn('ScrollToIndex failed:', error.index);
        }}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
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
  });
