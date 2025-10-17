import React, {useRef, useMemo} from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

const ACTION_WIDTH = 70;

export interface DocumentCardProps {
  title: string;
  businessName: string;
  visitType: string;
  issueDate: string;
  thumbnail?: ImageSourcePropType;
  onPressView?: () => void;
  onPressEdit?: () => void;
  showEditAction?: boolean; // For synced documents, this will be false
  onPress?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  businessName,
  visitType,
  issueDate,
  thumbnail,
  onPressView,
  onPressEdit,
  showEditAction = true,
  onPress,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const translateX = useRef(new Animated.Value(0)).current;

  const actionCount = showEditAction ? 2 : 1;
  const totalActionWidth = ACTION_WIDTH * actionCount;

  const clampTranslate = (value: number) => {
    if (value < -totalActionWidth) {
      return -totalActionWidth;
    }
    if (value > 0) {
      return 0;
    }
    return value;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(clampTranslate(gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -totalActionWidth / 2;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -totalActionWidth : 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        }).start();
      },
    }),
  ).current;

  const handleActionPress = (action?: () => void) => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start(() => {
      if (action) {
        action();
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.actionButton}
          onPress={() => handleActionPress(onPressView)}>
          <Image source={Images.viewIconSlide} style={styles.actionImage} />
        </TouchableOpacity>
        {showEditAction && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.editActionButton]}
            onPress={() => handleActionPress(onPressEdit)}>
            <Image source={Images.editIconSlide} style={styles.actionImage} />
          </TouchableOpacity>
        )}
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.animatedWrapper, {transform: [{translateX}]}]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          disabled={!onPress}>
          <LiquidGlassCard
            interactive
            glassEffect="clear"
            shadow="none"
            style={styles.card}
            fallbackStyle={styles.fallback}>
            <View style={styles.content}>
              {thumbnail && (
                <View style={styles.thumbnailContainer}>
                  <Image source={thumbnail} style={styles.thumbnail} />
                </View>
              )}
              <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                  Title: {title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                  Business: {businessName}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                  Visit type: {visitType}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
                  Issue Date: {issueDate}
                </Text>
              </View>
            </View>
          </LiquidGlassCard>
        </TouchableOpacity>
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
      marginBottom: theme.spacing[3],
    },
    actionContainer: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryGlass,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
      zIndex: 0,
    },
    actionButton: {
      width: ACTION_WIDTH,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primarySurface,
    },
    editActionButton: {
      backgroundColor: theme.colors.secondarySurface || theme.colors.primarySurface,
    },
    actionImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
    },
    animatedWrapper: {
      zIndex: 1,
    },
    card: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      overflow: 'hidden',
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
      padding: theme.spacing[4],
    },
    fallback: {
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    thumbnailContainer: {
      width: 60,
      height: 60,
      borderRadius: theme.borderRadius.base,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    textContainer: {
      flex: 1,
      gap: theme.spacing[1],
    },
    title: {
      ...theme.typography.labelSmBold,
      color: theme.colors.secondary,
    },
    subtitle: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
    },
  });
