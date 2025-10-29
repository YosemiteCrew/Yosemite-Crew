import React, {useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, FlatList} from 'react-native';
import {useTheme} from '@/hooks';
import {getWeekDates, formatMonthYear, type DateInfo} from '@/shared/utils/dateHelpers';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shift(-7)}><Text style={styles.nav}>{'<'}</Text></TouchableOpacity>
        <Text style={styles.month}>{formatMonthYear(selectedDate)}</Text>
        <TouchableOpacity onPress={() => shift(7)}><Text style={styles.nav}>{'>'}</Text></TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={weekDates}
        keyExtractor={(d: DateInfo) => d.date.toISOString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.day, item.isSelected && styles.dayActive, item.isToday && styles.dayToday]}
            onPress={() => onChange(item.date)}
          >
            <Text style={[styles.dayText, item.isSelected && styles.dayTextActive]}>{item.dayName}</Text>
            <Text style={[styles.dayNum, item.isSelected && styles.dayTextActive]}>{item.dayNumber}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {gap: 8},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  listContent: {gap: 8},
  month: {...theme.typography.titleSmall, color: theme.colors.secondary},
  nav: {...theme.typography.titleSmall, color: theme.colors.secondary},
  day: {paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center'},
  dayActive: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
  dayToday: {},
  dayText: {...theme.typography.caption, color: theme.colors.textSecondary},
  dayTextActive: {color: theme.colors.primary},
  dayNum: {...theme.typography.labelXsBold, color: theme.colors.text},
});

export default CalendarRow;
