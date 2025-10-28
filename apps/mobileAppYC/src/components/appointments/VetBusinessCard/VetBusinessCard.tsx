import React, {useMemo} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, ImageSourcePropType} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/utils/resolveImageSource';

export interface VetBusinessCardProps {
  photo?: ImageSourcePropType | number;
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
}

export const VetBusinessCard: React.FC<VetBusinessCardProps> = ({
  photo,
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
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const imageSource = useMemo(() => resolveImageSource(photo), [photo]);

  return (
    <View style={[styles.card, style]}>
      <Image source={imageSource} style={styles.photo} resizeMode="cover" defaultSource={Images.hospitalIcon} />
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
            <Text style={styles.websiteText}>{website}</Text>
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
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'column',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: theme.spacing[3],
      backgroundColor: theme.colors.cardBackground,
      overflow: 'hidden',
    },
    photo: {
      width: '100%',
      height: 160,
      borderRadius: 12,
      marginBottom: theme.spacing[3],
      backgroundColor: theme.colors.border + '20',
    },
    infoContainer: {
      gap: 3,
    },
    name: {
      ...theme.typography.h6Clash,
      color: '#302F2E',
      marginBottom: 3,
    },
    openHours: {
      ...theme.typography.subtitleBold14,
      color: '#302f2e9a',
      marginBottom: 3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      marginBottom: 3,
      flexWrap: 'nowrap',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    metaIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    metaText: {
      ...theme.typography.businessTitle16,
      color: '#302F2E',
      lineHeight: 16,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing[1],
      marginBottom: 3,
    },
    addressText: {
      ...theme.typography.subtitleBold14,
      color: '#302F2E',
      flex: 1,
    },
    websiteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
      marginBottom: 3,
    },
    websiteText: {
      ...theme.typography.subtitleBold14,
      color: '#302F2E',
    },
    meta: {
      ...theme.typography.body14,
      color: '#595958',
    },
    cta: {
      marginTop: theme.spacing[2],
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
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
