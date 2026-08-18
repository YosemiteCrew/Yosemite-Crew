import React, {useEffect} from 'react';
import {View, Text, ScrollView} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import type {AppDispatch, RootState} from '@/app/store';
import type {HomeStackParamList} from '@/navigation/types';
import {fetchPassport} from '@/features/passport/passportSlice';
import {createPassportStyles} from '@/features/passport/components/passportStyles';
import {PassportDetails} from '@/features/passport/components/PassportDetails';
import {HistoricalUploadsSection} from '@/features/passport/components/HistoricalUploadsSection';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {SUBCATEGORY_IDS} from '@/features/documents/subcategoryIds';
import {setSelectedCompanion} from '@/features/companion';

// The passport view only ever surfaces vet-SIGNED clinical artifacts (see
// pet-passport.service.ts). A parent's own upload of an old paper record has
// no such attestation, so it is never part of the passport data itself - it's
// rendered as a separate "awaiting review" section sourced from the existing
// Documents feature, filed under Health > Vaccination.
const HISTORICAL_RECORD_CATEGORY = 'health';
const HISTORICAL_RECORD_SUBCATEGORY = SUBCATEGORY_IDS.VACCINATION;

type PassportNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
type PassportRouteProp = RouteProp<HomeStackParamList, 'Passport'>;

export const PassportScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createPassportStyles(theme), [theme]);
  const {t} = useTranslation();
  const navigation = useNavigation<PassportNavigationProp>();
  const route = useRoute<PassportRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  const {companionId} = route.params;

  const passport = useSelector(
    (state: RootState) => state.passport.byCompanionId[companionId],
  );
  const loading = useSelector(
    (state: RootState) =>
      state.passport.loadingByCompanionId[companionId] ?? false,
  );
  const error = useSelector(
    (state: RootState) =>
      state.passport.errorByCompanionId[companionId] ?? null,
  );

  const allDocuments = useSelector(
    (state: RootState) => state.documents.documents,
  );
  const historicalRecords = React.useMemo(
    () =>
      allDocuments.filter(
        doc =>
          doc.companionId === companionId &&
          doc.category === HISTORICAL_RECORD_CATEGORY &&
          doc.subcategory === HISTORICAL_RECORD_SUBCATEGORY,
      ),
    [allDocuments, companionId],
  );

  const handleUploadHistoricalRecord = () => {
    dispatch(setSelectedCompanion(companionId));
    navigation.getParent()?.navigate('Documents', {
      screen: 'AddDocument',
      params: {
        initialCategory: HISTORICAL_RECORD_CATEGORY,
        initialSubcategory: HISTORICAL_RECORD_SUBCATEGORY,
      },
    });
  };

  useEffect(() => {
    if (companionId) {
      dispatch(fetchPassport({companionId}));
      dispatch(fetchDocuments({companionId}));
    }
  }, [companionId, dispatch]);

  const renderBody = () => {
    if (loading && !passport) {
      return (
        <View style={styles.centered}>
          <GifLoader />
        </View>
      );
    }

    if (error && !passport) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    // No passport issued for this pet - the backend 404 the slice resolves as
    // an empty result lands here, alongside the historical-upload prompt.
    if (!passport) {
      return (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.centered}>
            <Text style={styles.emptyText}>{t('passport.empty')}</Text>
          </View>
          <HistoricalUploadsSection
            records={historicalRecords}
            onUpload={handleUploadHistoricalRecord}
            styles={styles}
            theme={theme}
          />
        </ScrollView>
      );
    }

    return (
      <PassportDetails
        passport={passport}
        companionId={companionId}
        historicalRecords={historicalRecords}
        onUploadHistoricalRecord={handleUploadHistoricalRecord}
        styles={styles}
        theme={theme}
      />
    );
  };

  return (
    <SafeArea>
      <Header
        title={t('passport.title')}
        showBackButton
        onBack={() => navigation.goBack()}
      />
      {renderBody()}
    </SafeArea>
  );
};
