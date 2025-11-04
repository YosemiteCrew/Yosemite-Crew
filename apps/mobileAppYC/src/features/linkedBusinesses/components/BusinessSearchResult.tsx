import React, {useMemo} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {GOOGLE_PLACES_CONFIG} from '@/config/variables';

interface BusinessSearchResultProps {
  business: any;
  onPress: () => void;
}

export const BusinessSearchResult: React.FC<BusinessSearchResultProps> = ({
  business,
  onPress,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const photoSource = useMemo(() => {
    if (business.photo) {
      // Google Places photo reference
      return {
        uri: `https://places.googleapis.com/v1/${business.photo}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_PLACES_CONFIG.apiKey}`,
      };
    }
    return Images.hospitalIcon;
  }, [business.photo]);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={onPress}>
      <Image
        source={photoSource}
        style={styles.image}
      />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {business.name}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          {business.address}
        </Text>
        <View style={styles.footer}>
          {business.distance && (
            <View style={styles.infoItem}>
              <Image source={Images.distanceIcon} style={styles.icon} />
              <Text style={styles.infoText}>{business.distance}mi</Text>
            </View>
          )}
          {business.rating && (
            <View style={styles.infoItem}>
              <Image source={Images.starIcon} style={styles.icon} />
              <Text style={styles.infoText}>{business.rating}</Text>
            </View>
          )}
        </View>
      </View>
      <Image source={Images.rightArrow} style={styles.arrow} />
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[3],
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing[3],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    image: {
      width: 80,
      height: 80,
      borderRadius: theme.borderRadius.md,
      resizeMode: 'cover',
    },
    content: {
      flex: 1,
      gap: theme.spacing[1],
    },
    name: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
    },
    address: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginTop: theme.spacing[1],
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    icon: {
      width: 14,
      height: 14,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
    infoText: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
    arrow: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
      tintColor: theme.colors.textSecondary,
    },
  });
