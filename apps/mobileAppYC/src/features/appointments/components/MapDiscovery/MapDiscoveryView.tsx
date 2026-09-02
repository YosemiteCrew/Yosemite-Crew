import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  createAnimatedComponent,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import {useTranslation} from 'react-i18next';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
  type UserLocationChangeEvent,
} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {VetBusiness, BusinessCategory} from '../../types';
import type {UserLocation} from '../../hooks/useLocationPermission';
import {mapStyleFor} from '../../utils/mapStyle';
import {clusterClinics} from '../../utils/clusterClinics';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {FilterPills} from '@/shared/components/common/FilterPills';
import {LiquidGlassCard} from '@/shared/components/common/LiquidGlassCard/LiquidGlassCard';
import ClinicMapPin from './ClinicMapPin';
import ClusterMapPin from './ClusterMapPin';
import ClinicBottomSheet, {
  type ClinicBottomSheetRef,
} from './ClinicBottomSheet';
import BusinessCard from '../BusinessCard/BusinessCard';

import {colors} from '@/theme';
const AnimatedView = createAnimatedComponent(
  View,
) as unknown as React.ComponentType<any>;

const INITIAL_LAT_DELTA = 0.0922;
const INITIAL_LNG_DELTA = 0.0421;

export interface MapDiscoveryViewProps {
  clinics: VetBusiness[];
  selectedClinicId: string | null;
  userLocation: UserLocation | null;
  hasLocationPermission: boolean;
  searchQuery: string;
  category: BusinessCategory | undefined;
  openNow: boolean;
  mapRegion: Region | null;
  fallbacks: Record<string, {photo?: string | null}>;
  distanceUnit: 'km' | 'mi';
  navigation: NativeStackNavigationProp<AppointmentStackParamList>;
  onRegionChange: (region: Region) => void;
  onSelectClinic: (id: string | null) => void;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  onCategoryChange: (c: BusinessCategory | undefined) => void;
  onOpenNowChange: (v: boolean) => void;
  onBack: () => void;
  onMapUserLocationChange?: (location: UserLocation | null) => void;
  searchResultsOverlay?: React.ReactNode;
  onSearchBarLayout?: (height: number) => void;
}

const buildInitialRegion = (
  userLocation: UserLocation | null,
): Region | undefined => {
  if (!userLocation) return undefined;
  return {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: INITIAL_LAT_DELTA,
    longitudeDelta: INITIAL_LNG_DELTA,
  };
};

/**
 * Whether a clinic carries a coordinate the native map can actually plot.
 *
 * Latitude and longitude come from organisation address data, so anyone who can
 * influence a business address controls them. A non-finite or out-of-range pair
 * (latitude 999) makes the native map component throw when a victim opens
 * discovery, taking the feature down - so such an entry is simply not mapped.
 */
const hasPlottableCoordinates = (clinic: {
  lat?: number | null;
  lng?: number | null;
}): clinic is {lat: number; lng: number} =>
  typeof clinic.lat === 'number' &&
  typeof clinic.lng === 'number' &&
  Number.isFinite(clinic.lat) &&
  Number.isFinite(clinic.lng) &&
  clinic.lat >= -90 &&
  clinic.lat <= 90 &&
  clinic.lng >= -180 &&
  clinic.lng <= 180;

