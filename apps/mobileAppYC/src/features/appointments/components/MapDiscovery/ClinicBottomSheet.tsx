import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import BottomSheet, {
  BottomSheetFlatList,
  type BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import type {SharedValue} from 'react-native-reanimated';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {VetBusiness} from '../../types';
import BusinessCard from '../BusinessCard/BusinessCard';
import {useTheme} from '@/hooks';
import {convertDistance} from '@/shared/utils/measurementSystem';

export interface ClinicBottomSheetRef {
  scrollToClinic: (id: string) => void;
  snapToExpanded: () => void;
  snapToCollapsed: () => void;
  hide: () => void;
  show: () => void;
}

export interface ClinicBottomSheetProps {
  clinics: VetBusiness[];
  selectedId: string | null;
  navigation: NativeStackNavigationProp<AppointmentStackParamList>;
  fallbacks: Record<string, {photo?: string | null}>;
  distanceUnit: 'km' | 'mi';
  filterHeader?: React.ReactNode;
  animatedIndex?: SharedValue<number>;
}

const SNAP_POINTS = ['22%', '78%'];
const ITEM_ESTIMATED_HEIGHT = 320;

const resolveDistanceText = (
  business: VetBusiness,
  distanceUnit: 'km' | 'mi',
): string | undefined => {
  let distanceMi: number | undefined;
  if (business.distanceMi != null) {
    distanceMi = business.distanceMi;
  } else if (business.distanceMeters == null) {
    return undefined;
  } else {
    distanceMi = business.distanceMeters / 1609.344;
  }
  if (distanceUnit === 'km') {
    return `${convertDistance(distanceMi, 'mi', 'km').toFixed(1)} km`;
  }
  return `${distanceMi.toFixed(1)} mi`;
};

const resolveRatingText = (business: VetBusiness): string | undefined =>
  business.rating == null ? undefined : `${business.rating}`;

const ClinicBottomSheet = forwardRef<
  ClinicBottomSheetRef,
  ClinicBottomSheetProps
>(
  (
    {
      clinics,
      selectedId,
      navigation,
      fallbacks,
      distanceUnit,
      filterHeader,
      animatedIndex,
    },
    ref,
  ) => {
    const {t} = useTranslation();
    const {theme} = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const flatListRef = useRef<BottomSheetFlatListMethods>(null);

    useImperativeHandle(ref, () => ({
      scrollToClinic: (id: string) => {
        const index = clinics.findIndex(c => c.id === id);
        bottomSheetRef.current?.snapToIndex(1);
        if (index < 0 || !flatListRef.current) return;
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.1,
          });
        }, 300);
      },
      snapToExpanded: () => bottomSheetRef.current?.snapToIndex(1),
      snapToCollapsed: () => bottomSheetRef.current?.snapToIndex(0),
      hide: () => bottomSheetRef.current?.close(),
      show: () => bottomSheetRef.current?.snapToIndex(0),
    }));

    const handleScrollToIndexFailed = useCallback((info: {index: number}) => {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.1,
        });
      }, 200);
    }, []);

    const renderItem = useCallback(
      (renderItemInfo: {item: VetBusiness}) => {
        const {item} = renderItemInfo;
        const isSelected = item.id === selectedId;
        return (
          <View
            style={[
              styles.cardWrapper,
              isSelected && styles.cardWrapperSelected,
            ]}>
            <BusinessCard
              name={item.name}
              openText={item.openHours}
              description={item.address}
              distanceText={resolveDistanceText(item, distanceUnit)}
              ratingText={resolveRatingText(item)}
              photo={item.photo}
              fallbackPhoto={fallbacks[item.id]?.photo ?? null}
              onBook={() =>
                navigation.navigate('BusinessDetails', {
                  businessId: item.id,
                  distanceMi: item.distanceMi,
                })
              }
            />
          </View>
        );
      },
      [selectedId, distanceUnit, fallbacks, navigation, styles],
    );

    const keyExtractor = useCallback((item: VetBusiness) => item.id, []);

    const nativeGesture = useMemo(() => Gesture.Native(), []);

    const emptyComponent = useMemo(
      () => (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {t('mapDiscovery.emptyClinicsTitle')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('mapDiscovery.emptyClinicsSubtitle')}
          </Text>
        </View>
      ),
      [styles, t],
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={SNAP_POINTS}
        index={0}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.background}
        animatedIndex={animatedIndex}>
        <BottomSheetFlatList<VetBusiness>
          ref={flatListRef}
          data={clinics}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            filterHeader ? (
              <GestureDetector gesture={nativeGesture}>
                <View testID="filter-header-gesture" style={styles.filterRow}>
                  {filterHeader}
                </View>
              </GestureDetector>
            ) : null
          }
          ListEmptyComponent={emptyComponent}
          getItemLayout={(
            _data: VetBusiness[] | null | undefined,
            index: number,
          ) => ({
            length: ITEM_ESTIMATED_HEIGHT,
            offset: ITEM_ESTIMATED_HEIGHT * index,
            index,
          })}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
      </BottomSheet>
    );
  },
);

ClinicBottomSheet.displayName = 'ClinicBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      boxShadow: `0px 0px 12px ${theme.colors.neutralShadow}`,
    },
    handle: {
      backgroundColor: theme.colors.border,
      width: 40,
      height: 4,
    },
    filterRow: {
      paddingBottom: theme.spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
    },
    scrollContent: {
      flexGrow: 1,
    },
    listContent: {
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      gap: theme.spacing['3'],
    },
    cardWrapper: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
    cardWrapperSelected: {
      boxShadow: `0px 2px 8px ${theme.colors.primary}4D`,
    },
    emptyState: {
      padding: theme.spacing['6'],
      alignItems: 'center',
      gap: theme.spacing['2'],
    },
    emptyTitle: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default ClinicBottomSheet;
