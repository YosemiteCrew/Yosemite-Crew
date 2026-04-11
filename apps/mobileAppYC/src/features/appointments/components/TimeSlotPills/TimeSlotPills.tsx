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
  active: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
  text: {
    ...theme.typography.labelSmall,
    color: theme.colors.text,
    textAlign: 'center',
  },
  activeText: {color: theme.colors.primary},
});

export default TimeSlotPills;
