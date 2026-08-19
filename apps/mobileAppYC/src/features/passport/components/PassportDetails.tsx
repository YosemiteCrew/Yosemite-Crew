import React from 'react';
import {Text, ScrollView} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SubcategoryAccordion} from '@/shared/components/common/SubcategoryAccordion/SubcategoryAccordion';
import {formatDateDisplay} from '@/shared/utils/commonHelpers';
import {
  VaccinationRow,
  ParasiteTreatmentRow,
  RabiesTitrationRow,
  ClinicalExamRow,
} from '@/features/passport/components/PassportRecordRows';
import {
  PassportIdentityCard,
  PassportIssuanceCard,
} from '@/features/passport/components/PassportIdentityCard';
import {PassportWalletButtons} from '@/features/passport/components/PassportWalletButtons';
import {HistoricalUploadsSection} from '@/features/passport/components/HistoricalUploadsSection';
import type {Document as DocumentRecord} from '@/features/documents/types';
import type {PetPassportDTO} from '@yosemite-crew/types';

interface RecordSectionProps<T> {
  readonly title: string;
  readonly emptyText: string;
  readonly items: T[];
  readonly renderItem: (item: T, isLast: boolean) => React.ReactNode;
  readonly styles: any;
}

function RecordSection<T extends {id: string}>({
  title,
  emptyText,
  items,
  renderItem,
  styles,
}: Readonly<RecordSectionProps<T>>) {
  const {t} = useTranslation();
  return (
    <SubcategoryAccordion
      title={title}
      subtitle={t('passport.recordCount', {count: items.length})}
      containerStyle={styles.accordionItem}>
      {items.length === 0 ? (
        <Text style={styles.emptySectionText}>{emptyText}</Text>
      ) : (
        items.map((item, index) => renderItem(item, index === items.length - 1))
      )}
    </SubcategoryAccordion>
  );
}

export const PassportDetails: React.FC<{
  passport: PetPassportDTO;
  companionId: string;
  historicalRecords: DocumentRecord[];
  onUploadHistoricalRecord: () => void;
  styles: any;
  theme: any;
}> = ({
  passport,
  companionId,
  historicalRecords,
  onUploadHistoricalRecord,
  styles,
  theme,
}) => {
  const {t} = useTranslation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}>
      <PassportIdentityCard passport={passport} styles={styles} />

      {passport.issuance ? (
        <PassportIssuanceCard issuance={passport.issuance} styles={styles} />
      ) : null}

      {passport.rabies ? (
        <SubcategoryAccordion
          title={t('passport.rabiesTitle')}
          subtitle={
            passport.rabies.nextDueDate
              ? t('passport.rabiesNextDue', {
                  date: formatDateDisplay(passport.rabies.nextDueDate),
                })
              : t('passport.rabiesOnRecord')
          }
          defaultExpanded
          containerStyle={styles.accordionItem}>
          <VaccinationRow item={passport.rabies} styles={styles} isLast />
        </SubcategoryAccordion>
      ) : null}

      <RecordSection
        title={t('passport.vaccinationsTitle')}
        emptyText={t('passport.vaccinationsEmpty')}
        items={passport.vaccinations}
        styles={styles}
        renderItem={(item, isLast) => (
          <VaccinationRow
            key={item.id}
            item={item}
            styles={styles}
            isLast={isLast}
          />
        )}
      />

      <RecordSection
        title={t('passport.parasiteTreatmentsTitle')}
        emptyText={t('passport.parasiteTreatmentsEmpty')}
        items={passport.parasiteTreatments}
        styles={styles}
        renderItem={(item, isLast) => (
          <ParasiteTreatmentRow
            key={item.id}
            item={item}
            styles={styles}
            isLast={isLast}
          />
        )}
      />

      <RecordSection
        title={t('passport.rabiesTitrationsTitle')}
        emptyText={t('passport.rabiesTitrationsEmpty')}
        items={passport.rabiesTitrations}
        styles={styles}
        renderItem={(item, isLast) => (
          <RabiesTitrationRow
            key={item.id}
            item={item}
            styles={styles}
            isLast={isLast}
          />
        )}
      />

      <RecordSection
        title={t('passport.clinicalExamsTitle')}
        emptyText={t('passport.clinicalExamsEmpty')}
        items={passport.clinicalExams}
        styles={styles}
        renderItem={(item, isLast) => (
          <ClinicalExamRow
            key={item.id}
            item={item}
            styles={styles}
            isLast={isLast}
          />
        )}
      />

      {/* Wallet passes are built from an ISSUED passport: the pass QR carries
          the public token, and a pet without one has nothing to verify against,
          so the wallet endpoints 404. Hide the actions until a vet issues it
          rather than offering a download that cannot succeed. */}
      {passport.issuance && (
        <PassportWalletButtons
          companionId={companionId}
          styles={styles}
          theme={theme}
        />
      )}

      <HistoricalUploadsSection
        records={historicalRecords}
        onUpload={onUploadHistoricalRecord}
        styles={styles}
        theme={theme}
      />
    </ScrollView>
  );
};
