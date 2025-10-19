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
const ACTION_OVERLAP = 10;

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

  const actionCount = showEditAction ? 2 : 1;
  const totalActionWidth = ACTION_WIDTH * actionCount;
  const baseActionColor = showEditAction
    ? theme.colors.primary
    : theme.colors.success;
  const actionBackgroundStyle = useMemo(
    () => ({
      width: totalActionWidth + ACTION_OVERLAP,
      backgroundColor: showEditAction ? theme.colors.primary : theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    }),
    [showEditAction, theme.colors.primary, theme.colors.success, theme.borderRadius.lg, totalActionWidth],
  );

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <SwipeableGlassCard
      actionIcon={Images.viewIconSlide}
      actionWidth={totalActionWidth}
      actionBackgroundColor={baseActionColor}
      actionOverlap={ACTION_OVERLAP}
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
        <View style={[styles.actionWrapper, {width: totalActionWidth}]}>
          <View style={[styles.actionBackground, actionBackgroundStyle]} />
          <View style={styles.actionRow}>
            {showEditAction ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.actionButton, styles.editActionButton]}
                onPress={() => {
                  close();
                  onPressEdit?.();
                }}>
                <Image source={Images.editIconSlide} style={styles.actionImage} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.actionButton,
                styles.viewActionButton,
                !showEditAction && styles.singleActionButton,
              ]}
              onPress={() => {
                close();
                onPressView?.();
              }}>
              <Image source={Images.viewIconSlide} style={styles.actionImage} />
            </TouchableOpacity>
          </View>
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
      height: '100%',
      alignSelf: 'flex-end',
      position: 'relative',
      width: '100%',
    },
    actionBackground: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: -ACTION_OVERLAP,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    },
    actionRow: {
      flexDirection: 'row',
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
    actionButton: {
      width: ACTION_WIDTH,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editActionButton: {
      backgroundColor: theme.colors.primary,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderBottomLeftRadius: theme.borderRadius.lg,
    },
    viewActionButton: {
      backgroundColor: theme.colors.success,
      borderTopRightRadius: theme.borderRadius.lg,
      borderBottomRightRadius: theme.borderRadius.lg,
    },
    singleActionButton: {
      borderTopLeftRadius: theme.borderRadius.lg,
      borderBottomLeftRadius: theme.borderRadius.lg,
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
