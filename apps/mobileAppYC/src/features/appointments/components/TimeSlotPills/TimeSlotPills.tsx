import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, FlatList} from 'react-native';
import {useTheme} from '@/hooks';

export const TimeSlotPills: React.FC<{
  slots: string[];
  selected?: string | null;
  onSelect: (slot: string) => void;
  resetKey?: string | number;
}> = ({slots, selected, onSelect, resetKey}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Build columns of up to 3 items each so we can scroll horizontally across columns
  const columns = useMemo(() => {
    const result: Array<{id: string; items: string[]}> = [];
    for (let i = 0; i < slots.length; i += 3) {
      const chunk = slots.slice(i, i + 3);
      result.push({id: `col-${i}`, items: chunk});
    }
    return result;
  }, [slots]);

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={columns}
        key={resetKey ?? 'timeslots'}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <View style={styles.column}>
            {item.items.map(slot => {
              const isSelected = selected === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.pill, isSelected && styles.active]}
                  onPress={() => onSelect(slot)}
                >
                  <Text style={[styles.text, isSelected && styles.activeText]}>{slot}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {maxHeight: 200},
  listContent: {gap: 12, paddingVertical: 4, paddingHorizontal: 4},
  column: {flexDirection: 'column', gap: 10},
  pill: {
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
  text: {...theme.typography.labelXsBold, color: theme.colors.text},
  activeText: {color: theme.colors.primary},
});

export default TimeSlotPills;
