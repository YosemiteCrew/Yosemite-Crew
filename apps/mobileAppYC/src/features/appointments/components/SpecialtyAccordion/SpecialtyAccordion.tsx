import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import {PackageItem} from '@/features/appointments/components/PackageAccordion/PackageAccordion';
import {createAccordionSectionStyles} from '@/features/appointments/components/accordionSectionStyles';

interface Service {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  icon?: any;
}

interface SpecialtyGroup {
  name: string;
  serviceCount: number;
  services: Service[];
  packages: VetPackage[];
}

interface SpecialtyAccordionProps {
  title: string;
  icon?: any;
  specialties: SpecialtyGroup[];
  onSelectService: (serviceId: string, specialtyName: string) => void;
  onSelectPackage: (packageId: string, packageName: string) => void;
}

// ─── Specialty Item ───────────────────────────────────────────────────────────

interface SpecialtyItemProps {
  specialty: SpecialtyGroup;
  defaultExpanded?: boolean;
  onSelectService: (serviceId: string, specialtyName: string) => void;
  onSelectPackage: (packageId: string, packageName: string) => void;
}

const SpecialtyItem: React.FC<SpecialtyItemProps> = ({
  specialty,
  onSelectService,
  onSelectPackage,
  defaultExpanded = false,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [animation] = useState(new Animated.Value(defaultExpanded ? 1 : 0));

  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const rotateInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.specialtyItem}>
      <TouchableOpacity
        style={styles.specialtyHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}>
        <View style={styles.specialtyHeaderContent}>
          <Text style={styles.specialtyName}>{specialty.name}</Text>
          <Text style={styles.doctorCount}>
            {specialty.serviceCount + specialty.packages.length}
          </Text>
        </View>
        <Animated.Image
          source={Images.downArrow}
          style={[
            styles.chevronIcon,
            {transform: [{rotate: rotateInterpolate}]},
          ]}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.servicesList}>
          {specialty.services.map(service => (
            <LiquidGlassCard
              key={service.id}
              glassEffect="clear"
              padding="5"
              shadow="sm"
              style={styles.serviceCard}
              fallbackStyle={styles.serviceCardFallback}>
              <View style={styles.serviceTopRow}>
                <Text
                  style={styles.serviceName}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {service.name}
                </Text>
                {service.basePrice ? (
                  <View style={styles.priceChip}>
                    <Text style={styles.priceChipText}>
                      {resolveCurrencySymbol(service?.currency ?? 'USD')}
                      {service.basePrice}
                    </Text>
                  </View>
                ) : null}
              </View>
              {service.description ? (
                <Text style={styles.serviceDescription}>
                  {service.description}
                </Text>
              ) : null}
              <LiquidGlassButton
                title="Select service"
                onPress={() => onSelectService(service.id, specialty.name)}
                height={theme.spacing['12']}
                borderRadius={theme.borderRadius.md}
                style={styles.selectButton}
                textStyle={styles.selectButtonText}
                tintColor={theme.colors.secondary}
                shadowIntensity="light"
              />
            </LiquidGlassCard>
          ))}

          {specialty.packages.length > 0 && (
            <View style={styles.packagesSectionWrapper}>
              <Text style={styles.packagesSectionLabel}>Packages</Text>
              <View style={styles.pkgList}>
                {specialty.packages.map(pkg => (
                  <PackageItem
                    key={pkg.id}
                    pkg={pkg}
                    compact
                    onSelectPackage={onSelectPackage}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ─── SpecialtyAccordion ───────────────────────────────────────────────────────

export const SpecialtyAccordion: React.FC<SpecialtyAccordionProps> = ({
  title,
  icon,
  specialties,
  onSelectService,
  onSelectPackage,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.parentHeader}>
        {icon && (
          <Image testID="parent-icon" source={icon} style={styles.parentIcon} />
        )}
        <Text style={styles.parentTitle}>{title}</Text>
      </View>

      <View style={styles.specialtiesList}>
        {specialties.map((specialty, index) => (
          <SpecialtyItem
            key={`${specialty.name}-${index}`}
            specialty={specialty}
            defaultExpanded={index === 0}
            onSelectService={onSelectService}
            onSelectPackage={onSelectPackage}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: any) =>
  StyleSheet.create({
    ...createAccordionSectionStyles(theme),
    specialtiesList: {
      gap: theme.spacing['2'],
    },
    specialtyItem: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      boxShadow: `0px 1px 6px ${theme.colors.neutralShadow}`,
      overflow: 'hidden',
    },
    specialtyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing['4'],
      backgroundColor: theme.colors.surface,
    },
    specialtyHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: theme.spacing['3'],
    },
    specialtyName: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    doctorCount: {
      ...theme.typography.paragraphBold,
      color: theme.colors.secondary,
      textAlign: 'right',
    },
    chevronIcon: {
      width: theme.spacing['5'],
      height: theme.spacing['5'],
      tintColor: theme.colors.textSecondary,
    },
    servicesList: {
      padding: theme.spacing['3'],
      paddingTop: 0,
      gap: theme.spacing['3'],
    },
    serviceCard: {
      backgroundColor: theme.colors.cardBackground,
      gap: 7,
    },
    serviceCardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      boxShadow: `0px 4px 6px ${theme.colors.neutralShadow}`,
    },
    serviceTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing['2'],
      marginBottom: theme.spacing['2'],
    },
    serviceName: {
      ...theme.typography.h6Clash,
      color: theme.colors.text,
      flex: 1,
    },
    serviceDescription: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['3'],
    },
    priceChip: {
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryTint,
    },
    priceChipText: {
      ...theme.typography.subtitleBold12,
      color: theme.colors.primary,
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

    // ── Package section inside specialty ──
    packagesSectionWrapper: {
      gap: theme.spacing['2'],
    },
    packagesSectionLabel: {
      ...theme.typography.subtitleBold14,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing['1'],
    },
    pkgList: {
      gap: theme.spacing['2'],
    },
  });

export default SpecialtyAccordion;
