import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {SearchBar} from '@/shared/components/common/SearchBar/SearchBar';
import {useTheme} from '@/hooks';
import type {AppDispatch, RootState} from '@/app/store';
import {fetchBusinesses, fetchAvailability} from '@/features/appointments/businessesSlice';
import {selectBusinessesByCategory} from '@/features/appointments/selectors';
import type {BusinessCategory, VetBusiness} from '@/features/appointments/types';
import {useNavigation} from '@react-navigation/native';
import CalendarMonthStrip from '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';

const CATEGORIES: ({label: string, id?: BusinessCategory})[] = [
  {label: 'All'},
  {label: 'Hospital', id: 'hospital'},
  {label: 'Groomer', id: 'groomer'},
  {label: 'Breeder', id: 'breeder'},
  {label: 'Pet Center', id: 'pet_center'},
  {label: 'Boarder', id: 'boarder'},
];

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BrowseBusinessesScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();

  const [category, setCategory] = useState<BusinessCategory | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [query, setQuery] = useState('');
  const businesses = useSelector(selectBusinessesByCategory(category));
  const availability = useSelector((s: RootState) => s.businesses.availability);

  useEffect(() => {
    const needsRefresh =
      businesses.length === 0 ||
      businesses.some(
        b =>
          !b.description ||
          b.description.trim().length === 0 ||
          !b.photo,
      );
    if (needsRefresh) {
      dispatch(fetchBusinesses());
      dispatch(fetchAvailability());
    }
  }, [dispatch, businesses]);

  const allCategories = ['hospital','groomer','breeder','pet_center','boarder'] as const;

  const resolveDescription = React.useCallback((biz: VetBusiness) => {
    if (biz.description && biz.description.trim().length > 0) {
      return biz.description.trim();
    }
    if (biz.specialties && biz.specialties.length > 0) {
      return biz.specialties.slice(0, 3).join(', ');
    }
    return `${biz.name} located at ${biz.address}`;
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
            businesses
              .filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
              .map(b => (
              <BusinessCard
                key={b.id}
                name={b.name}
                openText={b.openHours}
                description={resolveDescription(b)}
                distanceText={`${b.distanceMi}mi`}
                ratingText={`${b.rating}`}
                photo={b.photo}
                onBook={() => navigation.navigate('BusinessDetails', {businessId: b.id})}
              />
            ))
          ) : (
            allCategories.map(cat => {
              const items = businesses.filter(x => x.category === cat && x.name.toLowerCase().includes(query.toLowerCase()));
              if (!items.length) return null;
              return (
                <View key={cat} style={styles.sectionWrapper}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>{CATEGORIES.find(c => c.id === cat)?.label}</Text>
                    <View style={styles.sectionHeaderRight}>
                      <Text style={styles.sectionCount}>{items.length} Near You</Text>
                      {items.length > 1 && (
                        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('BusinessesList', {category: cat})}>
                          <Text style={styles.viewMore}>View more</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {items.length === 1 ? (
                    <View style={styles.singleCardWrapper}>
                      <BusinessCard
                        name={items[0].name}
                        openText={items[0].openHours}
                        description={resolveDescription(items[0])}
                        distanceText={`${items[0].distanceMi}mi`}
                        ratingText={`${items[0].rating}`}
                        photo={items[0].photo}
                        onBook={() => navigation.navigate('BusinessDetails', {businessId: items[0].id})}
                      />
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                      {items.map(b => (
                        <BusinessCard
                          key={b.id}
                          name={b.name}
                          openText={b.openHours}
                          description={resolveDescription(b)}
                          distanceText={`${b.distanceMi}mi`}
                          ratingText={`${b.rating}`}
                          photo={b.photo}
                          onBook={() => navigation.navigate('BusinessDetails', {businessId: b.id})}
                          compact
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
            })
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
