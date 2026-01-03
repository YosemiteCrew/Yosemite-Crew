import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, ScrollView, View, Text, StyleSheet, TouchableOpacity, ViewStyle} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import type {AppDispatch, RootState} from '@/app/store';
import {fetchBusinesses, upsertBusiness} from '@/features/appointments/businessesSlice';
import {createSelectBusinessesByCategory} from '@/features/appointments/selectors';
import type {BusinessCategory, VetBusiness} from '@/features/appointments/types';
import {NavigationProp, useNavigation, useRoute} from '@react-navigation/native';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import type {RouteProp} from '@react-navigation/native';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {convertDistance} from '@/shared/utils/measurementSystem';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {usePlacesBusinessSearch, type ResolvedBusinessSelection} from '@/features/linkedBusinesses/hooks/usePlacesBusinessSearch';
import {selectCompanions, selectSelectedCompanionId} from '@/features/companion';
import {TabParamList} from '@/navigation/types';
import {BusinessSearchDropdown} from '@/features/linkedBusinesses/components/BusinessSearchDropdown';
import {mapSelectionToVetBusiness} from '@/features/linkedBusinesses/utils/mapSelectionToVetBusiness';

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
  cardStyle?: ViewStyle;
}

const BusinessCardRenderer: React.FC<BusinessCardProps> = ({
  business,
  navigation,
  resolveDescription,
  compact,
  fallbackPhoto,
  distanceUnit,
  cardStyle,
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
    style={cardStyle}
  />
);

interface CategoryBusinessesProps {
  businesses: VetBusiness[];
  navigation: Nav;
  resolveDescription: (b: VetBusiness) => string;
  fallbacks: Record<string, {photo?: string | null}>;
  distanceUnit: 'km' | 'mi';
  styles: any;
}

const CategoryBusinesses: React.FC<CategoryBusinessesProps> = ({
  businesses,
  navigation,
  resolveDescription,
  fallbacks,
  distanceUnit,
  styles,
}) => {
  if (businesses.length === 1) {
    const single = businesses[0];
    return (
      <View style={styles.singleCardWrapper}>
        <BusinessCardRenderer
          business={single}
          navigation={navigation}
          resolveDescription={resolveDescription}
          fallbackPhoto={fallbacks[single.id]?.photo ?? null}
          distanceUnit={distanceUnit}
        />
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}>
      {businesses.map(b => (
        <BusinessCardRenderer
          key={b.id}
          business={b}
          navigation={navigation}
          resolveDescription={resolveDescription}
          fallbackPhoto={fallbacks[b.id]?.photo ?? null}
          distanceUnit={distanceUnit}
          compact
          cardStyle={styles.horizontalCard}
        />
      ))}
    </ScrollView>
  );
};

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
                <View style={styles.viewMoreShadowWrapper}>
                  <LiquidGlassButton
                    onPress={() => navigation.navigate('BusinessesList', {category: cat as BusinessCategory})}
                    size="small"
                    compact
                    glassEffect="clear"
                    borderRadius="full"
                    style={styles.viewMoreButton}
                    textStyle={styles.viewMore}
                    shadowIntensity="none"
                    title="View more"
                  />
                </View>
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
                  cardStyle={styles.horizontalCard}
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
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const targetCompanionId = useMemo(() => {
    const fallback =
      companions[0]?.id ??
      (companions[0] as any)?._id ??
      (companions[0] as any)?.identifier?.[0]?.value;
    return selectedCompanionId ?? fallback ?? null;
  }, [companions, selectedCompanionId]);
  const selectedCompanion = useMemo(
    () => (targetCompanionId ? companions.find(c => c.id === targetCompanionId) ?? null : companions[0] ?? null),
    [companions, targetCompanionId],
  );
  const [headerHeight, setHeaderHeight] = useState(0);
  const [searchBarBottom, setSearchBarBottom] = useState<number | null>(null);
  const rootRef = React.useRef<View | null>(null);
  const searchBarRef = useRef<View | null>(null);
  const selectBusinessesByCategory = useMemo(() => createSelectBusinessesByCategory(), []);
  const businesses = useSelector((state: RootState) => selectBusinessesByCategory(state, category));
  const filteredBusinesses = useMemo(
    () => businesses.filter(b => (category ? b.category === category : true)),
    [businesses, category],
  );

  const ensureCompanionForSearch = React.useCallback(() => {
    if (targetCompanionId && selectedCompanion) {
      return true;
    }
    Alert.alert('Add a companion', 'Add a companion to notify a business.');
    return false;
  }, [selectedCompanion, targetCompanionId]);

  const handleSearchError = React.useCallback((error: unknown) => {
    console.log('[BrowseBusinesses] Search error', error);
  }, []);

  const handlePmsSelection = React.useCallback(
    async (selection: ResolvedBusinessSelection) => {
      const businessPayload = mapSelectionToVetBusiness(selection);

      dispatch(upsertBusiness(businessPayload));

      navigation.navigate('BusinessDetails', {
        businessId: businessPayload.id,
        returnTo: {tab: 'Appointments', screen: 'BrowseBusinesses'},
      });
    },
    [dispatch, navigation],
  );

  const handleNonPmsSelection = React.useCallback(
    async (selection: ResolvedBusinessSelection) => {
      if (!ensureCompanionForSearch() || !targetCompanionId || !selectedCompanion) {
        return;
      }

      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.navigate('HomeStack', {
          screen: 'LinkedBusinesses',
          params: {
            screen: 'BusinessAdd',
            params: {
              companionId: targetCompanionId,
              companionName: selectedCompanion.name,
              companionBreed: selectedCompanion.breed?.breedName,
              companionImage: selectedCompanion.profileImage ?? undefined,
              category: 'hospital',
              businessId: selection.placeId,
              businessName: selection.name,
              businessAddress: selection.address,
              phone: selection.phone,
              email: selection.email,
              photo: selection.photo,
              isPMSRecord: false,
              rating: selection.rating,
              distance: selection.distance,
              placeId: selection.placeId,
              returnTo: {tab: 'Appointments', screen: 'BrowseBusinesses'},
            },
          },
        });
    },
    [ensureCompanionForSearch, navigation, selectedCompanion, targetCompanionId],
  );

  const placesSearch = usePlacesBusinessSearch({
    onSelectPms: handlePmsSelection,
    onSelectNonPms: handleNonPmsSelection,
    onError: handleSearchError,
  });
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    handleSearchChange,
    handleSelectBusiness,
    clearResults,
  } = placesSearch;

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
    setSearchQuery(initialQuery);
  }, [initialQuery, setSearchQuery]);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

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

  const showSearchResults =
    searchQuery.length >= 2 && searchResults.length > 0 && !searching;
  const dropdownBaseTop = searchBarBottom ?? 0;
  const dropdownTop = (dropdownBaseTop || theme.spacing['30']) + theme.spacing['2'];

  const updateSearchBarBottom = React.useCallback(() => {
    if (!rootRef.current || !searchBarRef.current) {
      return;
    }
    rootRef.current.measureInWindow((_rx, rootY) => {
      searchBarRef.current?.measureInWindow((_x, y, _w, h) => {
        setSearchBarBottom(y - rootY + h);
      });
    });
  }, []);

  const headerContent = (
    <View
      style={styles.headerContent}
      onLayout={({nativeEvent}) => {
        const height = nativeEvent.layout.height;
        if (height !== headerHeight) {
          setHeaderHeight(height);
        }
        updateSearchBarBottom();
      }}>
      <Header
        title="Book an appointment"
        showBackButton
        onBack={() => navigation.goBack()}
        glass={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}>
        {CATEGORIES.map(p => (
          <TouchableOpacity
            key={p.label}
            style={[
              styles.pill,
              (p.id ?? undefined) === category && styles.pillActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setCategory(p.id)}>
            <Text
              style={[
                styles.pillText,
                (p.id ?? undefined) === category && styles.pillTextActive,
              ]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View
        ref={node => {
          searchBarRef.current = node;
        }}
        onLayout={updateSearchBarBottom}>
        <SearchBar
          placeholder="Search for services"
          mode="input"
          value={searchQuery}
          onChangeText={text => {
            setQuery(text);
            handleSearchChange(text);
          }}
          onSubmitEditing={() => {
            performSearch(searchQuery);
            handleSearchChange(searchQuery);
          }}
          onIconPress={() => {
            performSearch(searchQuery);
            handleSearchChange(searchQuery);
          }}
          autoFocus={route.params?.autoFocusSearch}
          containerStyle={styles.searchBar}
        />
      </View>
    </View>
  );

  return (
    <View
      style={styles.screenContainer}
      ref={node => {
        rootRef.current = node;
      }}
      onLayout={updateSearchBarBottom}>
      <BusinessSearchDropdown
        visible={showSearchResults}
        top={dropdownTop}
        items={searchResults}
        onSelect={handleSelectBusiness}
        onDismiss={clearResults}
      />
      <LiquidGlassHeaderScreen
        header={headerContent}
        cardGap={theme.spacing['3']}
        contentPadding={theme.spacing['4']}>
        {contentPaddingStyle => (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.container, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}>
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
                      styles={styles}
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
        )}
      </LiquidGlassHeaderScreen>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: theme.spacing['6'],
    paddingBottom: theme.spacing['24'],
    gap: theme.spacing['4'],
  },
  pillsContent: {
    gap: theme.spacing['2'],
    paddingRight: theme.spacing['2'],
    paddingHorizontal: theme.spacing['6'],
  },
  headerContent: {
    gap: theme.spacing['4'],
    paddingHorizontal: theme.spacing['1'],
  },
  resultsWrapper: {
    gap: theme.spacing['4'],
    marginTop: theme.spacing['2'],
  },
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
  pillActive: {
    backgroundColor: theme.colors.primaryTint,
    borderColor: theme.colors.primary,
  },
  pillText: {
    ...theme.typography.pillSubtitleBold15,
    color: '#302F2E',
  },
  pillTextActive: {
    color: theme.colors.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    ...theme.typography.businessSectionTitle20,
    color: '#302F2E',
  },
  sectionCount: {
    ...theme.typography.body12,
    color: '#302F2E',
  },
  viewMore: {
    ...theme.typography.labelXxsBold,
    color: theme.colors.primary,
  },
  viewMoreButton: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing['1'],
    minHeight: theme.spacing['7'],
    minWidth: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    ...theme.shadows.sm,
    shadowColor: theme.colors.neutralShadow,
  },
  searchBar: {
    marginBottom: theme.spacing['2'],
    marginInline: theme.spacing['6'],
  },
  viewMoreShadowWrapper: {
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.sm,
  },
  sectionWrapper: {
    gap: 12,
  },
  singleCardWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  horizontalList: {
    gap: 12,
    paddingRight: 16,
    paddingVertical: 10,
  },
  horizontalCard: {
    width: 280,
  },
  emptyState: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    backgroundColor: theme.colors.cardBackground,
    gap: 6,
  },
  emptyStateTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
  },
  emptyStateSubtitle: {
    ...theme.typography.bodySmallTight,
    color: theme.colors.textSecondary,
  },
});

export default BrowseBusinessesScreen;
