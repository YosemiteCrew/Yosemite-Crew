import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors} from '@/theme';
import type {ColorTokens} from '@/theme';
import type {VetBusiness, BusinessCategory} from '../../types';

export interface ClinicMapPinProps {
  business: VetBusiness;
  isSelected: boolean;
  /**
   * Active palette. Defaults to the light one so the pin stays a pure
   * presentational component - useTheme is redux-backed, and reaching into the
   * store from a leaf rendered inside a Marker would couple it to a Provider
   * for the sake of one colour. MapDiscoveryView already holds the theme and
   * passes it down.
   */
  palette?: ColorTokens;
}

// Category colours come from the ACTIVE theme, not the light palette. The map
// itself now has an espresso variant, and several of these tokens differ
// between themes - violet is #7C3AED on bone but #C4B5FD on espresso - so
// pinning them to the light values would put dark pins on a dark map.
const categoryColors = (c: ColorTokens): Record<BusinessCategory, string> => ({
  hospital: c.blue,
  groomer: c.success,
  breeder: c.warning,
  boarder: c.violet,
  pet_center: c.cyanText,
});

const CATEGORY_SYMBOLS: Record<BusinessCategory, string> = {
  hospital: '🏥',
  groomer: '✂️',
  breeder: '🐾',
  boarder: '🏠',
  pet_center: '⭐',
};

const MAX_PIN_NAME_LENGTH = 13;

const truncateName = (name: string): string =>
  name.length > MAX_PIN_NAME_LENGTH
    ? `${name.slice(0, MAX_PIN_NAME_LENGTH)}…`
    : name;

const buildRatingLabel = (business: VetBusiness): string => {
  if (business.rating != null) return `${business.rating}`;
  return CATEGORY_SYMBOLS[business.category] ?? '•';
};

const ClinicMapPin: React.FC<ClinicMapPinProps> = ({
  business,
  isSelected,
  palette = colors,
}) => {
  const pinColor = categoryColors(palette)[business.category] ?? palette.blue;
  const ratingLabel = useMemo(() => buildRatingLabel(business), [business]);
  const displayName = useMemo(
    () => truncateName(business.name),
    [business.name],
  );

  return (
    <View
      collapsable={false}
      style={[styles.container, isSelected && styles.containerSelected]}>
      <View
        style={[
          styles.bubble,
          {backgroundColor: pinColor},
          isSelected && styles.bubbleSelected,
        ]}>
        <Text numberOfLines={1} style={styles.name}>
          {displayName}
        </Text>
        <Text style={styles.rating}>{ratingLabel}</Text>
      </View>
      <View style={[styles.tail, {borderTopColor: pinColor}]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerSelected: {
    transform: [{scale: 1.18}],
    zIndex: 10,
  },
  bubble: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 72,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  bubbleSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.4)',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rating: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

export default ClinicMapPin;
