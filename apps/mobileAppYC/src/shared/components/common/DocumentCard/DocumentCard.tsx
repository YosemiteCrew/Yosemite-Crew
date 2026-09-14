import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {SwipeableActionCard} from '@/shared/components/common/SwipeableActionCard/SwipeableActionCard';
import {useTheme} from '@/hooks';
import {createCardStyles} from '@/shared/components/common/cardStyles';
import {formatLabel} from '@/shared/utils/helpers';
import {parseISODate} from '@/shared/utils/dateHelpers';

const META_SEPARATOR = '  ·  ';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (date: string | Date): Date => {
  if (typeof date !== 'string') {
    return date;
  }
  // A YYYY-MM-DD issue date is a calendar day. `new Date` reads it as UTC
  // midnight, which is the previous day west of UTC.
  return DATE_ONLY_PATTERN.test(date) ? parseISODate(date) : new Date(date);
};

const formatReadableDate = (date: string | Date): string => {
  const dateObj = toDate(date);
  if (Number.isNaN(dateObj.getTime())) {
    return '—';
  }

  return dateObj.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export interface DocumentCardProps {
  title: string;
  businessName: string;
  visitType: string;
  issueDate: string;
  onPressView?: () => void;
  onPressEdit?: () => void;
  showEditAction?: boolean;
  onPress?: () => void;
  /** Renders a SYNCED pill when the document came from a linked business/PMS. */
  synced?: boolean;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  businessName,
  visitType,
  issueDate,
  onPressView,
  onPressEdit,
  showEditAction = true,
  onPress,
  synced = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  const resolvedTitle = title?.trim() || 'Document';

  const metaLine = useMemo(() => {
    const segments: string[] = [];
    const trimmedVisit = visitType?.trim();
    if (trimmedVisit) {
      segments.push(formatLabel(trimmedVisit, ''));
    }
    const trimmedBusiness = businessName?.trim();
    if (trimmedBusiness) {
      segments.push(trimmedBusiness);
    }
    const trimmedDate = issueDate?.trim();
    if (trimmedDate) {
      const formattedDate = formatReadableDate(trimmedDate);
      if (formattedDate && formattedDate !== '—') {
        segments.push(formattedDate);
      }
    }
    return segments.join(META_SEPARATOR);
  }, [businessName, issueDate, visitType]);

  const handleCardPress = () => {
    onPress?.();
  };

  return (
    <View style={styles.shadowWrapper}>
      <SwipeableActionCard
        cardStyle={cardStyles.card}
        fallbackStyle={cardStyles.fallback}
        onPressView={onPressView}
        onPressEdit={onPressEdit}
        showEditAction={showEditAction}>
        <PressableOpacity
          activeOpacity={onPress ? 0.8 : 1}
          onPress={handleCardPress}
          disabled={!onPress}>
          <View style={styles.content}>
            <View style={styles.iconTile}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={theme.colors.blueText}
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {resolvedTitle}
              </Text>
              {metaLine ? (
                <Text
                  style={styles.meta}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {metaLine}
                </Text>
              ) : null}
            </View>
            {synced ? (
              <View testID="document-synced-pill" style={styles.syncedPill}>
                <View style={styles.syncedDot} />
                <Text style={styles.syncedText}>SYNCED</Text>
              </View>
            ) : null}
            <Ionicons
              name="ellipsis-horizontal"
              size={17}
              color={theme.colors.inkFaint}
            />
          </View>
        </PressableOpacity>
      </SwipeableActionCard>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    shadowWrapper: {
      borderRadius: theme.borderRadius.lg,
      boxShadow: 'none',
      backgroundColor: 'transparent',
    },
    content: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      alignItems: 'center',
    },
    iconTile: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
    },
    title: {
      fontSize: 14.5,
      fontWeight: '600',
      color: theme.colors.inkBody,
    },
    meta: {
      fontSize: 12.5,
      color: theme.colors.inkMuted,
      marginTop: 1,
    },
    syncedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: 3,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
    },
    syncedDot: {
      width: 5,
      height: 5,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.success,
    },
    syncedText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: theme.colors.inkMuted,
      letterSpacing: 0.4,
    },
  });

export default DocumentCard;
