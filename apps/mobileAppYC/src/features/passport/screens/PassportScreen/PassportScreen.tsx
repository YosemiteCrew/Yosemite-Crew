import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useDispatch, useSelector} from 'react-redux';
import {useTheme} from '@/hooks';
import {SafeArea} from '@/shared/components/common/SafeArea/SafeArea';
import {Header} from '@/shared/components/common/Header/Header';
import {GifLoader} from '@/shared/components/common';
import {SubcategoryAccordion} from '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {Images} from '@/assets/images';
import {formatDateDisplay} from '@/shared/utils/commonHelpers';
import type {AppDispatch, RootState} from '@/app/store';
import type {HomeStackParamList} from '@/navigation/types';
import {fetchPassport} from '@/features/passport/passportSlice';
import {passportApi} from '@/features/passport/services/passportService';
import {fetchDocuments} from '@/features/documents/documentSlice';
import {SUBCATEGORY_IDS} from '@/features/documents/subcategoryIds';
import type {Document as DocumentRecord} from '@/features/documents/types';
import {setSelectedCompanion} from '@/features/companion';
import type {
  VaccinationDTO,
  ParasiteTreatmentDTO,
  RabiesTitrationDTO,
  ClinicalExamDTO,
} from '@yosemite-crew/types';

// The passport view only ever surfaces vet-SIGNED clinical artifacts (see
// pet-passport.service.ts). A parent's own upload of an old paper record has
// no such attestation, so it is never part of the passport data itself - it's
// rendered as a separate "awaiting review" section sourced from the existing
// Documents feature, filed under Health > Vaccination.
const HISTORICAL_RECORD_CATEGORY = 'health';
const HISTORICAL_RECORD_SUBCATEGORY = SUBCATEGORY_IDS.VACCINATION;

type WalletTarget = 'apple' | 'google' | null;

type PassportNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
type PassportRouteProp = RouteProp<HomeStackParamList, 'Passport'>;

