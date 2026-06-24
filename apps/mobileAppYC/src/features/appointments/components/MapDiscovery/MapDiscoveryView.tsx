import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {
  createAnimatedComponent,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import {useTranslation} from 'react-i18next';
import MapView, {Marker, PROVIDER_GOOGLE, type Region} from 'react-native-maps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {VetBusiness, BusinessCategory} from '../../types';
import type {UserLocation} from '../../hooks/useLocationPermission';
import {YC_MAP_STYLE} from '../../utils/mapStyle';
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
  searchResultsOverlay,
  onSearchBarLayout,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

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
    if (userLocation || clinics.length === 0) return;
    const coords = clinics
      .filter(c => c.lat != null && c.lng != null)
      .map(c => ({latitude: c.lat as number, longitude: c.lng as number}));
    if (coords.length === 0) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: {top: 80, right: 40, bottom: 220, left: 40},
      animated: true,
    });
  }, [clinics, userLocation]);

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

  const mapItems = useMemo(
    () => clusterClinics(clinics, mapRegion?.latitudeDelta ?? 0),
    [clinics, mapRegion],
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
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        customMapStyle={YC_MAP_STYLE}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        onRegionChangeComplete={onRegionChange}
        onPress={selectedClinic ? handleDeselectClinic : undefined}>
        {mapItems.map(item => {
          if (item.type === 'cluster') {
            return (
              <Marker
                key={item.id}
                coordinate={{latitude: item.lat, longitude: item.lng}}
                tracksViewChanges={false}>
                <ClusterMapPin count={item.count} />
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
                isSelected={clinic.id === selectedClinicId}
              />
            </Marker>
          );
        })}
      </MapView>
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
            colorScheme="light"
            style={headerCardStyle}
            fallbackStyle={styles.headerCardFallback}>
            <Header
              title={t('mapDiscovery.title')}
              showBackButton
              onBack={onBack}
              glass={false}
            />
            <SearchBar
              placeholder={t('mapDiscovery.searchPlaceholder')}
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
        <View
          style={[
            styles.selectedClinicOverlay,
            {paddingBottom: insets.bottom + 16},
          ]}
          pointerEvents="box-none">
          <Pressable
            style={styles.selectedClinicDismiss}
            onPress={handleDeselectClinic}
            hitSlop={8}>
            <Text style={styles.selectedClinicDismissText}>✕</Text>
          </Pressable>
          <BusinessCard
            name={selectedClinic.name}
            openText={selectedClinic.openHours}
            description={selectedClinic.address}
            distanceText={resolveDistanceText(selectedClinic)}
            ratingText={
              selectedClinic.rating == null
                ? undefined
                : `${selectedClinic.rating}`
            }
            photo={selectedClinic.photo}
            fallbackPhoto={fallbacks[selectedClinic.id]?.photo ?? null}
            glassEffect="none"
            onBook={() =>
              navigation.navigate('BusinessDetails', {
                businessId: selectedClinic.id,
                distanceMi: selectedClinic.distanceMi,
              })
            }
          />
        </View>
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
      boxShadow: `0px 12px 18px ${theme.colors.neutralShadow ?? '#000000'}`,
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
