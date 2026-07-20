import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';

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
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const chevronRotation = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = () => {
    setExpanded(previous => {
      chevronRotation.value = withTiming(previous ? 0 : 1, {duration: 300});
      return !previous;
    });
  };

  const chevronAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(chevronRotation.value, [0, 1], [0, 180]);

    return {
      transform: [{rotate: `${rotate}deg`}],
    };
  });

  return (
    <View style={[styles.shadowWrapper, containerStyle]}>
      <LiquidGlassCard
        glassEffect="clear"
        interactive={false}
        shadow="none"
        padding="0"
        colorScheme="light"
        style={styles.container}
        fallbackStyle={styles.fallback}>
        <PressableOpacity
          style={styles.header}
          onPress={toggleExpanded}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{expanded}}>
          {icon && <Image source={icon} style={styles.icon} />}
          <View
            style={[
              styles.headerContent,
              !subtitle && styles.headerContentNoSubtitle,
            ]}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          <Animated.Image
            source={Images.downArrow}
            style={[styles.chevron, chevronAnimatedStyle]}
          />
        </PressableOpacity>

        {expanded && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}>
            <View style={styles.content}>{children}</View>
          </Animated.View>
        )}
      </LiquidGlassCard>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'visible',
    },
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
      backgroundColor: theme.colors.cardBackground,
      marginBottom: theme.spacing['3'],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing['4'],
      backgroundColor: 'transparent',
    },
    icon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      marginRight: theme.spacing['3'],
    },
    headerContent: {
      flex: 1,
      gap: theme.spacing['1'],
      marginRight: theme.spacing['3'],
      justifyContent: 'center',
      alignSelf: 'center',
    },
    headerContentNoSubtitle: {
      gap: 0,
    },
    title: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
    },
    chevron: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    content: {
      padding: theme.spacing['4'],
      paddingTop: theme.spacing['2'],
      gap: theme.spacing['2'],
      backgroundColor: 'transparent',
    },
  });
