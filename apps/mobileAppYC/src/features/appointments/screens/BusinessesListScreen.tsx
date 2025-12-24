import React, {useMemo, useEffect} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useTheme} from '@/hooks';
import {Header} from '@/shared/components/common/Header/Header';
import BusinessCard from '@/features/appointments/components/BusinessCard/BusinessCard';
import {useDispatch, useSelector} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {createSelectBusinessesByCategory} from '@/features/appointments/selectors';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BusinessesListScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = React.useState(0);
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <LiquidGlassHeader
        insetsTop={insets.top}
        currentHeight={topGlassHeight}
        onHeightChange={setTopGlassHeight}
        topSectionStyle={styles.topSection}
        cardStyle={styles.topGlassCard}
        fallbackStyle={styles.topGlassFallback}>
        <Header title="Book an appointment" showBackButton onBack={() => navigation.goBack()} glass={false} />
      </LiquidGlassHeader>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          topGlassHeight
            ? {paddingTop: Math.max(0, topGlassHeight - insets.top) + theme.spacing['3']}
            : null,
        ]}
        showsVerticalScrollIndicator={false}>
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
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  ...createLiquidGlassHeaderStyles(theme),
  container: {
    paddingHorizontal: theme.spacing['4'],
    paddingBottom: theme.spacing['8'],
    gap: theme.spacing['4'],
  },
});

export default BusinessesListScreen;
