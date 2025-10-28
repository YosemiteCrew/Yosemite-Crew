import React, {useMemo} from 'react';
import {View, Text, Image, StyleSheet, ViewStyle, ImageSourcePropType} from 'react-native';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {resolveImageSource} from '@/utils/resolveImageSource';

export interface BusinessCardProps {
  photo?: ImageSourcePropType | number;
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

  const imageSource = useMemo(() => resolveImageSource(photo), [photo]);

  return (
    <LiquidGlassCard style={[styles.card, compact && styles.compact, style]} padding="0" shadow="none">
      <Image source={imageSource} style={styles.photo} resizeMode="cover" defaultSource={Images.hospitalIcon} />
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
            tintColor="rgba(255,255,255,0.95)"
            textStyle={styles.buttonText}
            style={styles.button}
            forceBorder
            borderColor="#302F2E"
            height={40}
            borderRadius={16}
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
      marginVertical: 6,
    },
    compact: {
      width: 280,
    },
    photo: {
      width: '100%',
      height: 160,
      backgroundColor: theme.colors.border + '20',
    },
    body: {
      padding: 16,
      gap: 6,
    },
    title: {
      ...theme.typography.businessTitle16,
      color: '#090A0A',
    },
    openText: {
      ...theme.typography.subtitleBold12,
      color: '#302F2E',
    },
    description: {
      ...theme.typography.body12,
      color: '#302F2E',
      lineHeight: 15.6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      marginTop: theme.spacing[2],
      justifyContent: 'space-between',
      width: '100%',
    },
    metaRowSingle: {
      justifyContent: 'flex-start',
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
      color: '#090A0A',
      lineHeight: 16,
    },
    button: {
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: '#302F2E',
      marginTop: 8,
    },
    buttonText: {
      color: '#302F2E',
      fontFamily: theme.typography.businessTitle16.fontFamily,
      fontSize: 14,
      fontWeight: '500',
      letterSpacing: -0.14,
      lineHeight: 14,
    },
  });

export default BusinessCard;
