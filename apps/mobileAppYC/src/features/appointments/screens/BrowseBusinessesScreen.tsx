import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {useTheme} from '@/hooks';
import type {AppDispatch, RootState} from '@/app/store';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {createSelectBusinessesByCategory} from '@/features/appointments/selectors';
import type {BusinessCategory, VetBusiness} from '@/features/appointments/types';
import {useNavigation, useRoute} from '@react-navigation/native';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import type {RouteProp} from '@react-navigation/native';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertDistance} from '@/shared/utils/measurementSystem';

const CATEGORIES: ({label: string, id?: BusinessCategory})[] = [
  {label: 'All'},
  {label: 'Hospital', id: 'hospital'},
  {label: 'Groomer', id: 'groomer'},
  {label: 'Breeder', id: 'breeder'},
  {label: 'Boarder', id: 'boarder'}
];

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const getDistanceText = (business: VetBusiness, distanceUnit: 'km' | 'mi'): string | undefined => {
  let distanceMi: number | undefined;

  if (business.distanceMi !== null && business.distanceMi !== undefined) {
    distanceMi = business.distanceMi;
  } else if (business.distanceMeters !== null && business.distanceMeters !== undefined) {
    distanceMi = business.distanceMeters / 1609.344;
  } else {
    return undefined;
  }

  if (distanceUnit === 'km') {
    const distanceKm = convertDistance(distanceMi, 'mi', 'km');
    return `${distanceKm.toFixed(1)}km`;
  }

  return `${distanceMi.toFixed(1)}mi`;
};

const getRatingText = (business: VetBusiness): string | undefined => {
  if (business.rating != null) {
    return `${business.rating}`;
  }
  return undefined;
};

interface BusinessCardProps {
  business: VetBusiness;
  navigation: Nav;
  resolveDescription: (b: VetBusiness) => string;
  compact?: boolean;
  fallbackPhoto?: string | null;
  distanceUnit: 'km' | 'mi';
}

const BusinessCardRenderer: React.FC<BusinessCardProps> = ({
  business,
  navigation,
  resolveDescription,
  compact,
  fallbackPhoto,
  distanceUnit,
}) => (
  <BusinessCard
    key={business.id}
    name={business.name}
    openText={business.openHours}
    description={resolveDescription(business)}
    distanceText={getDistanceText(business, distanceUnit)}
    ratingText={getRatingText(business)}
    photo={business.photo ?? undefined}
    fallbackPhoto={fallbackPhoto ?? undefined}
    onBook={() => navigation.navigate('BusinessDetails', {businessId: business.id})}
    compact={compact}
  />
);

interface CategoryBusinessesProps {
  businesses: VetBusiness[];
  navigation: Nav;
  resolveDescription: (b: VetBusiness) => string;
  fallbacks: Record<string, {photo?: string | null}>;
  distanceUnit: 'km' | 'mi';
}

const CategoryBusinesses: React.FC<CategoryBusinessesProps> = ({businesses, navigation, resolveDescription, fallbacks, distanceUnit}) => (
  <>
    {businesses.map(b => (
      <BusinessCardRenderer
        key={b.id}
        business={b}
        navigation={navigation}
        resolveDescription={resolveDescription}
        fallbackPhoto={fallbacks[b.id]?.photo ?? null}
        distanceUnit={distanceUnit}
      />
    ))}
  </>
);

interface AllCategoriesViewProps {
  allCategories: readonly string[];
  businesses: VetBusiness[];
  resolveDescription: (b: VetBusiness) => string;
  navigation: Nav;
  styles: any;
  fallbacks: Record<string, {photo?: string | null}>;
  distanceUnit: 'km' | 'mi';
}

