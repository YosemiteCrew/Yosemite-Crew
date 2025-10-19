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

const ACTION_WIDTH = 65;

const formatDateDDMMYYYY = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};

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

  const actionOpacity = translateX.interpolate({
    inputRange: [-totalActionWidth, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.actionContainer,
          {
            opacity: actionOpacity,
            backgroundColor: showEditAction
              ? theme.colors.primary
              : theme.colors.success,
          },
        ]}>
        {showEditAction && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionButton, styles.editActionButton]}
            onPress={() => handleActionPress(onPressEdit)}>
            <Image source={Images.editIconSlide} style={styles.actionImage} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.actionButton}
          onPress={() => handleActionPress(onPressView)}>
          <Image source={Images.viewIconSlide} style={styles.actionImage} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.animatedWrapper, {transform: [{translateX}]}]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          disabled={!onPress}>
          <LiquidGlassCard
            interactive
            glassEffect="clear"
            shadow="none"
            style={styles.card}
            fallbackStyle={styles.fallback}>
            <View style={styles.content}>
              <View style={styles.thumbnailContainer}>
                <Image
                  source={thumbnail || Images.documentFallback}
                  style={styles.thumbnail}
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                  <Text style={styles.label}>Title: </Text>
                  <Text style={styles.value}>{title}</Text>
                </Text>
                <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                  <Text style={styles.label}>Business: </Text>
                  <Text style={styles.value}>{businessName}</Text>
                </Text>
                <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                  <Text style={styles.label}>Visit type: </Text>
                  <Text style={styles.value}>{visitType}</Text>
                </Text>
                <Text style={styles.infoRow} numberOfLines={1} ellipsizeMode="tail">
                  <Text style={styles.label}>Issue Date: </Text>
                  <Text style={styles.value}>{formatDateDDMMYYYY(issueDate)}</Text>
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
      borderRadius: theme.borderRadius.lg,
      zIndex: 0,
      paddingLeft: theme.spacing[10], // Extra padding to extend behind curved border
    },
    actionButton: {
      width: ACTION_WIDTH,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.success,
    },
    editActionButton: {
      backgroundColor: theme.colors.primary,
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
    infoRow: {
      ...theme.typography.labelXxsBold,
    },
    label: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
    },
    value: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.secondary,
    },
  });
