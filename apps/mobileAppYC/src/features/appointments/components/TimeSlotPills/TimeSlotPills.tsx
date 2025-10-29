import React, {useMemo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';

export const TimeSlotPills: React.FC<{
  slots: string[];
  selected?: string | null;
  onSelect: (slot: string) => void;
}> = ({slots, selected, onSelect}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      {slots.map(s => (
        <TouchableOpacity key={s} style={[styles.pill, selected === s && styles.active]} onPress={() => onSelect(s)}>
          <Text style={[styles.text, selected === s && styles.activeText]}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  pill: {paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border},
  active: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
  text: {...theme.typography.labelXsBold, color: theme.colors.text},
  activeText: {color: theme.colors.primary},
});

export default TimeSlotPills;

