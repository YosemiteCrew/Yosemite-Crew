import React, {useCallback, useMemo, useRef} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
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
import ClinicMapPin from './ClinicMapPin';
import ClusterMapPin from './ClusterMapPin';
import ClinicBottomSheet, {
  type ClinicBottomSheetRef,
} from './ClinicBottomSheet';

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
  onSelectClinic: (id: string) => void;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  onCategoryChange: (c: BusinessCategory | undefined) => void;
  onOpenNowChange: (v: boolean) => void;
  onBack: () => void;
  searchResultsOverlay?: React.ReactNode;
}

const DEFAULT_CENTER = {latitude: 37.7749, longitude: -122.4194};

const buildInitialRegion = (userLocation: UserLocation | null): Region => {
  const center = userLocation ?? DEFAULT_CENTER;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
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

  const initialRegion = useMemo(
    () => buildInitialRegion(userLocation),
    [userLocation],
  );

  const handlePinPress = useCallback(
    (clinicId: string) => {
      onSelectClinic(clinicId);
      bottomSheetRef.current?.scrollToClinic(clinicId);

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

  const mapItems = useMemo(
    () => clusterClinics(clinics, mapRegion?.latitudeDelta ?? 0),
    [clinics, mapRegion],
  );

  const filterHeader = useMemo(
    () => (
      <View style={styles.filterHeaderColumn}>
        <TouchableOpacity
          style={[styles.openNowChip, openNow && styles.openNowChipActive]}
          activeOpacity={0.8}
          onPress={() => onOpenNowChange(!openNow)}>
          <Text
            style={[styles.openNowText, openNow && styles.openNowTextActive]}>
            {t('mapDiscovery.openNow')}
          </Text>
        </TouchableOpacity>
        <FilterPills<BusinessCategory | undefined>
          options={categories}
          selected={category}
          onSelect={onCategoryChange}
        />
      </View>
    ),
    [
      openNow,
      onOpenNowChange,
      category,
      onCategoryChange,
      styles,
      categories,
      t,
    ],
  );

  const topBarStyle = useMemo(
    () => [styles.topBar, {paddingTop: insets.top + theme.spacing['2']}],
    [styles.topBar, insets.top, theme.spacing],
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
        onRegionChangeComplete={onRegionChange}>
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
      <View style={topBarStyle} pointerEvents="box-none">
        <View style={styles.headerCard} pointerEvents="auto">
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
        </View>
      </View>
      {searchResultsOverlay}
      <ClinicBottomSheet
        ref={bottomSheetRef}
        clinics={clinics}
        selectedId={selectedClinicId}
        navigation={navigation}
        fallbacks={fallbacks}
        distanceUnit={distanceUnit}
        filterHeader={filterHeader}
      />
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
      paddingHorizontal: theme.spacing['4'],
      zIndex: 10,
    },
    headerCard: {
      backgroundColor: theme.colors.cardOverlay,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing['3'],
      gap: theme.spacing['2'],
      ...theme.shadows.md,
      shadowColor: theme.colors.neutralShadow,
    },
    searchBar: {
      marginBottom: 0,
    },
    filterHeaderColumn: {
      gap: theme.spacing['2'],
      paddingBottom: theme.spacing['1'],
    },
    openNowChip: {
      alignSelf: 'flex-start',
      marginLeft: theme.spacing['4'],
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['1.25'],
      height: 40,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.text,
      backgroundColor: theme.colors.white,
      justifyContent: 'center',
      alignItems: 'center',
    },
    openNowChipActive: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    openNowText: {
      ...theme.typography.pillSubtitleBold15,
      color: theme.colors.text,
    },
    openNowTextActive: {
      color: theme.colors.primary,
    },
  });

export default MapDiscoveryView;
