import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const RatingStars: React.FC<{value: number; onChange?: (v: number) => void; size?: number}> = ({value, onChange, size = 20}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme, size), [theme, size]);
  return (
    <View style={styles.row}>
      {[1,2,3,4,5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange?.(i)} activeOpacity={0.8}>
          <Image
            source={i <= value ? Images.starSolid : Images.starOutline}
            style={[styles.star, {width: size, height: size}]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: any, size: number) => StyleSheet.create({
  row: {flexDirection: 'row', gap: 6},
  star: {
    width: size,
    height: size,
  },
});

export default RatingStars;