const InfoRow: React.FC<{
  label: string;
  value?: string | null;
  styles: any;
}> = ({label, value, styles}) => {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

export const PassportScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<PassportNavigationProp>();
  const route = useRoute<PassportRouteProp>();
  const dispatch = useDispatch<AppDispatch>();
  const {companionId} = route.params;

  const passport = useSelector(
    (state: RootState) => state.passport.byCompanionId[companionId],
  );
  const loading = useSelector((state: RootState) => state.passport.loading);
  const error = useSelector((state: RootState) => state.passport.error);
  const [walletBusy, setWalletBusy] = useState<WalletTarget>(null);

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

  const showWalletError = (target: 'Apple' | 'Google') => {
    Alert.alert(
      'Wallet pass unavailable',
      `This pet passport could not be added to ${target} Wallet yet.`,
    );
  };

  const handleAddToAppleWallet = () => {
    setWalletBusy('apple');
    Linking.openURL(passportApi.getApplePassUrl(companionId))
      .catch(() => showWalletError('Apple'))
      .finally(() => setWalletBusy(null));
  };

  const handleAddToGoogleWallet = () => {
    setWalletBusy('google');
    passportApi
      .getGoogleWalletUrl(companionId)
      .then(url => Linking.openURL(url))
      .catch(() => showWalletError('Google'))
      .finally(() => setWalletBusy(null));
  };

  useEffect(() => {
    if (companionId) {
      dispatch(fetchPassport({companionId}));
      dispatch(fetchDocuments({companionId}));
    }
  }, [companionId, dispatch]);

  return (
    <SafeArea>
      <Header
        title="Pet Passport"
        showBackButton
        onBack={() => navigation.goBack()}
      />
      {loading && !passport ? (
        <View style={styles.centered}>
          <GifLoader />
        </View>
      ) : error && !passport ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !passport ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              No passport has been issued for this pet yet.
            </Text>
          </View>
          <HistoricalUploadsSection
            records={historicalRecords}
            onUpload={handleUploadHistoricalRecord}
            styles={styles}
            theme={theme}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.identityCard}>
            {passport.identity.photoUrl ? (
              <Image
                source={{uri: passport.identity.photoUrl}}
                style={styles.identityPhoto}
              />
            ) : null}
            <Text style={styles.identityName}>{passport.identity.name}</Text>
            <Text style={styles.identitySubtitle}>
              {[passport.identity.species, passport.identity.breed]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <InfoRow
              label="Sex"
              value={passport.identity.sex}
              styles={styles}
            />
            <InfoRow
              label="Date of birth"
              value={formatDateDisplay(passport.identity.dateOfBirth)}
              styles={styles}
            />
            <InfoRow
              label="Colour"
              value={passport.identity.colour}
              styles={styles}
            />
            <InfoRow
              label="Distinguishing marks"
              value={passport.identity.distinguishingMarks}
              styles={styles}
            />
            {passport.microchip ? (
              <InfoRow
                label="Microchip"
                value={passport.microchip.number}
                styles={styles}
              />
            ) : null}
            {passport.passportNumber ? (
              <InfoRow
                label="Passport number"
                value={passport.passportNumber}
                styles={styles}
              />
            ) : null}
          </View>

          {passport.issuance ? (
            <View style={styles.identityCard}>
              <Text style={styles.sectionHeading}>Issuing details</Text>
              <InfoRow
                label="Issuing practice"
                value={passport.issuance.issuingPractice}
                styles={styles}
              />
              <InfoRow
                label="Issuing vet"
                value={passport.issuance.issuingVetName}
                styles={styles}
              />
              <InfoRow
                label="Issue date"
                value={formatDateDisplay(passport.issuance.issueDate)}
                styles={styles}
              />
              <InfoRow
                label="Issuing country"
                value={passport.issuance.issuingCountry}
                styles={styles}
              />
            </View>
          ) : null}

          {passport.rabies ? (
            <SubcategoryAccordion
              title="Rabies vaccination"
              subtitle={
                passport.rabies.nextDueDate
                  ? `Next due ${formatDateDisplay(passport.rabies.nextDueDate)}`
                  : 'On record'
              }
              defaultExpanded
              containerStyle={styles.accordionItem}>
              <VaccinationRow item={passport.rabies} styles={styles} isLast />
            </SubcategoryAccordion>
          ) : null}

          <SubcategoryAccordion
            title="Vaccinations"
            subtitle={`${passport.vaccinations.length} record${
              passport.vaccinations.length === 1 ? '' : 's'
            }`}
            containerStyle={styles.accordionItem}>
            {passport.vaccinations.length === 0 ? (
              <Text style={styles.emptySectionText}>
                No vaccinations recorded
              </Text>
            ) : (
              passport.vaccinations.map((item, index) => (
                <VaccinationRow
                  key={item.id}
                  item={item}
                  styles={styles}
                  isLast={index === passport.vaccinations.length - 1}
                />
              ))
            )}
          </SubcategoryAccordion>

          <SubcategoryAccordion
            title="Parasite treatments"
            subtitle={`${passport.parasiteTreatments.length} record${
              passport.parasiteTreatments.length === 1 ? '' : 's'
            }`}
            containerStyle={styles.accordionItem}>
            {passport.parasiteTreatments.length === 0 ? (
              <Text style={styles.emptySectionText}>
                No parasite treatments recorded
              </Text>
            ) : (
              passport.parasiteTreatments.map((item, index) => (
                <ParasiteTreatmentRow
                  key={item.id}
                  item={item}
                  styles={styles}
                  isLast={index === passport.parasiteTreatments.length - 1}
                />
              ))
            )}
          </SubcategoryAccordion>

          <SubcategoryAccordion
            title="Rabies titrations"
            subtitle={`${passport.rabiesTitrations.length} record${
              passport.rabiesTitrations.length === 1 ? '' : 's'
            }`}
            containerStyle={styles.accordionItem}>
            {passport.rabiesTitrations.length === 0 ? (
              <Text style={styles.emptySectionText}>
                No rabies titrations recorded
              </Text>
            ) : (
              passport.rabiesTitrations.map((item, index) => (
                <RabiesTitrationRow
                  key={item.id}
                  item={item}
                  styles={styles}
                  isLast={index === passport.rabiesTitrations.length - 1}
                />
              ))
            )}
          </SubcategoryAccordion>

          <SubcategoryAccordion
            title="Clinical exams"
            subtitle={`${passport.clinicalExams.length} record${
              passport.clinicalExams.length === 1 ? '' : 's'
            }`}
            containerStyle={styles.accordionItem}>
            {passport.clinicalExams.length === 0 ? (
              <Text style={styles.emptySectionText}>
                No clinical exams recorded
              </Text>
            ) : (
              passport.clinicalExams.map((item, index) => (
                <ClinicalExamRow
                  key={item.id}
                  item={item}
                  styles={styles}
                  isLast={index === passport.clinicalExams.length - 1}
                />
              ))
            )}
          </SubcategoryAccordion>

          <View style={styles.walletRow}>
            {/* Moved to the bottom, as a footer action - same placement as
                the "Get Directions" button in BusinessDetailsScreen.tsx,
                whose styling these buttons already match. */}
            {Platform.OS === 'ios' ? (
              <LiquidGlassButton
                title="Add to Apple Wallet"
                onPress={handleAddToAppleWallet}
                loading={walletBusy === 'apple'}
                disabled={walletBusy !== null}
                height={theme.spacing['14']}
                borderRadius={theme.borderRadius.lg}
                tintColor={theme.colors.secondary}
                textStyle={styles.walletButtonText}
                glassEffect="clear"
                shadowIntensity="none"
                forceBorder
                borderColor={theme.colors.borderMuted}
                style={styles.walletButton}
              />
            ) : null}
            <LiquidGlassButton
              title="Add to Google Wallet"
              onPress={handleAddToGoogleWallet}
              loading={walletBusy === 'google'}
              disabled={walletBusy !== null}
              height={theme.spacing['14']}
              borderRadius={theme.borderRadius.lg}
              tintColor={theme.colors.secondary}
              textStyle={styles.walletButtonText}
              glassEffect="clear"
              shadowIntensity="none"
              forceBorder
              borderColor={theme.colors.borderMuted}
              style={styles.walletButton}
            />
          </View>

          <HistoricalUploadsSection
            records={historicalRecords}
            onUpload={handleUploadHistoricalRecord}
            styles={styles}
            theme={theme}
          />
        </ScrollView>
      )}
    </SafeArea>
  );
};

