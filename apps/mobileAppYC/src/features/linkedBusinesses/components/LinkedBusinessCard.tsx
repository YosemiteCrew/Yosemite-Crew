import React, {useMemo, useCallback, useState, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {fetchGooglePlacesImage} from '../thunks';
import type {LinkedBusiness} from '../types';

interface LinkedBusinessCardProps {
  business: LinkedBusiness;
  _onDelete?: (id: string) => void;
  onPress?: () => void;
  onDeletePress?: (business: LinkedBusiness) => void;
  showActionButtons?: boolean;
  showBorder?: boolean;
}

const getImageSource = (googlePhoto: string | null, businessPhoto: string | null) => {
  if (googlePhoto) return {uri: googlePhoto};
  if (businessPhoto) return {uri: businessPhoto};
  return Images.sampleHospital1;
};

export const LinkedBusinessCard: React.FC<LinkedBusinessCardProps> = ({
  business,
  _onDelete,
  onPress,
  onDeletePress,
  showActionButtons = true,
  showBorder = false,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const [googlePlacesPhoto, setGooglePlacesPhoto] = useState<string | null>(null);

  // Fetch Google Places image for all linked businesses
  useEffect(() => {
    if (business.placeId && !googlePlacesPhoto) {
      dispatch(fetchGooglePlacesImage(business.placeId))
        .unwrap()
        .then(result => {
          if (result.photoUrl) {
            setGooglePlacesPhoto(result.photoUrl);
          }
        })
        .catch(error => {
          console.warn('[LinkedBusinessCard] Failed to fetch Google Places image:', error);
        });
    }
  }, [business.placeId, dispatch, googlePlacesPhoto]);

  const handleDeletePress = useCallback(() => {
    console.log('[LinkedBusinessCard] Delete button pressed for:', business.id, business.businessName);
    if (onDeletePress) {
      onDeletePress(business);
    }
  }, [business, onDeletePress]);

  const handleGetDirections = useCallback(() => {
    if (!business.address) {
      Alert.alert('No Address', 'Address not available for this business.');
      return;
    }
    // Open maps with the business address
    const encodedAddress = encodeURIComponent(business.address);
    const mapsUrl = `maps://maps.google.com/?q=${encodedAddress}`;
    const appleMapsUrl = `maps://?address=${encodedAddress}`;

    Linking.canOpenURL(mapsUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(mapsUrl);
        }
        return Linking.openURL(appleMapsUrl);
      })
      .catch(() => {
        // Fallback to web version
        Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
      });
  }, [business.address]);

  return (
    <View style={[styles.container, showBorder && styles.containerWithBorder]}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.8}
        onPress={onPress}
        disabled={!onPress}>
        <View style={styles.content}>
          <Image
            source={getImageSource(googlePlacesPhoto, business.photo)}
            style={styles.image}
          />
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>
              {business.businessName}
            </Text>
            <Text style={styles.address} numberOfLines={3}>
              {business.address || 'Address not available'}
            </Text>
            <View style={styles.footer}>
              {business.distance && (
                <View style={styles.ratingContainer}>
                  <Image source={Images.distanceIcon} style={styles.icon} />
                  <Text style={styles.ratingText}>
                    {business.distance}mi
                  </Text>
                </View>
              )}
              {business.rating && (
                <View style={styles.ratingContainer}>
                  <Image source={Images.starIcon} style={styles.icon} />
                  <Text style={styles.ratingText}>
                    {business.rating}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
      {showActionButtons && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleGetDirections}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Image
              source={Images.getDirection}
              style={styles.actionIcon}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDeletePress}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Image
              source={Images.deleteIconRed}
              style={styles.actionIcon}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      marginBottom: theme.spacing[3],
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.sm,
    },
    containerWithBorder: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    cardContent: {
      flex: 1,
      flexDirection: 'row',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      padding: theme.spacing[3],
      gap: theme.spacing[3],
    },
    image: {
      width: 100,
      height: 100,
      borderRadius: theme.borderRadius.md,
      resizeMode: 'cover',
    },
    info: {
      flex: 1,
      justifyContent: 'space-between',
    },
    name: {
      ...theme.typography.titleMedium,
      color: theme.colors.text,
      marginBottom: theme.spacing[1],
    },
    address: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing[2],
    },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing[4],
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    icon: {
      width: 14,
      height: 14,
      resizeMode: 'contain',
    },
    ratingText: {
      ...theme.typography.bodyExtraSmall,
      color: theme.colors.textSecondary,
    },
    actionButtons: {
      flexDirection: 'column',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[3],
      gap: theme.spacing[2],
    },
    actionButton: {
      padding: theme.spacing[2],
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
    },
  });
