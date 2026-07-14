import React, {useMemo, useRef} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {SegmentedControl} from '@/shared/components/common/SegmentedControl/SegmentedControl';
import {TouchableInput} from '@/shared/components/common/TouchableInput/TouchableInput';
import {
  CurrencyBottomSheet,
  type CurrencyBottomSheetRef,
} from '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet';
import {
  GenericSelectBottomSheet,
  type GenericSelectBottomSheetRef,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import type {HomeStackParamList} from '@/navigation/types';
import {usePreferences} from '@/features/preferences/PreferencesContext';
import {getCurrencyRecord, type CurrencyCode} from '@/shared/utils/currency';
import type {DistanceUnit, WeightUnit} from '@/shared/utils/measurementSystem';

type Props = NativeStackScreenProps<HomeStackParamList, 'Preferences'>;

type ThemeMode = 'light' | 'dark' | 'system';

const DISTANCE_OPTIONS = [
  {label: 'Kilometres', value: 'km'},
  {label: 'Miles', value: 'mi'},
];

const WEIGHT_OPTIONS = [
  {label: 'Kilograms', value: 'kg'},
  {label: 'Pounds', value: 'lbs'},
];

const APPEARANCE_OPTIONS = [
  {label: 'System', value: 'system'},
  {label: 'Light', value: 'light'},
  {label: 'Dark', value: 'dark'},
];

const LANGUAGE_OPTIONS: SelectItem[] = [
  {id: 'en', label: 'English'},
  {id: 'es', label: 'Español'},
];

export const PreferencesScreen: React.FC<Props> = ({navigation}) => {
  const {theme, themeMode, setTheme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {i18n} = useTranslation();

  const {
    weightUnit,
    distanceUnit,
    currency,
    setWeightUnit,
    setDistanceUnit,
    setCurrency,
  } = usePreferences();

  const currencySheetRef = useRef<CurrencyBottomSheetRef>(null);
  const languageSheetRef = useRef<GenericSelectBottomSheetRef>(null);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const currencyRecord = getCurrencyRecord(currency);
  const currencyLabel = currencyRecord
    ? `${currencyRecord.code} ${currencyRecord.symbol}`
    : currency;

  const languageCode = (i18n.language || 'en').split('-')[0];
  const selectedLanguage =
    LANGUAGE_OPTIONS.find(option => option.id === languageCode) ??
    LANGUAGE_OPTIONS[0];

  const chevron = (
    <Ionicons name="chevron-down" size={16} color={theme.colors.inkFaint} />
  );

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Preferences"
            showBackButton
            onBack={handleBack}
            glass={false}
          />
        }
        contentPadding={theme.spacing['5']}
        useSafeAreaView
        containerStyle={styles.container}
        showBottomFade={false}>
        {contentPaddingStyle => (
          <View style={styles.contentWrapper}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.content, contentPaddingStyle]}
              showsVerticalScrollIndicator={false}>
              {/* Distance */}
              <View>
                <Text style={styles.label}>Distance</Text>
                <SegmentedControl
                  options={DISTANCE_OPTIONS}
                  value={distanceUnit}
                  onChange={value => setDistanceUnit(value as DistanceUnit)}
                  testID="distance-unit-control"
                />
              </View>

              {/* Weight */}
              <View>
                <Text style={styles.label}>Weight</Text>
                <SegmentedControl
                  options={WEIGHT_OPTIONS}
                  value={weightUnit}
                  onChange={value => setWeightUnit(value as WeightUnit)}
                  testID="weight-unit-control"
                />
              </View>

              {/* Currency */}
              <View>
                <TouchableInput
                  label="Currency"
                  value={currencyLabel}
                  onPress={() => currencySheetRef.current?.open()}
                  rightComponent={chevron}
                />
                <Text style={styles.caption}>
                  Used for expenses and invoices. Existing entries are not
                  converted.
                </Text>
              </View>

              {/* Appearance */}
              <View>
                <Text style={styles.label}>Appearance</Text>
                <SegmentedControl
                  options={APPEARANCE_OPTIONS}
                  value={themeMode}
                  onChange={value => setTheme(value as ThemeMode)}
                  testID="appearance-control"
                />
                <Text style={styles.caption}>
                  Dark uses the warm espresso theme.
                </Text>
              </View>

              {/* Language */}
              <View>
                <TouchableInput
                  label="Language"
                  value={selectedLanguage.label}
                  onPress={() => languageSheetRef.current?.open()}
                  rightComponent={chevron}
                />
              </View>
            </ScrollView>

            <Text style={styles.footnote}>
              Changes apply immediately and are saved on this device.
            </Text>
          </View>
        )}
      </LiquidGlassHeaderScreen>

      <CurrencyBottomSheet
        ref={currencySheetRef}
        selectedCurrency={currency}
        onSave={value => setCurrency(value as CurrencyCode)}
      />

      <GenericSelectBottomSheet
        ref={languageSheetRef}
        title="Language"
        items={LANGUAGE_OPTIONS}
        selectedItem={selectedLanguage}
        onSave={item => {
          if (item) {
            i18n.changeLanguage(item.id);
          }
        }}
        mode="select"
        hasSearch={false}
        snapPoints={['40%', '45%']}
        emptyMessage="No languages available"
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    contentWrapper: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['4'],
      gap: theme.spacing['4'],
    },
    label: {
      ...theme.typography.inputLabel,
      color: theme.colors.inkBody,
      marginBottom: theme.spacing['2'],
      marginLeft: theme.spacing['1'],
    },
    caption: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint2,
      marginTop: theme.spacing['2'],
      marginLeft: theme.spacing['1'],
    },
    footnote: {
      ...theme.typography.body12,
      color: theme.colors.inkFaint2,
      textAlign: 'center',
      paddingHorizontal: theme.spacing['5'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['8'],
    },
  });
