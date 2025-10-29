import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {UploadDocumentBottomSheet} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import {Images} from '@/assets/images';
import type {RootState, AppDispatch} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {selectAvailabilityFor} from '@/features/appointments/selectors';
import {updateAppointmentStatus} from '@/features/appointments/appointmentsSlice';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
} from '@/features/appointments/utils/availability';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const EditAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId, mode} = route.params as {appointmentId: string; mode?: 'reschedule'};
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const availability = useSelector(selectAvailabilityFor(apt?.businessId || '', apt?.employeeId || ''));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === apt?.employeeId));
  const companions = useSelector((s: RootState) => s.companion.companions);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const firstAvailableDate = useMemo(
    () => getFirstAvailableDate(availability, todayISO, apt?.date),
    [availability, todayISO, apt?.date],
  );
  const [date, setDate] = useState<string>(apt?.date ?? firstAvailableDate);
  const [dateObj, setDateObj] = useState<Date>(new Date(apt?.date ?? firstAvailableDate));
  const [time, setTime] = useState<string | null>(apt?.time || null);
  const type = apt?.type || 'General Checkup';
  const [concern, setConcern] = useState(apt?.concern || '');
  const [emergency, setEmergency] = useState(apt?.emergency || false);
  const [files, setFiles] = useState<DocumentFile[]>([]);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {uploadSheetRef, deleteSheetRef} = refs;

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations({
    files,
    setFiles,
    clearError: () => {},
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const isReschedule = mode === 'reschedule';

  const slots = useMemo(
    () => getSlotsForDate(availability, date, todayISO),
    [availability, date, todayISO],
  );

  const futureDateMarkers = useMemo(
    () => getFutureAvailabilityMarkers(availability, todayISO),
    [availability, todayISO],
  );

  if (!apt) return null;

  const handleSubmit = () => {
    if (isReschedule) {
      dispatch(updateAppointmentStatus({appointmentId, status: 'rescheduled'}));
    }
    navigation.goBack();
  };

  const handleUploadDocuments = () => {
    openSheet('upload');
    uploadSheetRef.current?.open();
  };

  return (
    <SafeArea>
      <Header
        title="Edit Appointments"
        showBackButton
        onBack={() => navigation.goBack()}
        rightIcon={Images.deleteIcon}
        onRightPress={() => cancelSheetRef.current?.open?.()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <AppointmentFormContent
          businessCard={{
            title: business?.name ?? '',
            subtitlePrimary: business?.address ?? undefined,
            subtitleSecondary: business?.description ?? undefined,
            image: business?.photo,
            onEdit: () => navigation.goBack(),
          }}
          employeeCard={
            employee
              ? {
                  title: employee.name,
                  subtitlePrimary: employee.specialization,
                  subtitleSecondary: employee.title,
                  image: employee.avatar,
                  onEdit: () => navigation.goBack(),
                }
              : undefined
          }
          companions={companions}
          selectedCompanionId={apt.companionId}
          onSelectCompanion={(_id: string) => {}}
          showAddCompanion={false}
          selectedDate={dateObj}
          todayISO={todayISO}
          onDateChange={(nextDate, iso) => {
            setDateObj(nextDate);
            setDate(iso);
            setTime(null);
          }}
          dateMarkers={futureDateMarkers}
          slots={slots}
          selectedSlot={time}
          onSelectSlot={slot => setTime(slot)}
          emptySlotsMessage="No future slots available. Try a different date or contact the clinic."
          appointmentType={type}
          allowTypeEdit={false}
          concern={concern}
          onConcernChange={setConcern}
          showEmergency={type === 'Emergency'}
          emergency={emergency}
          onEmergencyChange={setEmergency}
          emergencyMessage="I confirm this is an emergency. For urgent concerns, please contact my vet here."
          files={files}
          onAddDocuments={handleUploadDocuments}
          onRequestRemoveFile={handleRemoveFile}
          agreements={[
            {
              id: 'business-terms',
              value: true,
              label:
                "I agree to the (Pet Business name)'s terms and conditions, and privacy policy. I consent to the sharing of my companion's health information with (Pet Business name) for the purpose of assessment.",
            },
            {
              id: 'app-terms',
              value: true,
              label: "I agree to Yosemite Crew's terms and conditions and privacy policy",
            },
          ]}
          actions={
            <LiquidGlassButton
              title={isReschedule ? 'Submit reschedule request' : 'Save changes'}
              onPress={handleSubmit}
              height={56}
              borderRadius={16}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
            />
          }
        />
      </ScrollView>

      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={() => {
          handleTakePhoto();
          closeSheet();
        }}
        onChooseGallery={() => {
          handleChooseFromGallery();
          closeSheet();
        }}
        onUploadDrive={() => {
          handleUploadFromDrive();
          closeSheet();
        }}
      />

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={
          fileToDelete
            ? files.find(f => f.id === fileToDelete)?.name
            : 'this file'
        }
        onDelete={confirmDeleteFile}
      />

      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={() => {
          dispatch(updateAppointmentStatus({appointmentId, status: 'canceled'}));
          navigation.goBack();
        }}
      />
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    container: {
      padding: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      gap: theme.spacing[4],
    },
  });

export default EditAppointmentScreen;
