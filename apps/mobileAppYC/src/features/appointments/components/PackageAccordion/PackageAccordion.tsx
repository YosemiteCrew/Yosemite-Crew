import React, {useState} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import type {VetPackage} from '@/features/appointments/types';
import {createAccordionSectionStyles} from '@/features/appointments/components/accordionSectionStyles';

interface PackageAccordionProps {
  title: string;
  icon?: any;
  packages: VetPackage[];
  onSelectPackage: (packageId: string, packageName: string) => void;
}

interface PackageItemProps {
  pkg: VetPackage;
  defaultExpanded?: boolean;
  compact?: boolean;
  onSelectPackage: (packageId: string, packageName: string) => void;
}

export const PackageItem: React.FC<PackageItemProps> = ({
  pkg,
  onSelectPackage,
  defaultExpanded,
  compact = false,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(
    () => createStyles(theme, compact),
    [theme, compact],
  );
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded));
  const [animation] = useState(new Animated.Value(Number(defaultExpanded)));

  const currencySymbol = resolveCurrencySymbol(pkg.currency ?? 'USD');

  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: compact ? 250 : 300,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const rotateInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const formatPrice = (price: number) =>
    `${currencySymbol} ${price.toFixed(2)}`;

  return (
    <View style={styles.packageItem}>
      <Pressable
        style={({pressed}) => [
          styles.packageHeader,
          pressed && styles.packageHeaderPressed,
        ]}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{expanded}}>
        <View style={styles.packageHeaderContent}>
          <Text
            style={styles.packageName}
            numberOfLines={1}
            ellipsizeMode="tail">
            {pkg.name}
          </Text>
          <View style={styles.totalChip}>
            <Text style={styles.totalChipText}>
              {formatPrice(pkg.totalPrice)}
            </Text>
          </View>
        </View>
        <Animated.Image
          source={Images.downArrow}
          style={[
            styles.chevronIcon,
            {transform: [{rotate: rotateInterpolate}]},
          ]}
        />
      </Pressable>

      {expanded && (
        <LiquidGlassCard
          glassEffect="clear"
          padding="4"
          shadow="sm"
          style={styles.breakdownCard}
          fallbackStyle={styles.breakdownCardFallback}>
          {pkg.description ? (
            <Text style={styles.packageDescription}>{pkg.description}</Text>
          ) : null}

          <View style={styles.itemsList}>
            {pkg.items.map(item => (
              <View key={item.id} style={styles.breakdownRow}>
                <Text
                  style={styles.itemName}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total cost</Text>
            <Text style={styles.totalValue}>{formatPrice(pkg.totalPrice)}</Text>
          </View>

          <LiquidGlassButton
            title="Select package"
            onPress={() => onSelectPackage(pkg.id, pkg.name)}
            height={theme.spacing['12']}
            borderRadius={theme.borderRadius.md}
            style={styles.selectButton}
            textStyle={styles.selectButtonText}
            tintColor={theme.colors.secondary}
            shadowIntensity="light"
          />
        </LiquidGlassCard>
      )}
    </View>
  );
};

export const PackageAccordion: React.FC<PackageAccordionProps> = ({
  title,
  icon,
  packages,
  onSelectPackage,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (!packages.length) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.parentHeader}>
        {icon && (
          <Image
            testID="package-section-icon"
            source={icon}
            style={styles.parentIcon}
          />
        )}
        <Text style={styles.parentTitle}>{title}</Text>
      </View>

      <View style={styles.packagesList}>
        {packages.map((pkg, index) => (
          <PackageItem
            key={pkg.id}
            pkg={pkg}
            defaultExpanded={index === 0}
            onSelectPackage={onSelectPackage}
          />
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: any, compact = false) =>
  StyleSheet.create({
    ...createAccordionSectionStyles(theme),
    packagesList: {
      gap: theme.spacing['2'],
    },
    packageItem: {
      backgroundColor: compact
        ? theme.colors.surface
        : theme.colors.cardBackground,
      borderRadius: compact ? theme.borderRadius.md : theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      boxShadow: `0px ${compact ? 4 : 1}px 6px ${theme.colors.neutralShadow}`,
      overflow: 'hidden',
    },
    packageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: compact ? theme.spacing['3'] : theme.spacing['4'],
      backgroundColor: theme.colors.surface,
    },
    packageHeaderPressed: {
      opacity: 0.7,
    },
    packageHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: compact ? theme.spacing['2'] : theme.spacing['3'],
      gap: theme.spacing['2'],
    },
    packageName: {
      ...theme.typography.paragraphBold,
      color: compact ? theme.colors.text : theme.colors.textSecondary,
      flex: 1,
    },
    totalChip: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryTint,
    },
    totalChipText: {
      ...theme.typography.subtitleBold12,
      color: theme.colors.primary,
    },
    chevronIcon: {
      width: compact ? theme.spacing['4'] : theme.spacing['5'],
      height: compact ? theme.spacing['4'] : theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    breakdownCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 0,
      gap: theme.spacing['1'],
    },
    breakdownCardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
    },
    packageDescription: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['2'],
    },
    itemsList: {
      gap: theme.spacing['2'],
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['1'],
    },
    itemName: {
      ...(compact
        ? theme.typography.subtitleRegular14
        : theme.typography.body14),
      color: theme.colors.text,
      flex: 1,
    },
    itemPrice: {
      ...(compact
        ? theme.typography.subtitleRegular14
        : theme.typography.body14),
      color: theme.colors.text,
      marginLeft: theme.spacing['3'],
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.borderMuted,
      marginVertical: theme.spacing['3'],
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing['3'],
    },
    totalLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    totalValue: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
    },
    selectButton: {
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.borderRadius.lg,
    },
    selectButtonText: {
      ...theme.typography.titleSmall,
      color: theme.colors.white,
    },
  });

export default PackageAccordion;
