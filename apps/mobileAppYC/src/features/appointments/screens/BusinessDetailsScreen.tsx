import React, {useMemo} from 'react';
import {
  Alert,
  ScrollView,
  View,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import {SpecialtyAccordion} from '@/features/appointments/components/SpecialtyAccordion';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import VetBusinessCard from '@/features/appointments/components/VetBusinessCard/VetBusinessCard';
import {createSelectServicesForBusiness} from '@/features/appointments/selectors';
import type {AppDispatch, RootState} from '@/app/store';
import {
  useRoute,
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
import {openMapsToAddress, openMapsToPlaceId} from '@/shared/utils/openMaps';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {MOCK_CLINICS} from '@/features/appointments/mocks/clinicMocks';
import {convertDistance} from '@/shared/utils/measurementSystem';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {TabParamList} from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const MOCK_CLINIC_MAP = new Map(MOCK_CLINICS.map(c => [c.id, c]));

export const BusinessDetailsScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const dispatch = useDispatch<AppDispatch>();
  const {distanceUnit} = usePreferences();
  const businessId = route.params?.businessId as string;
  const paramDistanceMi = route.params?.distanceMi as number | undefined;
  const returnTo = route.params?.returnTo as
    | {tab?: keyof TabParamList; screen?: string}
    | undefined;
  const reduxBusiness = useSelector((s: RootState) =>
    s.businesses.businesses.find(b => b.id === businessId),
  );
  const business = reduxBusiness ?? MOCK_CLINIC_MAP.get(businessId);
  const servicesSelector = React.useMemo(
    () => createSelectServicesForBusiness(),
    [],
  );
  const services = useSelector((state: RootState) =>
    servicesSelector(state, businessId),
  );
  const totalServices = useSelector(
    (state: RootState) => state.businesses.services.length,
  );
  const selectedCompanion = useSelector((state: any) => {
    const companionState = state.companion;
    if (!companionState?.selectedCompanionId) return null;
    return (
      companionState.companions?.find(
        (c: any) => c.id === companionState.selectedCompanionId,
      ) ?? null
    );
  });
  const [fallbackPhoto, setFallbackPhoto] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!business) {
      dispatch(fetchBusinesses());
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
    if (selectedCompanion) {
      const specialtyToSpecies: Record<string, string> = {
        Feline: 'feline',
        Canine: 'canine',
      };
      const speciesLabel: Record<string, string> = {
        feline: 'cats',
        canine: 'dogs',
      };
      const serviceSpecies = specialtyToSpecies[specialtyName];
      if (serviceSpecies) {
        const raw = (selectedCompanion.category as string)?.toLowerCase() ?? '';
        const companionSpecies =
          raw === 'cat' ? 'feline' : raw === 'dog' ? 'canine' : raw;
        if (companionSpecies !== serviceSpecies) {
          Alert.alert(
            'Species Mismatch',
            `This service is for ${speciesLabel[serviceSpecies] ?? serviceSpecies}.`,
            [{text: 'OK'}],
          );
          return;
        }
      }
    }

    const service = services.find(s => s.id === serviceId);
    navigation.navigate('BookingForm', {
      businessId,
      serviceId,
      serviceName: service?.name,
      serviceSpecialty: specialtyName ?? undefined,
      serviceSpecialtyId: service?.specialityId ?? undefined,
    });
  };
  const displayDistance = useMemo(() => {
    const distanceMi = paramDistanceMi ?? business?.distanceMi;
    if (!distanceMi) return undefined;

    if (distanceUnit === 'km') {
      const distanceKm = convertDistance(distanceMi, 'mi', 'km');
      return `${distanceKm.toFixed(1)}km`;
    }

    return `${distanceMi.toFixed(1)}mi`;
  }, [paramDistanceMi, business?.distanceMi, distanceUnit]);

  const handleBack = () => {
    if (returnTo?.tab) {
      const tabNav = navigation.getParent<NavigationProp<TabParamList>>();
      if (tabNav) {
        const params = returnTo.screen ? {screen: returnTo.screen} : undefined;
        tabNav.navigate(returnTo.tab as any, params as any);
      }
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Book an appointment"
          showBackButton
          onBack={handleBack}
          glass={false}
        />
      }
      cardGap={theme.spacing['4']}
      contentPadding={theme.spacing['4']}>
      {contentPaddingStyle => (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}>
          <VetBusinessCard
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
          {specialties.length ? (
            <SpecialtyAccordion
              title="Specialties"
              icon={Images.specialityIcon}
              specialties={specialties}
              onSelectService={handleSelectService}
            />
          ) : (
            <LiquidGlassCard
              glassEffect="clear"
              padding="4"
              shadow="sm"
              style={styles.emptyServicesCard}
              fallbackStyle={styles.emptyServicesCardFallback}>
              <Text style={styles.emptyServicesTitle}>
                Services coming soon
              </Text>
              <Text style={styles.emptyServicesSubtitle}>
                This business has not published individual services yet. Please
                contact them directly for availability.
              </Text>
            </LiquidGlassCard>
          )}
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
              height={theme.spacing['14']}
              borderRadius={theme.borderRadius.lg}
              tintColor={theme.colors.secondary}
              textStyle={styles.buttonText}
              glassEffect="clear"
              shadowIntensity="none"
              forceBorder
              borderColor={theme.colors.borderMuted}
            />
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['6'],
    },
    footer: {
      marginTop: theme.spacing['2'],
      marginBottom: theme.spacing['4'],
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
    emptyServicesCard: {
      backgroundColor: theme.colors.cardBackground,
      gap: theme.spacing['2'],
    },
    emptyServicesCardFallback: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.base,
      shadowColor: theme.colors.neutralShadow,
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
