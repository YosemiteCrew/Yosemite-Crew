import React, {useMemo, useEffect} from 'react';
import {ScrollView, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import {useDispatch, useSelector} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {SafeArea} from '@/shared/components/common';
import {createSelectBusinessesByCategory} from '@/features/appointments/selectors';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BusinessesListScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const {category} = route.params as {category: 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder'};
  const selectBusinessesByCategory = useMemo(() => createSelectBusinessesByCategory(), []);
  const businesses = useSelector((state: RootState) => selectBusinessesByCategory(state, category));

  useEffect(() => {
    if (businesses.length === 0) {
      dispatch(fetchBusinesses({serviceName: undefined}));
    }
  }, [businesses.length, dispatch]);

  const getDistanceText = (business: (typeof businesses)[number]): string | undefined => {
    if (business.distanceMi !== null && business.distanceMi !== undefined) {
      return `${business.distanceMi.toFixed(1)}mi`;
    }
    if (business.distanceMeters !== null && business.distanceMeters !== undefined) {
      return `${(business.distanceMeters / 1609.344).toFixed(1)}mi`;
    }
    return undefined;
  };

  const resolveDescription = (biz: (typeof businesses)[number]) => {
    if (biz.description?.trim()) {
      return biz.description.trim();
    }
    if (biz.specialties?.length) {
      return biz.specialties.slice(0, 3).join(', ');
    }
    return `${biz.name} located at ${biz.address}`;
  };


  return (
    <SafeArea>
    <View style={styles.root}>
      <Header title="Book an appointment" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {businesses.map(b => (
          <BusinessCard
            key={b.id}
            name={b.name}
            openText={b.openHours}
            description={resolveDescription(b)}
            distanceText={getDistanceText(b)}
            ratingText={b.rating ? `${b.rating}` : undefined}
            photo={b.photo}
            onBook={() => navigation.navigate('BusinessDetails', {businessId: b.id})}
          />
        ))}
      </ScrollView>
    </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: theme.spacing['4'],
    paddingTop: theme.spacing['4'],
    paddingBottom: theme.spacing['8'],
    gap: theme.spacing['4'],
  },
});

export default BusinessesListScreen;