const HistoricalUploadsSection: React.FC<{
  records: DocumentRecord[];
  onUpload: () => void;
  styles: any;
  theme: any;
}> = ({records, onUpload, styles, theme}) => (
  <View style={[styles.identityCard, styles.uploadsCard]}>
    <View style={styles.uploadsHeader}>
      <Text style={styles.sectionHeading}>Your uploads</Text>
      {/* Same "+" icon button pattern as the Documents screens
          (DocumentsScreen/CategoryDetailScreen rightIcon={Images.addIconDark}). */}
      <LiquidGlassIconButton onPress={onUpload} size={theme.spacing['9']}>
        <Image source={Images.addIconDark} style={styles.uploadIcon} />
      </LiquidGlassIconButton>
    </View>
    <Text style={styles.uploadsHint}>
      These aren&apos;t part of your official passport yet - a vet needs to
      confirm them first.
    </Text>
    {records.length === 0 ? (
      <Text style={styles.emptySectionText}>
        No historical records uploaded yet.
      </Text>
    ) : (
      records.map((doc, index) => (
        <View
          key={doc.id}
          style={
            index === records.length - 1
              ? styles.recordRow
              : [styles.recordRow, styles.recordRowDivider]
          }>
          <Text style={styles.recordTitle}>{doc.title}</Text>
          <InfoRow
            label="Date"
            value={doc.issueDate ? formatDateDisplay(doc.issueDate) : undefined}
            styles={styles}
          />
          <InfoRow label="Clinic" value={doc.businessName} styles={styles} />
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending review</Text>
          </View>
        </View>
      ))
    )}
  </View>
);

const rowStyle = (styles: any, isLast?: boolean) =>
  isLast ? styles.recordRow : [styles.recordRow, styles.recordRowDivider];

