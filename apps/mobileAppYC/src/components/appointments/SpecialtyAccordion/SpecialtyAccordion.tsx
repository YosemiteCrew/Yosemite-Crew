import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image, Animated} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';

interface Employee {
  id: string;
  name: string;
  title: string;
  specialization: string;
  experienceYears?: number;
  consultationFee?: number;
  avatar?: any;
  rating?: number;
}

interface SpecialtyAccordionProps {
  title: string;
  icon?: any;
  specialties: {
    name: string;
    doctorCount: number;
    employees: Employee[];
  }[];
  onSelectVet: (employeeId: string) => void;
}

interface SpecialtyItemProps {
  specialty: {
    name: string;
    doctorCount: number;
    employees: Employee[];
  };
  defaultExpanded?: boolean;
  onSelectVet: (employeeId: string) => void;
}

const SpecialtyItem: React.FC<SpecialtyItemProps> = ({specialty, onSelectVet, defaultExpanded = false}) => {
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
            {specialty.doctorCount} Doctor{specialty.doctorCount === 1 ? '' : 's'}
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
        <View style={styles.employeesList}>
          {specialty.employees.map(emp => (
            <View key={emp.id} style={styles.employeeCard}>
              {/* Top section: Avatar and basic info */}
              <View style={styles.employeeHeader}>
                <View style={styles.avatarColumn}>
                  <Image
                    source={emp.avatar || Images.cat}
                    style={styles.employeeAvatar}
                    resizeMode="cover"
                  />
                  {emp.rating && (
                    <View style={styles.ratingContainer}>
                      <Image source={Images.starIcon} style={styles.ratingIcon} />
                      <Text style={styles.ratingText}>{emp.rating}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.employeeBasicInfo}>
                  <Text style={styles.employeeName}>{emp.name}</Text>
                  <Text style={styles.employeeSpecialization}>
                    {emp.specialization}
                  </Text>
                  <Text style={styles.employeeTitle}>{emp.title}</Text>
                  <View style={styles.detailStack}>
                    {emp.experienceYears !== undefined && (
                      <Text style={styles.detailLine}>
                        Experience: <Text style={styles.detailValue}>{emp.experienceYears} yrs</Text>
                      </Text>
                    )}
                    {emp.consultationFee !== undefined && (
                      <Text style={styles.detailLine}>
                        Consultation fee: <Text style={styles.detailValue}>${emp.consultationFee}</Text>
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Bottom section: Select Vet button */}
              <LiquidGlassButton
                title="Select Vet"
                onPress={() => onSelectVet(emp.id)}
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
  onSelectVet,
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {/* Parent Header */}
      <View style={styles.parentHeader}>
        {icon && <Image source={icon} style={styles.parentIcon} />}
        <Text style={styles.parentTitle}>{title}</Text>
      </View>

      {/* Specialty Items */}
      <View style={styles.specialtiesList}>
        {specialties.map((specialty, index) => (
          <SpecialtyItem
            key={`${specialty.name}-${index}`}
            specialty={specialty}
            defaultExpanded={index === 0}
            onSelectVet={onSelectVet}
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
    employeesList: {
      padding: theme.spacing[3],
      paddingTop: 0,
      gap: theme.spacing[3],
    },
    employeeCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: theme.spacing[3],
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing[2],
    },
    employeeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
    },
    avatarColumn: {
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    employeeAvatar: {
      width: 68,
      height: 68,
      borderRadius: 34,
    },
    employeeBasicInfo: {
      flex: 1,
      justifyContent: 'center',
      gap: theme.spacing[1],
    },
    employeeName: {
      ...theme.typography.h6Clash,
      color: '#090A0A',
    },
    employeeSpecialization: {
      ...theme.typography.subtitleBold14,
      color: '#302f2e9a',
    },
    employeeTitle: {
      ...theme.typography.subtitleBold14,
      color: '#302f2e9a',
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[1],
    },
    ratingIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    ratingText: {
      ...theme.typography.subtitleBold12,
      color: '#302F2E',
    },
    detailStack: {
      gap: theme.spacing[1.25],
    },
    detailLine: {
      ...theme.typography.subtitleBold12,
      color: '#302f2e9a',
    },
    detailValue: {
      ...theme.typography.subtitleBold12,
      color: '#302F2E',
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
