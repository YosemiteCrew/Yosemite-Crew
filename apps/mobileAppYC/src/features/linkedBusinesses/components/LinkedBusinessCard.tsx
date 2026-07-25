import React, {
  useMemo,
  useCallback,
  useState,
  useEffect as useReactEffect,
} from 'react';
import {View, Text, Image, StyleSheet, Alert} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {IconTile} from '@/shared/components/common/IconTile/IconTile';
import {Badge} from '@/shared/components/common/Badge/Badge';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {fetchGooglePlacesImage} from '../thunks';
import type {LinkedBusiness} from '../types';
import {openMapsToAddress} from '@/shared/utils/openMaps';

interface LinkedBusinessCardProps {
  business: LinkedBusiness;
  _onDelete?: (id: string) => void;
  onPress?: () => void;
  onDeletePress?: (business: LinkedBusiness) => void;
  showActionButtons?: boolean;
  showBorder?: boolean;
}

type CategoryMeta = {icon: string; bg: string; ink: string; label: string};

const categoryMeta = (theme: any, category?: string): CategoryMeta => {
  const {colors} = theme;
  switch (category) {
    case 'hospital':
      return {
        icon: 'medkit-outline',
        bg: colors.avatarGreenBg,
        ink: colors.avatarGreenInk,
        label: 'Hospital',
      };
    case 'groomer':
      return {
        icon: 'cut-outline',
        bg: colors.pinkGlow,
        ink: colors.pink,
        label: 'Groomer',
      };
    case 'boarder':
      return {
        icon: 'bed-outline',
        bg: colors.avatarVioletBg,
        ink: colors.avatarVioletInk,
        label: 'Boarder',
      };
    case 'breeder':
      return {
        icon: 'ribbon-outline',
        bg: colors.avatarAmberBg,
        ink: colors.avatarAmberInk,
        label: 'Breeder',
      };
    default:
      return {
        icon: 'business-outline',
        bg: colors.blueSoft,
        ink: colors.blueText,
        label: '',
      };
  }
};

const resolvePhotoUri = (
  googlePhoto: string | null,
  businessPhoto: any,
): string | null => {
  if (googlePhoto) return googlePhoto;
  if (typeof businessPhoto === 'string') return businessPhoto;
  if (businessPhoto?.uri) return businessPhoto.uri;
  return null;
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
  const [googlePlacesPhoto, setGooglePlacesPhoto] = useState<string | null>(
    null,
  );

  const meta = useMemo(
    () => categoryMeta(theme, business.category),
    [theme, business.category],
  );

  // Fetch Google Places image for all linked businesses
  useReactEffect(() => {
    if (business.placeId && !googlePlacesPhoto) {
      dispatch(fetchGooglePlacesImage(business.placeId))
        .unwrap()
        .then(result => {
          if (result.photoUrl) {
            setGooglePlacesPhoto(result.photoUrl);
          }
        })
        .catch(error => {
          console.warn(
            '[LinkedBusinessCard] Failed to fetch Google Places image:',
            error,
          );
        });
    }
  }, [business.placeId, dispatch, googlePlacesPhoto]);

  const handleDeletePress = useCallback(() => {
    console.log(
      '[LinkedBusinessCard] Delete button pressed for:',
      business.id,
      business.businessName,
    );
    if (onDeletePress) {
      onDeletePress(business);
    }
  }, [business, onDeletePress]);

  const handleGetDirections = useCallback(() => {
    if (!business.address) {
      Alert.alert('No Address', 'Address not available for this business.');
      return;
    }
    openMapsToAddress(business.address);
  }, [business.address]);

  const photoUri = resolvePhotoUri(googlePlacesPhoto, business.photo);
  const addressText = business.address || 'Address not available';
  const metaLine = [meta.label, addressText].filter(Boolean).join('  ·  ');

  return (
    <LiquidGlassCard
      glassEffect="clear"
      padding="0"
      shadow="sm"
      style={[styles.container, showBorder && styles.containerWithBorder]}
      fallbackStyle={styles.containerFallback}>
      <PressableOpacity
        style={styles.cardContent}
        activeOpacity={0.8}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={business.businessName}
        accessibilityState={{disabled: !onPress}}>
        <View style={styles.content}>
          <IconTile
            size={44}
            backgroundColor={meta.bg}
            style={styles.leadTile}
            {...(photoUri
              ? {
                  icon: {uri: photoUri},
                  iconResizeMode: 'cover' as const,
                  iconSize: 44,
                }
              : {
                  iconNode: (
                    <Ionicons name={meta.icon} size={22} color={meta.ink} />
                  ),
                })}
          />
          <View style={styles.info}>
            <View style={styles.topRow}>
              <Text style={styles.name} numberOfLines={2}>
                {business.businessName}
              </Text>
              <Badge
                label="LINKED"
                tone="success"
                size="sm"
                style={styles.badge}
              />
            </View>
            <Text style={styles.meta} numberOfLines={2}>
              {metaLine}
            </Text>
            {business.distance == null && business.rating == null ? null : (
              <View style={styles.footer}>
                {business.distance == null ? null : (
                  <View style={styles.chip}>
                    <Ionicons
                      name="navigate-outline"
                      size={13}
                      color={theme.colors.inkFaint}
                    />
                    <Text style={styles.chipText}>{business.distance}mi</Text>
                  </View>
                )}
                {business.rating == null ? null : (
                  <View style={styles.chip}>
                    <Ionicons
                      name="star"
                      size={13}
                      color={theme.colors.warning}
                    />
                    <Text style={styles.chipText}>{business.rating}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </PressableOpacity>
      {showActionButtons && (
        <View style={styles.actionButtons}>
          <PressableOpacity
            style={styles.actionButton}
            onPress={handleGetDirections}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel="Get directions">
            <Image source={Images.getDirection} style={styles.actionIcon} />
          </PressableOpacity>
          <PressableOpacity
            style={styles.actionButton}
            onPress={handleDeletePress}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${business.businessName}`}>
            <Image source={Images.deleteIconRed} style={styles.actionIcon} />
          </PressableOpacity>
        </View>
      )}
    </LiquidGlassCard>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      overflow: 'hidden',
      marginBottom: theme.spacing['3'],
    },
    containerFallback: {
      backgroundColor: theme.colors.screen,
      borderRadius: theme.borderRadius.card,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      ...theme.shadows.card,
    },
    containerWithBorder: {
      borderWidth: 1.5,
      borderColor: theme.colors.blue,
    },
    cardContent: {
      flex: 1,
      flexDirection: 'row',
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: theme.spacing['3.5'],
      paddingLeft: theme.spacing['4'],
      paddingRight: theme.spacing['3'],
      gap: theme.spacing['3'],
      alignItems: 'center',
    },
    leadTile: {
      borderRadius: 14,
    },
    info: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
    },
    name: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.inkBody,
      flex: 1,
    },
    badge: {
      marginTop: 1,
    },
    meta: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
    },
    footer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['1'],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['1'],
    },
    chipText: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint,
    },
    actionButtons: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['2.5'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['2.5'],
    },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.screen2,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
