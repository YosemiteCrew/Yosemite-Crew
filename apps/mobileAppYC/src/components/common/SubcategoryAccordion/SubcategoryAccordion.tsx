import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface SubcategoryAccordionProps {
  title: string;
  subtitle: string;
  icon?: any;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  containerStyle?: any;
}

export const SubcategoryAccordion: React.FC<SubcategoryAccordionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultExpanded = false,
  containerStyle,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const animatedHeight = useSharedValue(defaultExpanded ? 1 : 0);
  const chevronRotation = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    animatedHeight.value = withTiming(newExpanded ? 1 : 0, {duration: 300});
    chevronRotation.value = withTiming(newExpanded ? 1 : 0, {duration: 300});
  };

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const maxHeight = interpolate(
      animatedHeight.value,
      [0, 1],
      [0, 1000],
      Extrapolation.CLAMP
    );

    return {
      maxHeight,
      overflow: 'hidden',
    };
  });

  const chevronAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      chevronRotation.value,
      [0, 1],
      [0, 180]
    );

    return {
      transform: [{rotate: `${rotate}deg`}],
    };
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}>
        {icon && (
          <Image
            source={icon}
            style={styles.icon}
          />
        )}
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Animated.Image
          source={Images.dropdownIcon}
          style={[styles.chevron, chevronAnimatedStyle]}
        />
      </TouchableOpacity>

      <Animated.View style={[contentAnimatedStyle]}>
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing[3],
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing[4],
      backgroundColor: theme.colors.surface,
    },
    icon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      marginRight: theme.spacing[3],
    },
    headerContent: {
      flex: 1,
      gap: theme.spacing[1],
      marginRight: theme.spacing[3],
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
    },
    chevron: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    content: {
      padding: theme.spacing[4],
      paddingTop: theme.spacing[2],
      gap: theme.spacing[2],
    },
  });