const AllCategoriesView: React.FC<AllCategoriesViewProps> = ({allCategories, businesses, resolveDescription, navigation, styles, fallbacks, distanceUnit}) => (
  <>
    {allCategories.map(cat => {
      const items = businesses.filter(x => x.category === cat);
      if (items.length === 0) return null;
      return (
        <View key={cat} style={styles.sectionWrapper}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>{CATEGORIES.find(c => c.id === cat)?.label}</Text>
            <View style={styles.sectionHeaderRight}>
              <Text style={styles.sectionCount}>{items.length} Near You</Text>
              {items.length > 1 && (
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('BusinessesList', {category: cat as BusinessCategory})}>
                  <Text style={styles.viewMore}>View more</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {items.length === 1 ? (
            <View style={styles.singleCardWrapper}>
              <BusinessCardRenderer
                business={items[0]}
                navigation={navigation}
                resolveDescription={resolveDescription}
                fallbackPhoto={fallbacks[items[0].id]?.photo ?? null}
                distanceUnit={distanceUnit}
              />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {items.map(b => (
                <BusinessCardRenderer
                  key={b.id}
                  business={b}
                  navigation={navigation}
                  resolveDescription={resolveDescription}
                  fallbackPhoto={fallbacks[b.id]?.photo ?? null}
                  distanceUnit={distanceUnit}
                  compact
                />
              ))}
            </ScrollView>
          )}
        </View>
      );
    })}
  </>
);

export const BrowseBusinessesScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppointmentStackParamList, 'BrowseBusinesses'>>();
  const {distanceUnit} = usePreferences();
  const [fallbacks, setFallbacks] = useState<Record<string, {photo?: string | null; phone?: string; website?: string}>>({});
  const requestedDetailsRef = React.useRef<Set<string>>(new Set());
  const lastSearchRef = React.useRef<number>(0);
  const lastTermRef = React.useRef<string>('');
  const MIN_SEARCH_INTERVAL_MS = 1000;

  const [category, setCategory] = useState<BusinessCategory | undefined>(undefined);
  const initialQuery = route.params?.serviceName ?? '';
  const [query, setQuery] = useState(initialQuery);
  const selectBusinessesByCategory = useMemo(() => createSelectBusinessesByCategory(), []);
  const businesses = useSelector((state: RootState) => selectBusinessesByCategory(state, category));
  const filteredBusinesses = useMemo(
    () => businesses.filter(b => (category ? b.category === category : true)),
    [businesses, category],
  );

  const performSearch = React.useCallback(
    (term?: string) => {
      const trimmed = (term ?? query).trim();
      const now = Date.now();
      if (trimmed === lastTermRef.current && now - lastSearchRef.current < MIN_SEARCH_INTERVAL_MS) {
        return;
      }
      lastTermRef.current = trimmed;
      lastSearchRef.current = now;
      dispatch(fetchBusinesses(trimmed ? {serviceName: trimmed} : undefined));
    },
    [dispatch, query],
  );

  useEffect(() => {
    performSearch(initialQuery);
  }, [performSearch, initialQuery]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const requestBusinessDetails = React.useCallback(
    async (biz: VetBusiness) => {
      const googlePlacesId = biz.googlePlacesId;
      if (!googlePlacesId || requestedDetailsRef.current.has(googlePlacesId)) {
        return;
      }
      requestedDetailsRef.current.add(googlePlacesId);
      try {
        const result = await dispatch(fetchBusinessDetails(googlePlacesId)).unwrap();
        setFallbacks(prev => ({
          ...prev,
          [biz.id]: {
            photo: result.photoUrl ?? prev[biz.id]?.photo ?? null,
            phone: result.phoneNumber ?? prev[biz.id]?.phone,
            website: result.website ?? prev[biz.id]?.website,
          },
        }));
        return;
      } catch {
        // Ignore and try photo-only fallback below
      }
      try {
        const img = await dispatch(fetchGooglePlacesImage(googlePlacesId)).unwrap();
        if (img.photoUrl) {
          setFallbacks(prev => ({
            ...prev,
            [biz.id]: {...prev[biz.id], photo: img.photoUrl},
          }));
        }
      } catch {
        // Swallow errors; UI will use defaults
      }
    },
    [dispatch],
  );

  useEffect(() => {
    businesses.forEach(biz => {
      const needsPhoto = (!biz.photo || isDummyPhoto(biz.photo)) && biz.googlePlacesId;
      const needsContact = (!biz.phone || !biz.website) && biz.googlePlacesId;
      if ((needsPhoto || needsContact) && biz.googlePlacesId) {
        requestBusinessDetails(biz);
      }
    });
  }, [businesses, dispatch, requestBusinessDetails]);

  const allCategories = ['hospital','groomer','breeder','pet_center','boarder'] as const;

  const resolveDescription = React.useCallback((biz: VetBusiness) => {
    if (biz.address && biz.address.trim().length > 0) {
      return biz.address.trim();
    }
    if (biz.description && biz.description.trim().length > 0) {
      return biz.description.trim();
    }
    if (biz.specialties && biz.specialties.length > 0) {
      return biz.specialties.slice(0, 3).join(', ');
    }
    return `${biz.name}`;
  }, []);


  return (
    <SafeArea>
      <Header title="Book an appointment" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          {CATEGORIES.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[styles.pill, (p.id ?? undefined) === category && styles.pillActive]}
              activeOpacity={0.8}
              onPress={() => setCategory(p.id)}
            >
              <Text style={[styles.pillText, (p.id ?? undefined) === category && styles.pillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <SearchBar
          placeholder="Search for services"
          mode="input"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => performSearch()}
          onIconPress={() => performSearch()}
          autoFocus={route.params?.autoFocusSearch}
        />

        <View style={styles.resultsWrapper}>
          {(() => {
            if (filteredBusinesses.length === 0) {
              return (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No businesses found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Try adjusting your filters or search to find nearby providers.
                  </Text>
                </View>
              );
            }

            if (category) {
              return (
                <CategoryBusinesses
                  businesses={filteredBusinesses}
                  navigation={navigation}
                  resolveDescription={resolveDescription}
                  fallbacks={fallbacks}
                  distanceUnit={distanceUnit}
                />
              );
            }

            return (
              <AllCategoriesView
                allCategories={allCategories}
                businesses={filteredBusinesses}
                resolveDescription={resolveDescription}
                navigation={navigation}
                styles={styles}
                fallbacks={fallbacks}
                distanceUnit={distanceUnit}
              />
            );
          })()}
        </View>
      </ScrollView>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {padding: 16, paddingBottom: 32, gap: 16},
  pillsContent: {gap: 8, paddingRight: 8},
  resultsWrapper: {gap: 16, marginTop: 8},
  pill: {
    minWidth: 80,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#302F2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
  pillText: {...theme.typography.pillSubtitleBold15, color: '#302F2E'},
  pillTextActive: {color: theme.colors.primary},
  sectionHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  sectionHeaderRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  sectionHeader: {...theme.typography.businessSectionTitle20, color: '#302F2E'},
  sectionCount: {...theme.typography.body12, color: '#302F2E'},
  viewMore: { ...theme.typography.titleSmall, color: theme.colors.primary},
  sectionWrapper: {gap: 12},
  singleCardWrapper: {alignItems: 'center', width: '100%'},
  horizontalList: {gap: 12, paddingRight: 16, paddingVertical: 10},
  emptyState: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    backgroundColor: theme.colors.cardBackground,
    gap: 6,
  },
  emptyStateTitle: {...theme.typography.titleMedium, color: theme.colors.secondary},
  emptyStateSubtitle: {...theme.typography.bodySmallTight, color: theme.colors.textSecondary},
});

export default BrowseBusinessesScreen;
