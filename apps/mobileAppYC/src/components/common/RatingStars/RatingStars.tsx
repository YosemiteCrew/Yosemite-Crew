import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';

export const RatingStars: React.FC<{value: number; onChange?: (v: number) => void; size?: number}> = ({value, onChange, size = 20}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme, size), [theme, size]);
  return (
    <View style={styles.row}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange?.(i)} activeOpacity={0.8}>
          <Text style={[styles.star, i <= value ? styles.filled : styles.empty]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: any, size: number) => StyleSheet.create({
  row: {flexDirection: 'row', gap: 6},
  star: {fontSize: size, lineHeight: size, includeFontPadding: false},
  filled: {color: '#F4A261'},
  empty: {color: theme.colors.border},
});

export default RatingStars;

