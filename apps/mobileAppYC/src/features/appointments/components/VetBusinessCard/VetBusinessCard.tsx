import React, {useMemo} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, ImageSourcePropType} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/shared/utils/resolveImageSource';

export interface VetBusinessCardProps {
  photo?: ImageSourcePropType | number | string;
  fallbackPhoto?: ImageSourcePropType | number | string;
  name: string;
  openHours?: string;
  address?: string;
  distance?: string;
  rating?: string;
  website?: string;
  meta?: string;
  style?: ViewStyle;
  onPress?: () => void;
  cta?: string;
  onImageLoadError?: () => void;
}

export const VetBusinessCard: React.FC<VetBusinessCardProps> = ({
  photo,
  fallbackPhoto,
  name,
  openHours,
  address,
  distance,
  rating,
  website,
  meta,
  style,
  onPress,
  cta = 'Book an appointment',
  onImageLoadError,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imageSource, setImageSource] = React.useState<ImageSourcePropType | number | string | undefined>(photo);

  const resolvedImageSource = useMemo(() => resolveImageSource(imageSource || photo), [imageSource, photo]);

  const handleImageLoadError = React.useCallback(() => {
    console.log('[VetBusinessCard] Image load failed for:', name);
    console.log('[VetBusinessCard] Using fallback photo:', fallbackPhoto);
    onImageLoadError?.();
    // If we have a fallback photo, use it
    if (fallbackPhoto && fallbackPhoto !== (imageSource || photo)) {
      setImageSource(fallbackPhoto);
    }
  }, [name, fallbackPhoto, imageSource, photo, onImageLoadError]);

  return (
    <View style={[styles.card, style]}>
      <Image source={resolvedImageSource} style={styles.photo} resizeMode="cover" defaultSource={Images.hospitalIcon} onError={handleImageLoadError} />
      <View style={styles.contentPadding}>
        <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>

        {openHours && <Text style={styles.openHours}>{openHours}</Text>}

        {/* Distance and Rating Row */}
        {(distance || rating) && (
          <View style={styles.metaRow}>
            {distance && (
              <View style={styles.metaItem}>
                <Image source={Images.distanceIcon} style={styles.metaIcon} />
                <Text style={styles.metaText}>{distance}</Text>
              </View>
            )}
            {rating && (
              <View style={styles.metaItem}>
                <Image source={Images.starIcon} style={styles.metaIcon} />
                <Text style={styles.metaText}>{rating}</Text>
              </View>
            )}
          </View>
        )}

        {/* Address with icon */}
        {address && (
          <View style={styles.addressRow}>
            <Image source={Images.locationIcon} style={styles.metaIcon} />
            <Text style={styles.addressText} numberOfLines={2}>
              {address}
            </Text>
          </View>
        )}

        {/* Website with icon */}
        {website && (
          <View style={styles.websiteRow}>
            <Image source={Images.websiteIcon} style={styles.metaIcon} />
            <Text style={styles.websiteText} numberOfLines={1}>
              {website}
            </Text>
          </View>
        )}

        {/* Legacy meta support */}
        {!!meta && !address && <Text style={styles.meta}>{meta}</Text>}

        {Boolean(cta?.length) && (
          <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.ctaText}>{cta}</Text>
          </TouchableOpacity>
        )}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'column',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    photo: {
      width: '100%',
      height: theme.spacing['60'],
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.border + '20',
    },
    contentPadding: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
    },
    infoContainer: {
      gap: theme.spacing['1'],
    },
    name: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['3.5'],
      lineHeight: 22,
    },
    openHours: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.secondary + '9a',
      marginBottom: theme.spacing['3.5'],
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['3.5'],
      flexWrap: 'wrap',
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
      color: theme.colors.secondary,
      lineHeight: theme.spacing['4'],
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['3.5'],
    },
    addressText: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
      flex: 1,
    },
    websiteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['3.5'],
    },
    websiteText: {
      ...theme.typography.inputLabel,
      color: theme.colors.secondary,
      flex: 1,
    },
    meta: {
      ...theme.typography.body14,
      color: theme.colors.placeholder,
    },
    cta: {
      marginTop: theme.spacing['2'],
      marginHorizontal: -theme.spacing['4'],
      marginBottom: -theme.spacing['3'],
      marginLeft: -theme.spacing['4'],
      marginRight: -theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
      alignItems: 'center',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    ctaText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
    },
  });

export default VetBusinessCard;
