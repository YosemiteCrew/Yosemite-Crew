import React, {useMemo} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {LinkedBusiness} from '../types';

interface LinkedBusinessCardProps {
  business: LinkedBusiness;
  onDelete: (id: string) => void;
  onPress?: () => void;
}

export const LinkedBusinessCard: React.FC<LinkedBusinessCardProps> = ({
  business,
  onDelete,
  onPress,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Business',
      `Are you sure you want to remove ${business.businessName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(business.id),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.8}
      onPress={onPress}>
      <View style={styles.content}>
        <Image
          source={business.photo || Images.sampleHospital1}
          style={styles.image}
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {business.businessName}
          </Text>
          <Text style={styles.address} numberOfLines={2}>
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
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Image
            source={Images.locationIcon}
            style={styles.actionIcon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleDelete}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Image
            source={Images.deleteIconRed}
            style={styles.actionIcon}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
      ...theme.typography.titleSmall,
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
      tintColor: theme.colors.textSecondary,
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
      tintColor: theme.colors.secondary,
    },
  });
