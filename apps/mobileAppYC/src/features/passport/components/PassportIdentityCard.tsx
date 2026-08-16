import React from 'react';
import {View, Text, Image} from 'react-native';
import {useTranslation} from 'react-i18next';
import {formatDateDisplay} from '@/shared/utils/commonHelpers';
import {InfoRow} from '@/features/passport/components/PassportRecordRows';
import type {PetPassportDTO} from '@yosemite-crew/types';

export const PassportIdentityCard: React.FC<{
  passport: PetPassportDTO;
  styles: any;
}> = ({passport, styles}) => {
  const {t} = useTranslation();
  return (
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
        label={t('passport.sexLabel')}
        value={passport.identity.sex}
        styles={styles}
      />
      <InfoRow
        label={t('passport.dateOfBirthLabel')}
        value={formatDateDisplay(passport.identity.dateOfBirth)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.colourLabel')}
        value={passport.identity.colour}
        styles={styles}
      />
      <InfoRow
        label={t('passport.distinguishingMarksLabel')}
        value={passport.identity.distinguishingMarks}
        styles={styles}
      />
      {passport.microchip ? (
        <InfoRow
          label={t('passport.microchipLabel')}
          value={passport.microchip.number}
          styles={styles}
        />
      ) : null}
      {passport.passportNumber ? (
        <InfoRow
          label={t('passport.passportNumberLabel')}
          value={passport.passportNumber}
          styles={styles}
        />
      ) : null}
    </View>
  );
};

export const PassportIssuanceCard: React.FC<{
  issuance: NonNullable<PetPassportDTO['issuance']>;
  styles: any;
}> = ({issuance, styles}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.identityCard}>
      <Text style={styles.sectionHeading}>
        {t('passport.issuingDetailsTitle')}
      </Text>
      <InfoRow
        label={t('passport.issuingPracticeLabel')}
        value={issuance.issuingPractice}
        styles={styles}
      />
      <InfoRow
        label={t('passport.issuingVetLabel')}
        value={issuance.issuingVetName}
        styles={styles}
      />
      <InfoRow
        label={t('passport.issueDateLabel')}
        value={formatDateDisplay(issuance.issueDate)}
        styles={styles}
      />
      <InfoRow
        label={t('passport.issuingCountryLabel')}
        value={issuance.issuingCountry}
        styles={styles}
      />
    </View>
  );
};
