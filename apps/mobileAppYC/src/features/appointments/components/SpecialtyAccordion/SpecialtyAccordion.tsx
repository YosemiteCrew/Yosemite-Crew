import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image, Animated, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {resolveCurrencySymbol} from '@/shared/utils/currency';

interface Service {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  currency?: string;
  icon?: any;
}

interface SpecialtyAccordionProps {
  title: string;
  icon?: any;
  specialties: {
    name: string;
    serviceCount: number;
    services: Service[];
  }[];
  onSelectService: (serviceId: string, specialtyName: string) => void;
}

interface SpecialtyItemProps {
  specialty: SpecialtyAccordionProps['specialties'][number];
  defaultExpanded?: boolean;
  onSelectService: (serviceId: string, specialtyName: string) => void;
}

const SpecialtyItem: React.FC<SpecialtyItemProps> = ({specialty, onSelectService, defaultExpanded = false}) => {
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
        activeOpacity={0.7}
      >
        <View style={styles.specialtyHeaderContent}>
          <Text style={styles.specialtyName}>{specialty.name}</Text>
          <Text style={styles.doctorCount}>
            {specialty.serviceCount} Service{specialty.serviceCount === 1 ? '' : 's'}
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
                <Text style={styles.serviceName} numberOfLines={1} ellipsizeMode="tail">
                  {service.name}
                </Text>
                {service.basePrice ? (
                  <View style={styles.priceChip}>
                    <Text style={styles.priceChipText}>{resolveCurrencySymbol(service?.currency ?? 'USD')}{service.basePrice}</Text>
                  </View>
                ) : null}
              </View>
              {service.description ? (
                <Text style={styles.serviceDescription}>{service.description}</Text>
              ) : null}
              <LiquidGlassButton
                title="Select service"
                onPress={() => onSelectService(service.id, specialty.name)}
                height={theme.spacing['12']}
                borderRadius={theme.borderRadius.md}
                style={styles.selectButton}
                textStyle={styles.selectButtonText}
                tintColor={theme.colors.secondary}
                shadowIntensity="none"
              />
            </LiquidGlassCard>
          ))}
        </View>
      )}
    </View>
  );
};

export const SpecialtyAccordion: React.FC<SpecialtyAccordionProps> = ({
  title,
  icon,
  specialties,
  onSelectService,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.parentHeader}>
        {icon && <Image source={icon} style={styles.parentIcon} />}
        <Text style={styles.parentTitle}>{title}</Text>
      </View>

      <View style={styles.specialtiesList}>
        {specialties.map((specialty, index) => (
          <SpecialtyItem
            key={`${specialty.name}-${index}`}
            specialty={specialty}
            defaultExpanded={index === 0}
            onSelectService={onSelectService}
          />
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing['4'],
    },
    parentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['2'],
      paddingHorizontal: theme.spacing['1'],
      marginBottom: theme.spacing['3'],
    },
    parentIcon: {
      width: theme.spacing['7'],
      height: theme.spacing['7'],
      resizeMode: 'contain',
    },
    parentTitle: {
      ...theme.typography.h6Clash,
      color: theme.colors.secondary,
    },
    specialtiesList: {
      gap: theme.spacing['2'],
    },
    specialtyItem: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: theme.borderRadius.lg,
      borderWidth: Platform.OS === 'android' ? 1 : 1,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
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
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
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
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
    },
    selectButtonText: {
      ...theme.typography.titleSmall,
      color: theme.colors.white,
    },
  });

export default SpecialtyAccordion;
