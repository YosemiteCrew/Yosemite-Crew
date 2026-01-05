import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet, ViewStyle, ImageSourcePropType} from 'react-native';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/shared/utils/resolveImageSource';
import {isDummyPhoto as isDummyPhotoUrl} from '@/features/appointments/utils/photoUtils';

export interface BusinessCardProps {
  photo?: ImageSourcePropType | number;
  fallbackPhoto?: ImageSourcePropType | number | string | null;
  name: string;
  openText?: string;
  description?: string;
  distanceText?: string;
  ratingText?: string;
  style?: ViewStyle;
  onBook?: () => void;
  compact?: boolean;
}

export const BusinessCard: React.FC<BusinessCardProps> = ({
  photo,
  fallbackPhoto,
  name,
  openText,
  description,
  distanceText,
  ratingText,
  style,
  onBook,
  compact = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const descriptionText = description && description.trim().length > 0 ? description.trim() : null;

  const [loadFailed, setLoadFailed] = React.useState(false);
  const [sourceOverride, setSourceOverride] = React.useState<ImageSourcePropType | number | undefined>(photo ?? undefined);
  const resolvedSource = useMemo(
    () => resolveImageSource(sourceOverride ?? photo ?? (fallbackPhoto ?? undefined)),
    [sourceOverride, photo, fallbackPhoto],
  );

  const isDummyPhoto = React.useCallback((src?: any) => isDummyPhotoUrl(src), []);

  const handleError = React.useCallback(() => {
    setLoadFailed(true);
    if (fallbackPhoto && sourceOverride !== fallbackPhoto) {
      setSourceOverride(fallbackPhoto as any);
    }
  }, [fallbackPhoto, sourceOverride]);

  React.useEffect(() => {
    // Reset error state when a new photo is supplied
    setLoadFailed(false);
  }, [photo]);

  React.useEffect(() => {
    // If a fallback arrives later and there is no primary photo, prefer the fallback
    if (fallbackPhoto && !photo && sourceOverride !== fallbackPhoto) {
      setSourceOverride(fallbackPhoto as any);
    }
  }, [fallbackPhoto, photo, sourceOverride]);

  React.useEffect(() => {
    // If the provided photo is a known dummy placeholder and we have a fallback, prefer the fallback immediately
    if (fallbackPhoto && isDummyPhoto(photo)) {
      setSourceOverride(fallbackPhoto as any);
    }
  }, [fallbackPhoto, isDummyPhoto, photo]);

  React.useEffect(() => {
    // When a real photo arrives asynchronously, switch to it without waiting for a remount
    if (photo && !loadFailed && sourceOverride !== photo && !(fallbackPhoto && isDummyPhoto(photo))) {
      setSourceOverride(photo as any);
    }
  }, [fallbackPhoto, isDummyPhoto, loadFailed, photo, sourceOverride]);

  return (
    <LiquidGlassCard
      style={[styles.card, compact && styles.compact, style]}
      padding="0"
      shadow="none"
      glassEffect="clear"
      fallbackStyle={styles.cardFallback}>
      <Image
        source={resolvedSource}
        style={[styles.photo, !compact && styles.photoFullWidth]}
        resizeMode="cover"
        defaultSource={Images.hospitalIcon}
        onError={handleError}
      />
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>{name}</Text>
        {!!openText && <Text style={styles.openText}>{openText}</Text>}
        {descriptionText && (
          <Text numberOfLines={2} ellipsizeMode="tail" style={styles.description}>
            {descriptionText}
          </Text>
        )}
        <View style={[styles.metaRow, !(distanceText && ratingText) && styles.metaRowSingle]}>
          {!!distanceText && (
            <View style={styles.metaItem}>
              <Image source={Images.distanceIcon} style={styles.metaIcon} />
              <Text style={styles.metaText}>{distanceText}</Text>
            </View>
          )}
          {!!ratingText && (
            <View style={styles.metaItem}>
              <Image source={Images.starIcon} style={styles.metaIcon} />
              <Text style={styles.metaText}>{ratingText}</Text>
            </View>
          )}
        </View>
        {onBook && (
          <LiquidGlassButton
            title="Book an appointment"
            onPress={onBook}
            tintColor={theme.colors.white}
            textStyle={styles.buttonText}
            style={styles.button}
            forceBorder
            borderColor={theme.colors.secondary}
            height={theme.spacing['10']}
            borderRadius={theme.borderRadius.lg}
          />
        )}
      </View>
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      width: '100%',
      padding: 0,
      overflow: 'hidden',
      marginVertical: theme.spacing['1.25'],
    },
    cardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderColor: theme.colors.borderMuted,
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
    },
    compact: {
      width: theme.spacing['72'],
    },
    photo: {
      width: 240,
      height: 160,
      backgroundColor: theme.colors.border + '20',
      margin: theme.spacing['4'],
      borderRadius: theme.borderRadius.lg,
      alignSelf: 'center',
    },
    photoFullWidth: {
      width: undefined,
      height: 200,
      alignSelf: 'stretch',
      margin: theme.spacing['4'],
    },
    body: {
      paddingHorizontal: theme.spacing['4'],
      paddingBottom: theme.spacing['4'],
      gap: theme.spacing['1.25'],
    },
    title: {
      ...theme.typography.titleSmall,
      color: theme.colors.black,
    },
    openText: {
      ...theme.typography.subtitleBold12,
      color: theme.colors.secondary,
    },
    description: {
      ...theme.typography.body12,
      color: theme.colors.secondary,
      lineHeight: theme.spacing['4'],
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['2'],
      justifyContent: 'space-between',
      width: '100%',
    },
    metaRowSingle: {
      justifyContent: 'flex-start',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
    },
    metaIcon: {
      width: theme.spacing['4'],
      height: theme.spacing['4'],
      resizeMode: 'contain',
    },
    metaText: {
      ...theme.typography.titleSmall,
      color: theme.colors.black,
      lineHeight: theme.spacing['4'],
    },
    button: {
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      marginTop: theme.spacing['2'],
    },
    buttonText: {
      color: theme.colors.secondary,
      fontFamily: theme.typography.titleSmall.fontFamily,
      fontSize: theme.typography.titleSmall.fontSize,
      fontWeight: '500',
      letterSpacing: -0.14,
      lineHeight: theme.typography.titleSmall.fontSize,
    },
  });

export default BusinessCard;
