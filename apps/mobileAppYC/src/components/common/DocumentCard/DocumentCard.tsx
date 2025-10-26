import React, {useMemo} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ImageSourcePropType,
} from 'react-native';
import {SwipeableGlassCard} from '@/components/common/SwipeableGlassCard/SwipeableGlassCard';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

const ACTION_WIDTH = 65;
const OVERLAP_WIDTH = 12; // Empty overlap container to hide seam
const TOTAL_ACTION_WIDTH = ACTION_WIDTH * 2; // Edit + View containers

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
  showEditAction?: boolean;
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

  // Calculate widths: overlap + actions
  const visibleActionWidth = showEditAction ? TOTAL_ACTION_WIDTH : ACTION_WIDTH;
  const totalWidth = OVERLAP_WIDTH + visibleActionWidth;

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      actionWidth={totalWidth}
      actionBackgroundColor="transparent"
      actionOverlap={OVERLAP_WIDTH}
      actionContainerStyle={styles.actionContainer}
      containerStyle={styles.container}
      cardProps={{
        interactive: true,
        glassEffect: 'clear',
        shadow: 'none',
        style: styles.card,
        fallbackStyle: styles.fallback,
      }}
      springConfig={{
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      }}
      renderActionContent={close => (
        <View style={styles.actionWrapper}>
          {/* Container 1: Empty overlap to hide seam behind card border */}
          <View
            style={[
              styles.overlapContainer,
              {
                width: OVERLAP_WIDTH,
                backgroundColor: showEditAction ? theme.colors.primary : theme.colors.success,
              },
            ]}
          />

          {/* Container 2: Edit action (if shown) */}
          {showEditAction && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.actionButton, styles.editActionButton, {width: ACTION_WIDTH}]}
              onPress={() => {
                close();
                onPressEdit?.();
              }}>
              <Image source={Images.editIconSlide} style={styles.actionImage} />
            </TouchableOpacity>
          )}

          {/* Container 3: View action */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.actionButton,
              styles.viewActionButton,
              {width: ACTION_WIDTH},
            ]}
            onPress={() => {
              close();
              onPressView?.();
            }}>
            <Image source={Images.viewIconSlide} style={styles.actionImage} />
          </TouchableOpacity>
        </View>
      )}>
      <TouchableOpacity
        activeOpacity={onPress ? 0.8 : 1}
        onPress={handleCardPress}
        disabled={!onPress}>
        <View style={styles.content}>
          <View style={styles.thumbnailContainer}>
            <Image
              source={thumbnail ?? Images.documentFallback}
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
      </TouchableOpacity>
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
      marginBottom: theme.spacing[3],
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
    },
    actionWrapper: {
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      backgroundColor:theme.colors.primary,
    },
    overlapContainer: {
      height: '100%',
    },
    actionButton: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editActionButton: {
      backgroundColor: theme.colors.primary,
    },
    viewActionButton: {
      backgroundColor: theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    },
    actionImage: {
      width: 30,
      height: 30,
      resizeMode: 'contain',
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
      gap: theme.spacing[4],
      alignItems: 'center',
    },
    thumbnailContainer: {
      width: 48,
      height: 48,
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
      ...theme.typography.labelXsBold,
      color: theme.colors.secondary,
    },
    label: {
      color: theme.colors.textSecondary,
    },
    value: {
      color: theme.colors.secondary,
      fontWeight: '600',
    },
  });

export default DocumentCard;