const VaccinationRow: React.FC<{
  item: VaccinationDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => (
  <View style={rowStyle(styles, isLast)}>
    <Text style={styles.recordTitle}>{item.vaccineName}</Text>
    <InfoRow
      label="Administered"
      value={formatDateDisplay(item.dateAdministered)}
      styles={styles}
    />
    <InfoRow
      label="Next due"
      value={item.nextDueDate ? formatDateDisplay(item.nextDueDate) : undefined}
      styles={styles}
    />
    <InfoRow label="Manufacturer" value={item.manufacturer} styles={styles} />
    <InfoRow
      label="Administering vet"
      value={item.administeringVetName}
      styles={styles}
    />
  </View>
);

const ParasiteTreatmentRow: React.FC<{
  item: ParasiteTreatmentDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => (
  <View style={rowStyle(styles, isLast)}>
    <Text style={styles.recordTitle}>{item.productName}</Text>
    <InfoRow
      label="Treated at"
      value={formatDateDisplay(item.treatedAt)}
      styles={styles}
    />
    <InfoRow
      label="Administering vet"
      value={item.administeringVetName}
      styles={styles}
    />
  </View>
);

const RabiesTitrationRow: React.FC<{
  item: RabiesTitrationDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => (
  <View style={rowStyle(styles, isLast)}>
    <Text style={styles.recordTitle}>{item.approvedLab}</Text>
    <InfoRow
      label="Sample date"
      value={formatDateDisplay(item.sampleDate)}
      styles={styles}
    />
    <InfoRow
      label="Result"
      value={`${item.resultIuMl} IU/mL`}
      styles={styles}
    />
  </View>
);

const ClinicalExamRow: React.FC<{
  item: ClinicalExamDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => (
  <View style={rowStyle(styles, isLast)}>
    <Text style={styles.recordTitle}>
      {item.fitForTravel ? 'Fit for travel' : 'Not fit for travel'}
    </Text>
    <InfoRow
      label="Examined at"
      value={formatDateDisplay(item.examinedAt)}
      styles={styles}
    />
    <InfoRow
      label="Examining vet"
      value={item.examiningVetName}
      styles={styles}
    />
    <InfoRow label="Findings" value={item.findings} styles={styles} />
  </View>
);

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    contentContainer: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['32'],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing['6'],
    },
    errorText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.error,
      textAlign: 'center',
    },
    emptyText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    emptySectionText: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      paddingVertical: theme.spacing['3'],
    },
    // cardBackground (#FFFFFF) is nearly identical to the screen background
    // (#FFFEFE), so a background colour alone doesn't visually separate this
    // from the page - added the same border SubcategoryAccordion already
    // uses, so identity/issuing/uploads read as distinct cards too.
    identityCard: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginTop: theme.spacing['4'],
    },
    identityPhoto: {
      width: theme.spacing['20'],
      height: theme.spacing['20'],
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing['3'],
    },
    walletRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      marginTop: theme.spacing['4'],
    },
    // Matches the "Get Directions" button in BusinessDetailsScreen.tsx for
    // everything except font size: that button is full-width with a short
    // label ("Get Directions"), these are flex:1 side by side with longer
    // labels ("Add to Apple Wallet"), so `cta` (18px) was clipping - sized
    // down to buttonSmall so the full label fits without wrapping/clipping.
    walletButton: {
      flex: 1,
    },
    walletButtonText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.white,
    },
    identityName: {
      ...theme.typography.h4,
      color: theme.colors.text,
    },
    identitySubtitle: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['3'],
    },
    sectionHeading: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['1'],
    },
    infoLabel: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    infoValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '600',
    },
    accordionItem: {
      marginTop: theme.spacing['3'],
    },
    recordRow: {
      paddingVertical: theme.spacing['2'],
    },
    // Applied to every row except the last in a section, so a lone/final
    // record doesn't show a dangling divider with nothing below it.
    recordRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderMuted,
    },
    recordTitle: {
      ...theme.typography.labelLarge,
      color: theme.colors.text,
      marginBottom: theme.spacing['1'],
    },
    uploadsCard: {
      marginBottom: theme.spacing['4'],
    },
    uploadsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    uploadIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },
    uploadsHint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing['1'],
      marginBottom: theme.spacing['2'],
    },
    // Matches the pending-status chip pattern already used in
    // features/tasks/components/TaskCard/TaskCard.tsx (pendingBadge/pendingText).
    pendingBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.warningSurface,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing['2'],
      paddingVertical: theme.spacing['1'],
      marginTop: theme.spacing['1'],
    },
    pendingBadgeText: {
      ...theme.typography.labelSmall,
      color: theme.colors.warning,
    },
  });
