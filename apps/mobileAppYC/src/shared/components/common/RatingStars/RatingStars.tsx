import React from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const RatingStars: React.FC<{
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}> = ({value, onChange, size = 20}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme, size), [theme, size]);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= value;
        return (
          <PressableOpacity
            key={i}
            onPress={() => onChange?.(i)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            // The star's own value, not whether it is FILLED. Radio controls are
            // mutually exclusive, so announcing stars 1-3 as all selected for a
            // rating of 3 tells a screen-reader user the wrong thing.
            accessibilityState={{selected: i === value}}
            accessibilityLabel={`Rate ${i} star${i === 1 ? '' : 's'}`}>
            <Image
              source={filled ? Images.starSolid : Images.starOutline}
              style={[
                styles.star,
                {width: size, height: size},
                // Pink = companion moment (hearts / ratings).
                {
                  tintColor: filled ? theme.colors.pink : theme.colors.inkFaint,
                },
              ]}
              resizeMode="contain"
            />
          </PressableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (theme: any, size: number) =>
  StyleSheet.create({
    row: {flexDirection: 'row', gap: 6},
    star: {
      width: size,
      height: size,
    },
  });

export default RatingStars;
