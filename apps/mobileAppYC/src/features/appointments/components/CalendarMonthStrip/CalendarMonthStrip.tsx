import React, {useEffect, useMemo, useRef, useCallback, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, StyleSheet, Image} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {
  formatMonthYear,
  getMonthDates,
  getPreviousMonth,
  getNextMonth,
  type DateInfo,
} from '@/shared/utils/dateHelpers';

export interface CalendarMonthStripProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  datesWithMarkers?: Set<string> | string[];
  markerColor?: string;
}

export const CalendarMonthStrip: React.FC<CalendarMonthStripProps> = ({selectedDate, onChange, datesWithMarkers, markerColor}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dateListRef = useRef<FlatList>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const markerSet = useMemo(() => {
    if (!datesWithMarkers) return new Set<string>();
    return Array.isArray(datesWithMarkers) ? new Set(datesWithMarkers) : datesWithMarkers;
  }, [datesWithMarkers]);

  const weekDates = useMemo(() => {
    // Mark selected
    return getMonthDates(currentMonth, selectedDate).map(d => ({...d, isCurrentMonth: d.date.getMonth() === currentMonth.getMonth()} as DateInfo & {isCurrentMonth: boolean}));
  }, [currentMonth, selectedDate]);

  useEffect(() => {
    setTimeout(() => {
      if (dateListRef.current && weekDates.length > 0) {
        const selectedIndex = weekDates.findIndex(item => item.date.getFullYear() === selectedDate.getFullYear() && item.date.getMonth() === selectedDate.getMonth() && item.date.getDate() === selectedDate.getDate());
        if (selectedIndex !== -1) {
          dateListRef.current?.scrollToIndex({index: selectedIndex, viewPosition: 0.5, animated: true});
          setTimeout(() => {
            dateListRef.current?.scrollToIndex({index: selectedIndex, viewPosition: 0.5, animated: true});
          }, 250);
        }
      }
    }, 80);
  }, [weekDates, selectedDate]);

  const getItemLayout = useCallback((_: any, index: number) => {
    const itemLength = 70.5; // Sync to TasksMainScreen strip spacing
    const gap = 8;
    return {length: itemLength, offset: index * (itemLength + gap), index};
  }, []);

  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const renderDateItem = ({item}: {item: DateInfo & {isCurrentMonth?: boolean}}) => {
    const showMarker = markerSet.has(iso(item.date));
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.dateItem, item.isSelected && styles.dateItemSelected, item.isToday && styles.dateItemToday, !item.isCurrentMonth && styles.dateItemDisabled]}
        onPress={() => onChange(item.date)}>
        <Text style={[styles.dateDay, item.isSelected && styles.dateDaySelected]}>{item.dayName}</Text>
        <Text style={[styles.dateNumber, item.isSelected && styles.dateNumberSelected]}>{item.dayNumber}</Text>
        {showMarker && <View style={[styles.marker, {backgroundColor: markerColor || theme.colors.primary}]} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => setCurrentMonth(getPreviousMonth(currentMonth))} style={styles.navButton} activeOpacity={0.7}>
          <Image source={Images.leftArrowIcon} style={styles.arrowIcon} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{formatMonthYear(currentMonth)}</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(getNextMonth(currentMonth))} style={styles.navButton} activeOpacity={0.7}>
          <Image source={Images.rightArrowIcon} style={styles.arrowIcon} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={dateListRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={weekDates}
        keyExtractor={item => item.date.toISOString()}
        renderItem={renderDateItem}
        contentContainerStyle={styles.datesList}
        getItemLayout={getItemLayout}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    calendarContainer: {gap: theme.spacing[2]},
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    navButton: {padding: theme.spacing[2]},
    arrowIcon: {width: 24, height: 24, resizeMode: 'contain', tintColor: theme.colors.secondary},
    monthTitle: {...theme.typography.titleMedium, color: theme.colors.secondary, textAlign: 'center', flex: 1},
    datesList: {gap: theme.spacing[2]},
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
    dateItemToday: {borderColor: theme.colors.primary, borderWidth: 2},
    dateItemDisabled: {opacity: 0.3, backgroundColor: theme.colors.background},
    dateDay: {...theme.typography.h6Clash, color: theme.colors.textSecondary, marginBottom: theme.spacing[1], textAlign: 'center'},
    dateDaySelected: {color: theme.colors.primary, fontWeight: '500'},
    dateNumber: {...theme.typography.h6Clash, color: theme.colors.textSecondary, textAlign: 'center'},
    dateNumberSelected: {color: theme.colors.primary, fontWeight: '500'},
    marker: {position: 'absolute', bottom: 6, width: 6, height: 6, borderRadius: 3},
  });

export default CalendarMonthStrip;
