import React, {useMemo} from 'react';
import {ScrollView, View, StyleSheet, Text} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {SpecialtyAccordion} from '@/features/appointments/components/SpecialtyAccordion';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import VetBusinessCard from '@/features/appointments/components/VetBusinessCard/VetBusinessCard';
import {createSelectServicesForBusiness} from '@/features/appointments/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import {openMapsToAddress, openMapsToPlaceId} from '@/shared/utils/openMaps';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertDistance} from '@/shared/utils/measurementSystem';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BusinessDetailsScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  const {distanceUnit} = usePreferences();
  const businessId = route.params?.businessId as string;
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === businessId));
  const servicesSelector = React.useMemo(() => createSelectServicesForBusiness(), []);
  const services = useSelector((state: RootState) => servicesSelector(state, businessId));
  const totalServices = useSelector((state: RootState) => state.businesses.services.length);
  const [fallbackPhoto, setFallbackPhoto] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!business) {
      dispatch(fetchBusinesses({serviceName: undefined}));
    }
    if (totalServices === 0) {
      dispatch(fetchBusinesses());
    }
  }, [business, dispatch, totalServices]);

  React.useEffect(() => {
    if (!business?.googlePlacesId) return;
    const isDummy = isDummyPhoto(business.photo);
    if (!business.photo || isDummy) {
      dispatch(fetchBusinessDetails(business.googlePlacesId))
        .unwrap()
        .then(res => {
          if (res.photoUrl) setFallbackPhoto(res.photoUrl);
        })
        .catch(() => {
          dispatch(fetchGooglePlacesImage(business.googlePlacesId as string))
            .unwrap()
            .then(img => {
              if (img.photoUrl) setFallbackPhoto(img.photoUrl);
            })
            .catch(() => {});
        });
    }
  }, [business?.googlePlacesId, business?.photo, dispatch]);

  // Group services by specialty for accordion
  const specialties = useMemo(() => {
    const groups: Record<string, typeof services> = {};
    for (const svc of services) {
      const key = svc.specialty || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(svc);
    }

    return Object.entries(groups).map(([name, emps]) => ({
      name,
      serviceCount: emps.length,
      services: emps,
    }));
  }, [services]);

  const handleSelectService = (serviceId: string, specialtyName: string) => {
    const service = services.find(s => s.id === serviceId);
    navigation.navigate('BookingForm', {
      businessId,
      serviceId,
      serviceName: service?.name,
      serviceSpecialty: specialtyName ?? undefined,
      serviceSpecialtyId: service?.specialityId ?? undefined,
    });
  };

  // Convert distance based on user preference
  const displayDistance = useMemo(() => {
    if (!business?.distanceMi) return undefined;

    if (distanceUnit === 'km') {
      const distanceKm = convertDistance(business.distanceMi, 'mi', 'km');
      return `${distanceKm.toFixed(1)}km`;
    }

    return `${business.distanceMi.toFixed(1)}mi`;
  }, [business?.distanceMi, distanceUnit]);

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
          distance={displayDistance}
          rating={business?.rating ? `${business.rating}` : undefined}
          address={business?.address}
          website={business?.website}
          photo={business?.photo}
          fallbackPhoto={fallbackPhoto ?? undefined}
          cta=""
        />

        {/* Specialties Accordion */}
        {specialties.length ? (
          <SpecialtyAccordion
            title="Specialties"
            icon={Images.specialityIcon}
            specialties={specialties}
            onSelectService={handleSelectService}
          />
        ) : (
          <View style={styles.emptyServicesCard}>
            <Text style={styles.emptyServicesTitle}>Services coming soon</Text>
            <Text style={styles.emptyServicesSubtitle}>
              This business has not published individual services yet. Please contact them directly for availability.
            </Text>
          </View>
        )}

        {/* Get Directions Button */}
        <View style={styles.footer}>
          <LiquidGlassButton
            title="Get Directions"
            onPress={() => {
              if (business?.googlePlacesId) {
                openMapsToPlaceId(business.googlePlacesId, business?.address);
              } else if (business?.address) {
                openMapsToAddress(business.address);
              }
            }}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            textStyle={styles.buttonText}
            glassEffect="clear"
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
  buttonText: {
    ...theme.typography.cta,
    color: theme.colors.white,
  },
  emptyServicesCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardBackground,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
       marginBottom: theme.spacing[4],
  },
  emptyServicesTitle: {
    ...theme.typography.titleSmall,
    color: theme.colors.secondary,
  },
  emptyServicesSubtitle: {
    ...theme.typography.body12,
    color: theme.colors.textSecondary,
  },
});

export default BusinessDetailsScreen;
