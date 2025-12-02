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
import {useNavigation} from '@react-navigation/native';
import CalendarMonthStrip from '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';

const CATEGORIES: ({label: string, id?: BusinessCategory})[] = [
  {label: 'All'},
  {label: 'Hospital', id: 'hospital'},
  {label: 'Groomer', id: 'groomer'},
  {label: 'Breeder', id: 'breeder'},
  {label: 'Pet Center', id: 'pet_center'},
  {label: 'Boarder', id: 'boarder'},
  {label: 'Clinic', id: 'clinic'},
];

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const getDistanceText = (business: VetBusiness): string | undefined => {
  if (business.distanceMi != null) {
    return `${business.distanceMi.toFixed(1)}mi`;
  }
  if (business.distanceMeters != null) {
    return `${(business.distanceMeters / 1609.344).toFixed(1)}mi`;
  }
  return undefined;
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
}

const BusinessCardRenderer: React.FC<BusinessCardProps> = ({
  business,
  navigation,
  resolveDescription,
  compact,
  fallbackPhoto,
}) => (
  <BusinessCard
    key={business.id}
    name={business.name}
    openText={business.openHours}
    description={resolveDescription(business)}
    distanceText={getDistanceText(business)}
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
}

const CategoryBusinesses: React.FC<CategoryBusinessesProps> = ({businesses, navigation, resolveDescription, fallbacks}) => (
  <>
    {businesses.map(b => (
      <BusinessCardRenderer
        key={b.id}
        business={b}
        navigation={navigation}
        resolveDescription={resolveDescription}
        fallbackPhoto={fallbacks[b.id]?.photo ?? null}
      />
    ))}
  </>
);

interface AllCategoriesViewProps {
  allCategories: readonly string[];
  businesses: VetBusiness[];
  query: string;
  resolveDescription: (b: VetBusiness) => string;
  navigation: Nav;
  styles: any;
  fallbacks: Record<string, {photo?: string | null}>;
}

const AllCategoriesView: React.FC<AllCategoriesViewProps> = ({allCategories, businesses, query, resolveDescription, navigation, styles, fallbacks}) => (
  <>
    {allCategories.map(cat => {
      const items = businesses.filter(x => x.category === cat && x.name.toLowerCase().includes(query.toLowerCase()));
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
  const [fallbacks, setFallbacks] = useState<Record<string, {photo?: string | null; phone?: string; website?: string}>>({});
  const requestedDetailsRef = React.useRef<Set<string>>(new Set());

  const [category, setCategory] = useState<BusinessCategory | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [query, setQuery] = useState('');
  const selectBusinessesByCategory = useMemo(() => createSelectBusinessesByCategory(), []);
  const businesses = useSelector((state: RootState) => selectBusinessesByCategory(state, category));
  const availability = useSelector((s: RootState) => s.businesses.availability);

  useEffect(() => {
    dispatch(fetchBusinesses(undefined));
  }, [dispatch]);

  useEffect(() => {
    businesses.forEach(biz => {
      const isDummyPhoto =
        typeof biz.photo === 'string' &&
        (biz.photo.includes('example.com') || biz.photo.includes('placeholder'));
      const needsPhoto = (!biz.photo || isDummyPhoto) && biz.googlePlacesId;
      const needsContact = (!biz.phone || !biz.website) && biz.googlePlacesId;
      if ((needsPhoto || needsContact) && biz.googlePlacesId && !requestedDetailsRef.current.has(biz.googlePlacesId)) {
        requestedDetailsRef.current.add(biz.googlePlacesId);
        dispatch(fetchBusinessDetails(biz.googlePlacesId))
          .unwrap()
          .then(result => {
            setFallbacks(prev => ({
              ...prev,
              [biz.id]: {
                photo: result.photoUrl ?? prev[biz.id]?.photo ?? null,
                phone: result.phoneNumber ?? prev[biz.id]?.phone,
                website: result.website ?? prev[biz.id]?.website,
              },
            }));
          })
          .catch(() => {
            dispatch(fetchGooglePlacesImage(biz.googlePlacesId as string))
              .unwrap()
              .then(img => {
                if (img.photoUrl) {
                  setFallbacks(prev => ({
                    ...prev,
                    [biz.id]: {...prev[biz.id], photo: img.photoUrl},
                  }));
                }
              })
              .catch(() => {});
          });
      }
    });
  }, [businesses, dispatch]);

  const allCategories = ['hospital','groomer','breeder','pet_center','boarder','clinic'] as const;

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

        <CalendarMonthStrip
          selectedDate={selectedDate}
          onChange={setSelectedDate}
          datesWithMarkers={useMemo(() => {
            const set = new Set<string>();
            const allowedBiz = new Set(businesses.map(b => b.id));
            for (const av of availability) {
              if (!allowedBiz.has(av.businessId)) continue;
              for (const key of Object.keys(av.slotsByDate)) set.add(key);
            }
            return set;
          }, [availability, businesses])}
        />

        <SearchBar placeholder="Search for services" mode="input" value={query} onChangeText={setQuery} />

        <View style={styles.resultsWrapper}>
          {category ? (
            <CategoryBusinesses
              businesses={businesses.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))}
              navigation={navigation}
              resolveDescription={resolveDescription}
              fallbacks={fallbacks}
            />
          ) : (
            <AllCategoriesView
              allCategories={allCategories}
              businesses={businesses}
              query={query}
              resolveDescription={resolveDescription}
              navigation={navigation}
              styles={styles}
              fallbacks={fallbacks}
            />
          )}
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
});

export default BrowseBusinessesScreen;
