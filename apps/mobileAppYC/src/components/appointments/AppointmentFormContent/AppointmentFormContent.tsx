import React, {useMemo, useCallback} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {BookingSummaryCard} from '@/components/appointments/BookingSummaryCard/BookingSummaryCard';
import {CompanionSelector, type CompanionBase} from '@/components/common/CompanionSelector/CompanionSelector';
import CalendarMonthStrip from '@/components/appointments/CalendarMonthStrip/CalendarMonthStrip';
import TimeSlotPills from '@/components/appointments/TimeSlotPills/TimeSlotPills';
import {Input} from '@/components/common/Input/Input';
import {Checkbox} from '@/components/common/Checkbox/Checkbox';
import {DocumentAttachmentsSection} from '@/components/documents/DocumentAttachmentsSection';
import {useTheme} from '@/hooks';
import type {DocumentFile} from '@/types/document.types';

type SummaryCardConfig = {
  title: string;
  subtitlePrimary?: string | null;
  subtitleSecondary?: string | null;
  image?: any;
  onEdit?: () => void;
  interactive?: boolean;
};

export type AppointmentAgreement = {
  id: string;
  value: boolean;
  label: string;
  onChange?: (value: boolean) => void;
};

export interface AppointmentFormContentProps {
  businessCard?: SummaryCardConfig;
  employeeCard?: SummaryCardConfig;
  companions: CompanionBase[];
  selectedCompanionId: string | null;
  onSelectCompanion: (id: string) => void;
  showAddCompanion?: boolean;
  selectedDate: Date;
  todayISO: string;
  onDateChange: (nextDate: Date, iso: string) => void;
  dateMarkers: Set<string>;
  slots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  emptySlotsMessage: string;
  appointmentType: string;
  allowTypeEdit: boolean;
  onTypeChange?: (value: string) => void;
  concern: string;
  onConcernChange: (value: string) => void;
  showEmergency: boolean;
  emergency: boolean;
  onEmergencyChange: (value: boolean) => void;
  emergencyMessage: string;
  files: DocumentFile[];
  onAddDocuments: () => void;
  onRequestRemoveFile: (id: string) => void;
  attachmentsEmptySubtitle?: string;
  agreements: AppointmentAgreement[];
  actions?: React.ReactNode;
}

export const AppointmentFormContent: React.FC<AppointmentFormContentProps> = ({
  businessCard,
  employeeCard,
  companions,
  selectedCompanionId,
  onSelectCompanion,
  showAddCompanion = false,
  selectedDate,
  todayISO,
  onDateChange,
  dateMarkers,
  slots,
  selectedSlot,
  onSelectSlot,
  emptySlotsMessage,
  appointmentType,
  allowTypeEdit,
  onTypeChange,
  concern,
  onConcernChange,
  showEmergency,
  emergency,
  onEmergencyChange,
  emergencyMessage,
  files,
  onAddDocuments,
  onRequestRemoveFile,
  attachmentsEmptySubtitle = 'Only DOC, PDF, PNG, JPEG formats with max size 20 MB',
  agreements,
  actions,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleDateChange = useCallback(
    (nextDate: Date) => {
      const iso = nextDate.toISOString().slice(0, 10);
      if (iso < todayISO) {
        return;
      }
      onDateChange(nextDate, iso);
    },
    [onDateChange, todayISO],
  );

  return (
    <View style={styles.container}>
      {businessCard && (
        <BookingSummaryCard
          title={businessCard.title}
          subtitlePrimary={businessCard.subtitlePrimary ?? undefined}
          subtitleSecondary={businessCard.subtitleSecondary ?? undefined}
          image={businessCard.image}
          onEdit={businessCard.onEdit}
          interactive={businessCard.interactive}
          style={styles.summaryCard}
        />
      )}

      {employeeCard && (
        <BookingSummaryCard
          title={employeeCard.title}
          subtitlePrimary={employeeCard.subtitlePrimary ?? undefined}
          subtitleSecondary={employeeCard.subtitleSecondary ?? undefined}
          image={employeeCard.image}
          onEdit={employeeCard.onEdit}
          interactive={employeeCard.interactive}
          style={styles.summaryCard}
        />
      )}

      <CompanionSelector
        companions={companions}
        selectedCompanionId={selectedCompanionId}
        onSelect={onSelectCompanion}
        showAddButton={showAddCompanion}
      />

      <CalendarMonthStrip
        selectedDate={selectedDate}
        onChange={handleDateChange}
        datesWithMarkers={dateMarkers}
      />

      <Text style={styles.sectionTitle}>Available slots</Text>
      <TimeSlotPills slots={slots} selected={selectedSlot} onSelect={onSelectSlot} />
      {slots.length === 0 && (
        <Text style={styles.emptySlotsText}>{emptySlotsMessage}</Text>
      )}

      <Input
        label="Appointment Type"
        value={appointmentType}
        onChangeText={allowTypeEdit ? onTypeChange : undefined}
        editable={allowTypeEdit}
        placeholder="General Checkup"
        containerStyle={styles.inputContainer}
      />

      <Input
        label="Describe your concern"
        value={concern}
        onChangeText={onConcernChange}
        multiline
        numberOfLines={4}
        containerStyle={styles.inputContainer}
        inputStyle={styles.multilineInput}
      />

      {showEmergency && (
        <View style={styles.checkboxRow}>
          <Checkbox value={emergency} onValueChange={onEmergencyChange} />
          <Text style={styles.checkboxLabel}>{emergencyMessage}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Upload records</Text>
      <DocumentAttachmentsSection
        files={files}
        onAddPress={onAddDocuments}
        onRequestRemove={file => onRequestRemoveFile(file.id)}
        emptyTitle="Upload documents"
        emptySubtitle={attachmentsEmptySubtitle}
      />

      {agreements.map(agreement => (
        <Checkbox
          key={agreement.id}
          value={agreement.value}
          onValueChange={agreement.onChange ?? (() => {})}
          label={agreement.label}
        />
      ))}

      {actions ? <View style={styles.actionsContainer}>{actions}</View> : null}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[4],
    },
    summaryCard: {
      marginBottom: theme.spacing[3],
    },
    sectionTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      marginBottom: theme.spacing[2],
      marginTop: theme.spacing[2],
    },
    inputContainer: {
      marginBottom: theme.spacing[3],
    },
    multilineInput: {
      minHeight: 100,
      textAlignVertical: 'top',
      paddingTop: theme.spacing[2],
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing[3],
      gap: theme.spacing[2],
    },
    checkboxLabel: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
      flex: 1,
      paddingTop: 2,
    },
    emptySlotsText: {
      ...theme.typography.body12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing[1.5],
    },
    actionsContainer: {
      marginTop: theme.spacing[4],
      marginBottom: theme.spacing[2],
    },
  });

export default AppointmentFormContent;
