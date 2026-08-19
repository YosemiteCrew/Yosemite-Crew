import React from 'react';
import {View, Text, Image} from 'react-native';
import {useTranslation} from 'react-i18next';
import {LiquidGlassIconButton} from '@/shared/components/common/LiquidGlassIconButton/LiquidGlassIconButton';
import {Images} from '@/assets/images';
import {formatDateDisplay} from '@/shared/utils/commonHelpers';
import {InfoRow} from '@/features/passport/components/PassportRecordRows';
import type {Document as DocumentRecord} from '@/features/documents/types';

export const HistoricalUploadsSection: React.FC<{
  records: DocumentRecord[];
  onUpload: () => void;
  styles: any;
  theme: any;
}> = ({records, onUpload, styles, theme}) => {
  const {t} = useTranslation();
  return (
    <View style={[styles.identityCard, styles.uploadsCard]}>
      <View style={styles.uploadsHeader}>
        <Text style={styles.sectionHeading}>{t('passport.uploadsTitle')}</Text>
        {/* Same "+" icon button pattern as the Documents screens
          (DocumentsScreen/CategoryDetailScreen rightIcon={Images.addIconDark}). */}
        <LiquidGlassIconButton onPress={onUpload} size={theme.spacing['9']}>
          <Image source={Images.addIconDark} style={styles.uploadIcon} />
        </LiquidGlassIconButton>
      </View>
      <Text style={styles.uploadsHint}>{t('passport.uploadsHint')}</Text>
      {records.length === 0 ? (
        <Text style={styles.emptySectionText}>
          {t('passport.uploadsEmpty')}
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
              label={t('passport.dateLabel')}
              value={
                doc.issueDate ? formatDateDisplay(doc.issueDate) : undefined
              }
              styles={styles}
            />
            <InfoRow
              label={t('passport.clinicLabel')}
              value={doc.businessName}
              styles={styles}
            />
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {t('passport.pendingReview')}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
};
