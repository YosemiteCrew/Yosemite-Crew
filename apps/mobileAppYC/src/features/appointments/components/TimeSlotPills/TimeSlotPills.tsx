import React, {useCallback, useMemo} from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import type {ListRenderItemInfo} from 'react-native';
import {useTheme} from '@/hooks';

type ColumnItem = {id: string; items: string[]};

type TimeSlotColumnProps = {
  items: string[];
  selected?: string | null;
  onSelect: (slot: string) => void;
  styles: ReturnType<typeof createStyles>;
};

const TimeSlotColumn = React.memo(
  ({items, selected, onSelect, styles}: TimeSlotColumnProps) => (
    <View style={styles.column}>
      {items.map(slot => {
        const isSelected = selected === slot;
        return (
          <PressableOpacity
            key={slot}
            style={[styles.pill, isSelected && styles.active]}
            onPress={() => onSelect(slot)}>
            <Text style={[styles.text, isSelected && styles.activeText]}>
              {slot}
            </Text>
          </PressableOpacity>
        );
      })}
    </View>
  ),
);

export const TimeSlotPills: React.FC<{
  slots: string[];
  selected?: string | null;
  onSelect: (slot: string) => void;
  resetKey?: string | number;
}> = ({slots, selected, onSelect, resetKey}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const columns = useMemo(() => {
    const result: Array<ColumnItem> = [];
    for (let i = 0; i < slots.length; i += 3) {
      const chunk = slots.slice(i, i + 3);
      result.push({id: `col-${i}`, items: chunk});
    }
    return result;
  }, [slots]);

  const renderColumn = useCallback(
    ({item}: ListRenderItemInfo<ColumnItem>) => (
      <TimeSlotColumn
        items={item.items}
        selected={selected}
        onSelect={onSelect}
        styles={styles}
      />
    ),
    [selected, onSelect, styles],
  );

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={columns}
        key={resetKey ?? 'timeslots'}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderColumn}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {maxHeight: theme.spacing['48']},
    listContent: {
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['1'],
      paddingHorizontal: theme.spacing['1'],
    },
    column: {flexDirection: 'column', gap: theme.spacing['2.5']},
    pill: {
      minWidth: theme.spacing['24'],
      paddingVertical: theme.spacing['2.5'],
      paddingHorizontal: theme.spacing['3'],
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    active: {
      backgroundColor: theme.colors.primaryTint,
      borderColor: theme.colors.primary,
    },
    text: {
      ...theme.typography.labelSmall,
      color: theme.colors.text,
      textAlign: 'center',
    },
    activeText: {color: theme.colors.primary},
  });

export default TimeSlotPills;
