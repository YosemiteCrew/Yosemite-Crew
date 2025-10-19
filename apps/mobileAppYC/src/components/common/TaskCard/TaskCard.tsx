import React, {useMemo, useRef} from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

const ACTION_WIDTH = 70;

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
  const translateX = useRef(new Animated.Value(0)).current;

  const clampTranslate = (dx: number) => Math.max(-ACTION_WIDTH, Math.min(0, dx));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => translateX.setValue(clampTranslate(g.dx)),
      onPanResponderRelease: (_, g) => {
        Animated.spring(translateX, {
          toValue: g.dx < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const handleViewPress = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start(() => onComplete?.());
  };

  return (
    <View style={styles.container}>
      {/* Slide Action */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.actionButton}
          onPress={handleViewPress}>
          <TouchableOpacity style={styles.actionIcon} activeOpacity={0.85}>
            <Image source={Images.viewIconSlide} style={styles.actionImage} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>

      {/* Main Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[{transform: [{translateX}]}]}>
        <LiquidGlassCard
          glassEffect="clear"
          interactive
          shadow="none"
          style={styles.card}
          fallbackStyle={styles.fallback}>
          <View style={styles.row}>
            <View style={styles.avatarGroup}>
              {avatars.map((avatarSource, index) => {
                const avatarKey =
                  typeof avatarSource === 'number'
                    ? `avatar-static-${avatarSource}-${index}`
                    : (avatarSource?.uri ? `avatar-uri-${avatarSource.uri}` : `avatar-generic-${index}`);

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
        </LiquidGlassCard>
      </Animated.View>
    </View>
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
    actionContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: ACTION_WIDTH + theme.spacing[5],
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      zIndex: 0,
    },
    actionButton: {
      width: 48,
      height: 48,
      paddingLeft: theme.spacing[5],
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.success,
    },
    actionIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
    animatedWrapper: {zIndex: 1},
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