const MapDiscoveryView: React.FC<MapDiscoveryViewProps> = ({
  clinics,
  selectedClinicId,
  userLocation,
  hasLocationPermission,
  searchQuery,
  category,
  openNow,
  mapRegion,
  fallbacks,
  distanceUnit,
  navigation,
  onRegionChange,
  onSelectClinic,
  onSearchChange,
  onSearchSubmit,
  onCategoryChange,
  onOpenNowChange,
  onBack,
  onMapUserLocationChange,
  searchResultsOverlay,
  onSearchBarLayout,
}) => {
  const {t} = useTranslation();
  const {theme, isDark} = useTheme();
  const mapStyle = useMemo(() => mapStyleFor(isDark), [isDark]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  // Only the MAP is restricted to plottable clinics. A clinic with a bad or
  // missing coordinate still belongs in the list and the sheet - it just cannot
  // be given to the native map, which throws on an out-of-range value.
  const mappableClinics = useMemo(
    () => clinics.filter(clinic => hasPlottableCoordinates(clinic)),
    [clinics],
  );

  const categories = useMemo(
    () => [
      {label: t('mapDiscovery.filterAll'), id: undefined},
      {label: t('mapDiscovery.filterHospital'), id: 'hospital' as const},
      {label: t('mapDiscovery.filterGroomer'), id: 'groomer' as const},
      {label: t('mapDiscovery.filterBreeder'), id: 'breeder' as const},
      {label: t('mapDiscovery.filterBoarder'), id: 'boarder' as const},
    ],
    [t],
  );
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<ClinicBottomSheetRef>(null);
  const animatedSheetIndex = useSharedValue(0);

  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedSheetIndex.value,
      [0, 0.15],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    pointerEvents: animatedSheetIndex.value > 0.1 ? 'none' : 'box-none',
  }));

  const [initialRegion] = useState(() => buildInitialRegion(userLocation));

  useEffect(() => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: INITIAL_LAT_DELTA,
        longitudeDelta: INITIAL_LNG_DELTA,
      },
      500,
    );
  }, [userLocation]);

  useEffect(() => {
    if (userLocation || mappableClinics.length === 0) return;
    const coords = mappableClinics.map(c => ({
      latitude: c.lat as number,
      longitude: c.lng as number,
    }));
    if (coords.length === 0) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {top: 80, right: 40, bottom: 220, left: 40},
      animated: true,
    });
  }, [mappableClinics, userLocation]);

  const selectedClinic = useMemo(
    () => clinics.find(c => c.id === selectedClinicId) ?? null,
    [clinics, selectedClinicId],
  );

  const resolveDistanceText = useCallback(
    (clinic: (typeof clinics)[0]): string | undefined => {
      const mi =
        clinic.distanceMi ??
        (clinic.distanceMeters == null
          ? null
          : clinic.distanceMeters / 1609.344);
      if (mi == null) return undefined;
      if (distanceUnit === 'km') return `${(mi * 1.60934).toFixed(1)} km`;
      return `${mi.toFixed(1)} mi`;
    },
    [distanceUnit],
  );

  const handlePinPress = useCallback(
    (clinicId: string) => {
      onSelectClinic(clinicId);
      bottomSheetRef.current?.hide();

      const clinic = clinics.find(c => c.id === clinicId);
      if (clinic?.lat == null || clinic?.lng == null) return;
      mapRef.current?.animateToRegion(
        {
          latitude: clinic.lat - INITIAL_LAT_DELTA * 0.15,
          longitude: clinic.lng,
          latitudeDelta: INITIAL_LAT_DELTA * 0.5,
          longitudeDelta: INITIAL_LNG_DELTA * 0.5,
        },
        350,
      );
    },
    [clinics, onSelectClinic],
  );

  const handleDeselectClinic = useCallback(() => {
    onSelectClinic(null);
    bottomSheetRef.current?.show();
  }, [onSelectClinic]);

  const handleUserLocationChange = useCallback(
    (event: UserLocationChangeEvent) => {
      const coordinate = event.nativeEvent.coordinate;
      if (!coordinate) {
        onMapUserLocationChange?.(null);
        return;
      }
      onMapUserLocationChange?.({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
    },
    [onMapUserLocationChange],
  );

  const mapItems = useMemo(
    () => clusterClinics(mappableClinics, mapRegion?.latitudeDelta ?? 0),
    [mappableClinics, mapRegion],
  );

  const filterHeader = useMemo(
    () => (
      <FilterPills<BusinessCategory | undefined>
        options={categories}
        selected={category}
        onSelect={onCategoryChange}
      />
    ),
    [category, onCategoryChange, categories],
  );

  const headerCardStyle = useMemo(
    () => [styles.headerCard, {paddingTop: insets.top}],
    [styles.headerCard, insets.top],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={mapStyle}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        onUserLocationChange={handleUserLocationChange}
        onRegionChangeComplete={onRegionChange}
        onPress={selectedClinic ? handleDeselectClinic : undefined}>
        {mapItems.map(item => {
          if (item.type === 'cluster') {
            return (
              <Marker
                key={item.id}
                coordinate={{latitude: item.lat, longitude: item.lng}}
                tracksViewChanges={false}>
                <ClusterMapPin count={item.count} palette={theme.colors} />
              </Marker>
            );
          }
          const {clinic} = item;
          if (clinic.lat == null || clinic.lng == null) return null;
          return (
            <Marker
              key={clinic.id}
              coordinate={{latitude: clinic.lat, longitude: clinic.lng}}
              tracksViewChanges={false}
              onPress={() => handlePinPress(clinic.id)}>
              <ClinicMapPin
                business={clinic}
                palette={theme.colors}
                isSelected={clinic.id === selectedClinicId}
              />
            </Marker>
          );
        })}
      </MapView>
      <MapTopBar
        styles={styles}
        headerCardStyle={headerCardStyle}
        title={t('mapDiscovery.title')}
        searchPlaceholder={t('mapDiscovery.searchPlaceholder')}
        searchQuery={searchQuery}
        onBack={onBack}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onSearchBarLayout={onSearchBarLayout}
      />
      {!selectedClinic && (
        <AnimatedView style={[styles.openNowMapToggle, toggleAnimatedStyle]}>
          <View style={styles.openNowToggleCard} pointerEvents="auto">
            <Text style={styles.openNowToggleLabel}>Open</Text>
            <Switch
              value={openNow}
              onValueChange={onOpenNowChange}
              trackColor={{
                false: theme.colors.borderMuted,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        </AnimatedView>
      )}
      {searchResultsOverlay}
      {selectedClinic && (
        <SelectedClinicOverlay
          styles={styles}
          bottomInset={insets.bottom}
          onDismiss={handleDeselectClinic}
          clinic={selectedClinic}
          distanceText={resolveDistanceText(selectedClinic)}
          fallbackPhoto={fallbacks[selectedClinic.id]?.photo ?? null}
          navigation={navigation}
        />
      )}
      {!selectedClinic && (
        <ClinicBottomSheet
          ref={bottomSheetRef}
          clinics={clinics}
          selectedId={selectedClinicId}
          navigation={navigation}
          fallbacks={fallbacks}
          distanceUnit={distanceUnit}
          filterHeader={filterHeader}
          animatedIndex={animatedSheetIndex}
        />
      )}
    </View>
  );
};

interface MapTopBarProps {
  styles: ReturnType<typeof createStyles>;
  headerCardStyle: StyleProp<ViewStyle>;
  title: string;
  searchPlaceholder: string;
  searchQuery: string;
  onBack: () => void;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  onSearchBarLayout?: (height: number) => void;
}

const MapTopBar: React.FC<MapTopBarProps> = ({
  styles,
  headerCardStyle,
  title,
  searchPlaceholder,
  searchQuery,
  onBack,
  onSearchChange,
  onSearchSubmit,
  onSearchBarLayout,
}) => (
  <View
    style={styles.topBar}
    pointerEvents="box-none"
    onLayout={
      onSearchBarLayout
        ? e => onSearchBarLayout(e.nativeEvent.layout.height)
        : undefined
    }>
    <View style={styles.headerShadowWrapper} pointerEvents="auto">
      <LiquidGlassCard
        glassEffect="clear"
        interactive={false}
        shadow="none"
        style={headerCardStyle}
        fallbackStyle={styles.headerCardFallback}>
        <Header title={title} showBackButton onBack={onBack} glass={false} />
        <SearchBar
          placeholder={searchPlaceholder}
          mode="input"
          value={searchQuery}
          onChangeText={onSearchChange}
          onSubmitEditing={onSearchSubmit}
          onIconPress={onSearchSubmit}
          containerStyle={styles.searchBar}
        />
      </LiquidGlassCard>
    </View>
  </View>
);

interface SelectedClinicOverlayProps {
  styles: ReturnType<typeof createStyles>;
  bottomInset: number;
  onDismiss: () => void;
  clinic: VetBusiness;
  distanceText?: string;
  fallbackPhoto?: string | null;
  navigation: NativeStackNavigationProp<AppointmentStackParamList>;
}

const SelectedClinicOverlay: React.FC<SelectedClinicOverlayProps> = ({
  styles,
  bottomInset,
  onDismiss,
  clinic,
  distanceText,
  fallbackPhoto,
  navigation,
}) => (
  <View
    style={[styles.selectedClinicOverlay, {paddingBottom: bottomInset + 16}]}
    pointerEvents="box-none">
    <Pressable
      style={styles.selectedClinicDismiss}
      onPress={onDismiss}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Dismiss clinic details">
      <Text style={styles.selectedClinicDismissText}>✕</Text>
    </Pressable>
    <BusinessCard
      name={clinic.name}
      openText={clinic.openHours}
      description={clinic.address}
      distanceText={distanceText}
      ratingText={clinic.rating == null ? undefined : `${clinic.rating}`}
      photo={clinic.photo}
      fallbackPhoto={fallbackPhoto}
      glassEffect="none"
      onBook={() =>
        navigation.navigate('BusinessDetails', {
          businessId: clinic.id,
          distanceMi: clinic.distanceMi,
        })
      }
    />
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 110,
      backgroundColor: 'transparent',
    },
    headerShadowWrapper: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      boxShadow: `0px 12px 18px ${theme.colors.neutralShadow ?? colors.black}`,
      backgroundColor: 'transparent',
    },
    headerCard: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing['3'],
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'visible' as const,
      gap: theme.spacing['2'],
    },
    headerCardFallback: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: theme.borderRadius['2xl'],
      borderBottomRightRadius: theme.borderRadius['2xl'],
      borderWidth: 0,
      borderColor: 'transparent',
    },
    searchBar: {
      marginBottom: theme.spacing['1'],
      marginHorizontal: theme.spacing['6'],
    },
    openNowMapToggle: {
      position: 'absolute',
      bottom: '23.5%',
      left: 0,
      right: 0,
      paddingHorizontal: theme.spacing['4'],
      zIndex: 5,
    },
    openNowToggleCard: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['2'],
      boxShadow: '0px 2px 4px rgba(0,0,0,0.15)',
    },
    openNowToggleLabel: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.text,
    },
    selectedClinicOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['2'],
    },
    selectedClinicDismiss: {
      position: 'absolute' as const,
      top: theme.spacing['4'],
      right: theme.spacing['6'],
      zIndex: 21,
      width: theme.spacing['8'],
      height: theme.spacing['8'],
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.background,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    selectedClinicDismissText: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      lineHeight: theme.spacing['6'],
    },
  });

export default MapDiscoveryView;
