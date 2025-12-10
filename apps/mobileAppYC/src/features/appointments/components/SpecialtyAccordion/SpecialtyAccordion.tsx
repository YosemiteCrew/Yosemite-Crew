import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image, Animated} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
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
          source={Images.arrowDown}
          style={[
            styles.chevronIcon,
            {transform: [{rotate: rotateInterpolate}]},
          ]}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.servicesList}>
          {specialty.services.map(service => (
            <View key={service.id} style={styles.serviceCard}>
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
                height={44}
                borderRadius={12}
                style={styles.selectButton}
                textStyle={styles.selectButtonText}
                tintColor={theme.colors.white}
                shadowIntensity="none"
                forceBorder
                borderColor="#302F2E"
              />
            </View>
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
      marginBottom: theme.spacing[4],
    },
    parentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      paddingHorizontal: theme.spacing[1],
      marginBottom: theme.spacing[3],
    },
    parentIcon: {
      width: 28,
      height: 28,
      resizeMode: 'contain',
    },
    parentTitle: {
      ...theme.typography.h6Clash,
      color: '#302F2E',
    },
    specialtiesList: {
      gap: theme.spacing[2],
    },
    specialtyItem: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    specialtyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing[4],
      backgroundColor: theme.colors.surface,
    },
    specialtyHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: theme.spacing[3],
    },
    specialtyName: {
      ...theme.typography.paragraphBold,
      color: '#595958',
    },
    doctorCount: {
      ...theme.typography.paragraphBold,
      color: '#302F2E',
      textAlign: 'right',
    },
    chevronIcon: {
      width: 20,
      height: 20,
      tintColor: theme.colors.textSecondary,
    },
    servicesList: {
      padding: theme.spacing[3],
      paddingTop: 0,
      gap: theme.spacing[3],
    },
    serviceCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: theme.spacing[5],
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing[1.75],
    },
    serviceTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    serviceName: {
      ...theme.typography.h6Clash,
      color: '#090A0A',
      flex: 1,
    },
    serviceDescription: {
      ...theme.typography.subtitleBold14,
      color: '#302f2e9a',
      marginTop: theme.spacing[1],
            marginBottom: theme.spacing[3],
    },
    priceChip: {
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[1],
      borderRadius: 999,
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
      borderWidth: 1,
      borderColor: '#302F2E',
      borderRadius: 12,
    },
    selectButtonText: {
      ...theme.typography.businessTitle16,
      color: '#302F2E',
      lineHeight: 19.2,
      letterSpacing: -0.16,
    },
  });

export default SpecialtyAccordion;
