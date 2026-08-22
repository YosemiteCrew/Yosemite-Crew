import React, {useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors} from '@/theme';
import type {VetBusiness, BusinessCategory} from '../../types';

export interface ClinicMapPinProps {
  business: VetBusiness;
  isSelected: boolean;
}

// Pins are drawn on the light map style, so the light palette is the right
// one. These used the stale #247AED from the unbuilt design-tokens package
// plus three stock Material swatches with no relationship to warm bone.
const CATEGORY_COLORS: Record<BusinessCategory, string> = {
  hospital: colors.blue,
  groomer: colors.success,
  breeder: colors.warning,
  boarder: colors.violet,
  pet_center: colors.cyanText,
};

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

const ClinicMapPin: React.FC<ClinicMapPinProps> = ({business, isSelected}) => {
  const pinColor = CATEGORY_COLORS[business.category] ?? colors.blue;
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
    borderColor: colors.white,
    borderWidth: 2,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.4)',
  },
  name: {
    color: colors.white,
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
