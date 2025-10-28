import React, {useMemo, useEffect} from 'react';
import {ScrollView, View, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Header} from '@/components/common/Header/Header';
import BusinessCard from '@/components/appointments/BusinessCard/BusinessCard';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {SafeArea} from '@/components/common';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BusinessesListScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const route = useRoute<any>();
  const navigation = useNavigation<Nav>();
  const {category} = route.params as {category: 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder'};
  const businesses = useSelector((s: RootState) => s.businesses.businesses.filter(b => b.category === category));

  useEffect(() => {
    if (
      businesses.length === 0 ||
      businesses.some(b => !b.description || b.description.trim().length === 0 || !b.photo)
    ) {
      console.warn('[BusinessesList] business data missing description or photo');
    }
  }, [businesses]);

  const resolveDescription = (biz: (typeof businesses)[number]) => {
    if (biz.description && biz.description.trim().length > 0) {
      return biz.description.trim();
    }
    if (biz.specialties && biz.specialties.length > 0) {
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
            distanceText={`${b.distanceMi}mi`}
            ratingText={`${b.rating}`}
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
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[8],
    gap: theme.spacing[4],
  },
});

export default BusinessesListScreen;
