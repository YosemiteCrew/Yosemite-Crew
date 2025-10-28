import React, {useMemo, useState, useCallback} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {selectAvailabilityFor} from '@/features/appointments/selectors';
import {createAppointment} from '@/features/appointments/appointmentsSlice';
import InfoBottomSheet, {type InfoBottomSheetRef} from '@/components/appointments/InfoBottomSheet/InfoBottomSheet';
import {UploadDocumentBottomSheet} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {AppointmentFormContent} from '@/components/appointments/AppointmentFormContent';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import type {DocumentFile} from '@/types/document.types';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
} from '@/features/appointments/utils/availability';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const BookingFormScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {businessId, employeeId, appointmentType} = route.params as {
    businessId: string;
    employeeId?: string;
    appointmentType?: string;
  };
  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const availability = useSelector(selectAvailabilityFor(businessId, employeeId || 'emp_brown'));
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === businessId));
  const employee = useSelector((s: RootState) => s.businesses.employees.find(e => e.id === (employeeId || 'emp_brown')));
  const bookedSheetRef = React.useRef<InfoBottomSheetRef>(null);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const firstAvailableDate = useMemo(
    () => getFirstAvailableDate(availability, todayISO),
    [availability, todayISO],
  );
  const [date, setDate] = useState<string>(firstAvailableDate);
  const [dateObj, setDateObj] = useState<Date>(new Date(firstAvailableDate));
  const [time, setTime] = useState<string | null>(null);
  const [type, setType] = useState<string>(appointmentType ?? 'General Checkup');
  const [concern, setConcern] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [agreeBusiness, setAgreeBusiness] = useState(false);
  const [agreeApp, setAgreeApp] = useState(false);
  const [files, setFiles] = useState<DocumentFile[]>([]);

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {uploadSheetRef, deleteSheetRef} = refs;

  const resetToMyAppointments = useCallback(() => {
    const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
    tabNavigation?.navigate('Appointments', {screen: 'MyAppointments'} as any);
    navigation.reset({
      index: 0,
      routes: [{name: 'MyAppointments'}],
    });
  }, [navigation]);

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

  const typeLocked = Boolean(appointmentType);
  React.useEffect(() => {
    if (typeLocked && appointmentType && type !== appointmentType) {
      setType(appointmentType);
    }
  }, [typeLocked, appointmentType, type]);
  React.useEffect(() => {
    if (type !== 'Emergency' && emergency) {
      setEmergency(false);
    }
  }, [type, emergency]);

  const valid = !!(selectedCompanionId && date && time && agreeApp && agreeBusiness);

  const handleBook = async () => {
    if (!valid || !time || !selectedCompanionId) {
      return;
    }
    const action = await dispatch(createAppointment({
      companionId: selectedCompanionId,
      businessId,
      employeeId: employeeId || 'emp_brown',
      date,
      time,
      type,
      concern,
      emergency,
    }));
    if ('payload' in action) {
      // Show confirmation bottom sheet, then go to MyAppointments
      bookedSheetRef.current?.expand?.();
      setTimeout(() => {
        bookedSheetRef.current?.close?.();
        resetToMyAppointments();
      }, 1200);
    }
  };

  const slots = useMemo(
    () => getSlotsForDate(availability, date, todayISO),
    [availability, date, todayISO],
  );

  const dateMarkers = useMemo(
    () => getFutureAvailabilityMarkers(availability, todayISO),
    [availability, todayISO],
  );

  const handleUploadDocuments = () => {
    openSheet('upload');
    uploadSheetRef.current?.open();
  };

  return (
    <SafeArea>
      <Header title="Book an Appointment" showBackButton onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <AppointmentFormContent
          businessCard={{
            title: business?.name ?? '',
            subtitlePrimary: business?.address ?? undefined,
            subtitleSecondary: business?.description ?? undefined,
            image: business?.photo,
            onEdit: () => {
              if (navigation.pop) {
                navigation.pop(2);
              } else {
                navigation.goBack();
                navigation.goBack();
              }
            },
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
          selectedCompanionId={selectedCompanionId ?? null}
          onSelectCompanion={id => dispatch(setSelectedCompanion(id))}
          showAddCompanion={false}
          selectedDate={dateObj}
          todayISO={todayISO}
          onDateChange={(nextDate, iso) => {
            setDateObj(nextDate);
            setDate(iso);
            setTime(null);
          }}
          dateMarkers={dateMarkers}
          slots={slots}
          selectedSlot={time}
          onSelectSlot={slot => setTime(slot)}
          emptySlotsMessage="No future slots available. Please pick another date or contact the clinic."
          appointmentType={type}
          allowTypeEdit={!typeLocked}
          onTypeChange={setType}
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
              value: agreeBusiness,
              label: "I agree to the business terms and privacy policy.",
              onChange: setAgreeBusiness,
            },
            {
              id: 'app-terms',
              value: agreeApp,
              label: "I agree to Yosemite Crew's terms and conditions and privacy policy",
              onChange: setAgreeApp,
            },
          ]}
          actions={
            <LiquidGlassButton
              title="Book appointment"
              onPress={handleBook}
              height={56}
              borderRadius={16}
              disabled={!valid}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
            />
          }
        />

      </ScrollView>

      <InfoBottomSheet
        ref={bookedSheetRef}
        title="Appointment booked"
        message="We will notify you once the organisation accepts your request."
        cta="Close"
        onCta={() => bookedSheetRef.current?.close?.()}
      />

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
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing[4],
      paddingBottom: theme.spacing[24],
      gap: theme.spacing[4],
    },
  });

export default BookingFormScreen;
