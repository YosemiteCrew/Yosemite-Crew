import React, {useEffect, useMemo, useState} from 'react';
import {View, Text, Image, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useDispatch} from 'react-redux';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {AppDispatch} from '@/app/store';
import {fetchGooglePlacesImage} from '@/features/linkedBusinesses/thunks';
import type {LinkedBusiness} from '@/features/linkedBusinesses/types';
import {capitalize} from '@/shared/utils/commonHelpers';

interface AERBusinessSelectCardProps {
  business: LinkedBusiness;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const resolveAvatar = (
  theme: any,
  styles: any,
  category: LinkedBusiness['category'],
) => {
  switch (category) {
    case 'boarder':
      return {
        style: styles.avatarViolet,
        ink: theme.colors.avatarVioletInk,
        icon: 'home-outline',
      };
    case 'breeder':
      return {
        style: styles.avatarGreen,
        ink: theme.colors.avatarGreenInk,
        icon: 'paw-outline',
      };
    case 'groomer':
      return {
        style: styles.avatarAmber,
        ink: theme.colors.avatarAmberInk,
        icon: 'cut-outline',
      };
    default:
      return {
        style: styles.avatarAmber,
        ink: theme.colors.avatarAmberInk,
        icon: 'medkit-outline',
      };
  }
};

const AERBusinessSelectCardComponent: React.FC<AERBusinessSelectCardProps> = ({
  business,
  isSelected,
  onSelect,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const [googlePhoto, setGooglePhoto] = useState<string | null>(null);

  useEffect(() => {
    if (business.placeId && !googlePhoto) {
      dispatch(fetchGooglePlacesImage(business.placeId))
        .unwrap()
        .then(result => {
          if (result.photoUrl) {
            setGooglePhoto(result.photoUrl);
          }
        })
        .catch(() => {
          setGooglePhoto(null);
        });
    }
  }, [business.placeId, dispatch, googlePhoto]);

  const avatar = resolveAvatar(theme, styles, business.category);
  const photoUri =
    googlePhoto ?? (typeof business.photo === 'string' ? business.photo : null);
  const meta = business.address || capitalize(business.category);

  return (
    <PressableOpacity
      activeOpacity={0.9}
      onPress={() => onSelect(business.id)}
      accessibilityRole="radio"
      accessibilityState={{selected: isSelected}}
      accessibilityLabel={business.businessName}
      style={[styles.card, isSelected && styles.cardSelected]}>
      <View style={[styles.avatar, avatar.style]}>
        {photoUri ? (
          <Image source={{uri: photoUri}} style={styles.avatarImage} />
        ) : (
          <Ionicons name={avatar.icon} size={24} color={avatar.ink} />
        )}
      </View>

      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            isSelected ? styles.nameSelected : styles.nameUnselected,
          ]}
          numberOfLines={1}>
          {business.businessName}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {isSelected ? (
        <View style={styles.checkChip}>
          <Ionicons name="checkmark" size={15} color="#4a1030" />
        </View>
      ) : null}
    </PressableOpacity>
  );
};

export const AERBusinessSelectCard = React.memo(AERBusinessSelectCardComponent);

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['3.5'],
      borderRadius: theme.borderRadius.cardSmall,
      borderWidth: 1.5,
      borderColor: theme.colors.hairline,
      backgroundColor: theme.colors.screen,
      marginBottom: theme.spacing['3'],
    },
    cardSelected: {
      borderColor: theme.colors.pink,
      ...theme.shadows.companion,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: theme.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarAmber: {
      backgroundColor: theme.colors.avatarAmberBg,
    },
    avatarViolet: {
      backgroundColor: theme.colors.avatarVioletBg,
    },
    avatarGreen: {
      backgroundColor: theme.colors.avatarGreenBg,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    info: {
      flex: 1,
    },
    name: {
      ...theme.typography.paragraphBold,
    },
    nameSelected: {
      color: theme.colors.ink,
    },
    nameUnselected: {
      color: theme.colors.inkBody,
    },
    meta: {
      ...theme.typography.caption,
      color: theme.colors.inkFaint,
      marginTop: theme.spacing['1'],
    },
    checkChip: {
      width: 24,
      height: 24,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.pink,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default AERBusinessSelectCard;
