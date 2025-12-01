import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {DocumentUploadSheets} from '@/features/appointments/components/DocumentUploadSheets';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent';
import {useTheme} from '@/hooks';
import {useDocumentUpload} from '@/shared/hooks/useDocumentUpload';
import {Images} from '@/assets/images';
import type {RootState, AppDispatch} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {selectAvailabilityFor, selectServiceById} from '@/features/appointments/selectors';
import {cancelAppointment, rescheduleAppointment} from '@/features/appointments/appointmentsSlice';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
  parseSlotLabel,
} from '@/features/appointments/utils/availability';
import {fetchServiceSlots} from '@/features/appointments/businessesSlice';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const EditAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId, mode} = route.params as {appointmentId: string; mode?: 'reschedule'};
  const apt = useSelector((s: RootState) => s.appointments.items.find(a => a.id === appointmentId));
  const service = useSelector(selectServiceById(apt?.serviceId ?? null));
  const availabilitySelector = React.useMemo(
    () =>
      selectAvailabilityFor(apt?.businessId || '', {
        serviceId: apt?.serviceId,
        employeeId: apt?.employeeId ?? service?.defaultEmployeeId ?? null,
      }),
    [apt?.businessId, apt?.employeeId, apt?.serviceId, service?.defaultEmployeeId],
  );
  const availability = useSelector(availabilitySelector);
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === apt?.businessId));
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === apt?.employeeId));
  const companions = useSelector((s: RootState) => s.companion.companions);
  const appointmentsLoading = useSelector((s: RootState) => s.appointments.loading);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const firstAvailableDate = useMemo(
    () => getFirstAvailableDate(availability, todayISO, apt?.date),
    [availability, todayISO, apt?.date],
  );
  const [date, setDate] = useState<string>(apt?.date ?? firstAvailableDate);
  const [dateObj, setDateObj] = useState<Date>(new Date(apt?.date ?? firstAvailableDate));
  const initialTimeLabel = (() => {
    if (!apt?.time) {
      return null;
    }
    if (apt.endTime) {
      return `${apt.time} - ${apt.endTime}`;
    }
    return apt.time;
  })();
  const [time, setTime] = useState<string | null>(initialTimeLabel);
  const type = apt?.type || 'General Checkup';
  const [concern, setConcern] = useState(apt?.concern || '');
  const [emergency, setEmergency] = useState(apt?.emergency || false);
  const [files, setFiles] = useState<DocumentFile[]>([]);

  const {
    refs: {uploadSheetRef, deleteSheetRef},
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
    openSheet,
    closeSheet,
  } = useDocumentUpload({
    files,
    setFiles,
  });

  React.useEffect(() => {
    if (!apt?.businessId || !apt?.serviceId || !date) {
      return;
    }
    dispatch(
      fetchServiceSlots({
        businessId: apt.businessId,
        serviceId: apt.serviceId,
        date,
      }),
    );
  }, [apt?.businessId, apt?.serviceId, date, dispatch]);

  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);
  const isReschedule = mode === 'reschedule';

  const slots = useMemo(() => {
    const available = getSlotsForDate(availability, date, todayISO);
    if (available.length === 0 && time) {
      return [time];
    }
    return available;
  }, [availability, date, time, todayISO]);

  const futureDateMarkers = useMemo(
    () => getFutureAvailabilityMarkers(availability, todayISO),
    [availability, todayISO],
  );

  if (!apt) return null;

  const handleSubmit = () => {
    if (isReschedule && time) {
      const {startTime, endTime} = parseSlotLabel(time);
      dispatch(
        rescheduleAppointment({
          appointmentId,
          startTime: startTime ?? time,
          endTime: endTime ?? startTime ?? time,
          isEmergency: emergency,
          concern,
        }),
      );
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
          serviceCard={
            (service || apt.serviceName)
              ? {
                  title: service?.name ?? apt.serviceName ?? 'Requested service',
                  subtitlePrimary: service?.description,
                  subtitleSecondary: undefined,
                  badgeText: service?.basePrice ? `$${service.basePrice}` : null,
                  image: undefined,
                  showAvatar: false,
                  interactive: false,
                }
              : undefined
          }
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
              disabled={isReschedule && (!time || appointmentsLoading)}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          }
        />
      </ScrollView>

      <DocumentUploadSheets
        uploadSheetRef={uploadSheetRef}
        deleteSheetRef={deleteSheetRef}
        fileToDelete={fileToDelete}
        files={files}
        onTakePhoto={handleTakePhoto}
        onChooseGallery={handleChooseFromGallery}
        onUploadDrive={handleUploadFromDrive}
        confirmDeleteFile={confirmDeleteFile}
        closeSheet={closeSheet}
      />

      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={() => {
          dispatch(cancelAppointment({appointmentId}));
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
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

export default EditAppointmentScreen;
