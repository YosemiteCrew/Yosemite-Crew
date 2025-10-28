import React, {useMemo} from 'react';
import {ScrollView, View, StyleSheet} from 'react-native';
import {useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {SpecialtyAccordion} from '@/components/appointments/SpecialtyAccordion';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import VetBusinessCard from '@/components/appointments/VetBusinessCard/VetBusinessCard';
import {createSelectEmployeesForBusiness} from '@/features/appointments/selectors';
import type {RootState} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BusinessDetailsScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const businessId = route.params?.businessId as string;
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === businessId));
  const employeesSelector = React.useMemo(() => createSelectEmployeesForBusiness(), []);
  const employees = useSelector((state: RootState) => employeesSelector(state, businessId));

  // Group employees by specialty for accordion
  const specialties = useMemo(() => {
    const groups: Record<string, typeof employees> = {};
    for (const emp of employees) {
      const key = emp.specialization || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(emp);
    }

    return Object.entries(groups).map(([name, emps]) => ({
      name,
      doctorCount: emps.length,
      employees: emps,
    }));
  }, [employees]);

  const handleSelectVet = (employeeId: string) => {
    navigation.navigate('BookingForm', {businessId, employeeId});
  };

  return (
    <SafeArea>
      <Header title="Book an appointment" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Card */}
        <VetBusinessCard
          style={styles.businessCard}
          name={business?.name || ''}
          openHours={business?.openHours}
          distance={business?.distanceMi ? `${business.distanceMi}mi` : undefined}
          rating={business?.rating ? `${business.rating}` : undefined}
          address={business?.address}
          website={business?.website}
          photo={business?.photo}
          cta=""
        />

        {/* Specialties Accordion */}
        <SpecialtyAccordion
          title="Specialties"
          icon={Images.specialityIcon}
          specialties={specialties}
          onSelectVet={handleSelectVet}
        />

        {/* Get Directions Button */}
        <View style={styles.footer}>
          <LiquidGlassButton
            title="Get Directions"
            onPress={() => {}}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="none"
            forceBorder
            borderColor="rgba(255, 255, 255, 0.35)"
          />
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[24],
  },
  businessCard: {
    marginBottom: theme.spacing[5],
  },
  footer: {
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
});

export default BusinessDetailsScreen;
