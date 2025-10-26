import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export const TaskCard = ({
  task,
  dateTime,
  avatars,
  onComplete,
}: {
  task: string;
  dateTime: string;
  avatars: any[];
  onComplete?: () => void;
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleViewPress = () => {
    onComplete?.();
  };

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      onAction={handleViewPress}
      actionBackgroundColor={theme.colors.success}
      containerStyle={styles.container}
      cardProps={{
        glassEffect: 'clear',
        interactive: true,
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{useNativeDriver: true}}
      enableHorizontalSwipeOnly={true}
    >
          <View style={styles.row}>
            <View style={styles.avatarGroup}>
              {avatars.map((avatarSource, index) => {
                let avatarKey: string;
                if (typeof avatarSource === 'number') {
                  avatarKey = `avatar-static-${avatarSource}-${index}`;
                } else if (avatarSource?.uri) {
                  avatarKey = `avatar-uri-${avatarSource.uri}`;
                } else {
                  avatarKey = `avatar-generic-${index}`;
                }

                return (
                <Image
                  key={avatarKey}
                  source={avatarSource}
                  style={[
                    styles.avatar,
                    index === 0 ? styles.avatarFirst : styles.avatarSubsequent,
                    {zIndex: avatars.length - index},
                  ]}
                />
                );
              })}
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.task}>{task}</Text>
              <Text style={styles.date}>{dateTime}</Text>
            </View>
          </View>

          <LiquidGlassButton
            title="Complete"
            onPress={onComplete ?? (() => {})}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            height={48}
            textStyle={styles.completeButtonText}
            borderRadius={12}
            style={styles.completeBtn}
          />
    </SwipeableGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'center',
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      paddingBlock: theme.spacing[6],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    row: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3],paddingBottom:5},
    avatarGroup: {flexDirection: 'row'},
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.colors.white,
    },
      completeButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.white,
    },
    textBlock: {flex: 1},
    task: {...theme.typography.titleMedium, color: theme.colors.secondary},
    date: {...theme.typography.labelXsBold, color: theme.colors.placeholder},
    completeBtn: {marginTop: theme.spacing[4]},
    avatarFirst: {
      marginLeft: 0,
    },
    avatarSubsequent: {
      marginLeft: -15,
    },
  });
