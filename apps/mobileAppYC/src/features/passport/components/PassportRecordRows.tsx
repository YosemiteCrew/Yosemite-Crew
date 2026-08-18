import React from 'react';
import {View, Text} from 'react-native';
import {useTranslation} from 'react-i18next';
import {formatDateDisplay} from '@/shared/utils/commonHelpers';
import type {
  VaccinationDTO,
  ParasiteTreatmentDTO,
  RabiesTitrationDTO,
  ClinicalExamDTO,
} from '@yosemite-crew/types';

export const InfoRow: React.FC<{
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

const rowStyle = (styles: any, isLast?: boolean) =>
  isLast ? styles.recordRow : [styles.recordRow, styles.recordRowDivider];

export const VaccinationRow: React.FC<{
  item: VaccinationDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => {
  const {t} = useTranslation();
  return (
    <View style={rowStyle(styles, isLast)}>
      <Text style={styles.recordTitle}>{item.vaccineName}</Text>
      <InfoRow
        label={t('passport.administeredLabel')}
        value={formatDateDisplay(item.dateAdministered)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.nextDueLabel')}
        value={
          item.nextDueDate ? formatDateDisplay(item.nextDueDate) : undefined
        }
        styles={styles}
      />
      <InfoRow
        label={t('passport.manufacturerLabel')}
        value={item.manufacturer}
        styles={styles}
      />
      <InfoRow
        label={t('passport.administeringVetLabel')}
        value={item.administeringVetName}
        styles={styles}
      />
    </View>
  );
};

export const ParasiteTreatmentRow: React.FC<{
  item: ParasiteTreatmentDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => {
  const {t} = useTranslation();
  return (
    <View style={rowStyle(styles, isLast)}>
      <Text style={styles.recordTitle}>{item.productName}</Text>
      <InfoRow
        label={t('passport.treatedAtLabel')}
        value={formatDateDisplay(item.treatedAt)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.administeringVetLabel')}
        value={item.administeringVetName}
        styles={styles}
      />
    </View>
  );
};

export const RabiesTitrationRow: React.FC<{
  item: RabiesTitrationDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => {
  const {t} = useTranslation();
  return (
    <View style={rowStyle(styles, isLast)}>
      <Text style={styles.recordTitle}>{item.approvedLab}</Text>
      <InfoRow
        label={t('passport.sampleDateLabel')}
        value={formatDateDisplay(item.sampleDate)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.resultLabel')}
        value={t('passport.resultValue', {value: item.resultIuMl})}
        styles={styles}
      />
    </View>
  );
};

export const ClinicalExamRow: React.FC<{
  item: ClinicalExamDTO;
  styles: any;
  isLast?: boolean;
}> = ({item, styles, isLast}) => {
  const {t} = useTranslation();
  return (
    <View style={rowStyle(styles, isLast)}>
      <Text style={styles.recordTitle}>
        {item.fitForTravel
          ? t('passport.fitForTravel')
          : t('passport.notFitForTravel')}
      </Text>
      <InfoRow
        label={t('passport.examinedAtLabel')}
        value={formatDateDisplay(item.examinedAt)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.examiningVetLabel')}
        value={item.examiningVetName}
        styles={styles}
      />
      <InfoRow
        label={t('passport.findingsLabel')}
        value={item.findings}
        styles={styles}
      />
    </View>
  );
};
