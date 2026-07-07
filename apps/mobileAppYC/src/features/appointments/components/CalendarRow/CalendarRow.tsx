import React, {useCallback, useMemo} from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import type {ListRenderItemInfo} from 'react-native';
import {useTheme} from '@/hooks';
import {
  getWeekDates,
  formatMonthYear,
  type DateInfo,
} from '@/shared/utils/dateHelpers';

type CalendarDayProps = {
  item: DateInfo;
  onChange: (date: Date) => void;
  styles: ReturnType<typeof createStyles>;
};

const CalendarDay = React.memo(({item, onChange, styles}: CalendarDayProps) => (
  <PressableOpacity
    style={[
      styles.day,
      item.isSelected && styles.dayActive,
      item.isToday && styles.dayToday,
    ]}
    onPress={() => onChange(item.date)}>
    <Text style={[styles.dayText, item.isSelected && styles.dayTextActive]}>
      {item.dayName}
    </Text>
    <Text style={[styles.dayNum, item.isSelected && styles.dayTextActive]}>
      {item.dayNumber}
    </Text>
  </PressableOpacity>
));

export const CalendarRow: React.FC<{
  selectedDate: Date;
  onChange: (date: Date) => void;
}> = ({selectedDate, onChange}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const shift = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    onChange(d);
  };

  const renderDay = useCallback(
    ({item}: ListRenderItemInfo<DateInfo>) => (
      <CalendarDay item={item} onChange={onChange} styles={styles} />
    ),
    [onChange, styles],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressableOpacity onPress={() => shift(-7)}>
          <Text style={styles.nav}>{'<'}</Text>
        </PressableOpacity>
        <Text style={styles.month}>{formatMonthYear(selectedDate)}</Text>
        <PressableOpacity onPress={() => shift(7)}>
          <Text style={styles.nav}>{'>'}</Text>
        </PressableOpacity>
      </View>
      <FlatList
        horizontal
        data={weekDates}
        keyExtractor={(d: DateInfo) => d.date.toISOString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={renderDay}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {gap: 8},
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    listContent: {gap: 8},
    month: {...theme.typography.titleSmall, color: theme.colors.secondary},
    nav: {...theme.typography.titleSmall, color: theme.colors.secondary},
    day: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    dayActive: {
      backgroundColor: theme.colors.primaryTint,
      borderColor: theme.colors.primary,
    },
    dayToday: {},
    dayText: {...theme.typography.caption, color: theme.colors.textSecondary},
    dayTextActive: {color: theme.colors.primary},
    dayNum: {...theme.typography.labelXxsBold, color: theme.colors.text},
  });

export default CalendarRow;
