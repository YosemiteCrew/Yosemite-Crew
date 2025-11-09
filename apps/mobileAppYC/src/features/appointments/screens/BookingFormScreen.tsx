import React, {useMemo, useState, useCallback} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme, useFormBottomSheets, useFileOperations} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {selectAvailabilityFor, selectServiceById} from '@/features/appointments/selectors';
import {createAppointment, upsertInvoice} from '@/features/appointments/appointmentsSlice';
import InfoBottomSheet, {type InfoBottomSheetRef} from '@/features/appointments/components/InfoBottomSheet/InfoBottomSheet';
import {UploadDocumentBottomSheet} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent';
import {
  useNavigation,
  useRoute,
  type RouteProp,
  type NavigationProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
} from '@/features/appointments/utils/availability';
import {formatDateToISODate, parseISODate} from '@/shared/utils/dateHelpers';
import {Images} from '@/assets/images';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type Route = RouteProp<AppointmentStackParamList, 'BookingForm'>;

export const BookingFormScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {
    businessId,
    serviceId,
    serviceName: presetServiceName,
    serviceSpecialty,
    employeeId: presetEmployeeId,
    appointmentType,
    otContext,
  } = route.params;
  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const selectedService = useSelector(selectServiceById(serviceId ?? null));
  const availabilitySelector = React.useMemo(
    () =>
      selectAvailabilityFor(businessId, {
        serviceId: selectedService?.id ?? serviceId,
        employeeId: selectedService?.defaultEmployeeId ?? presetEmployeeId ?? null,
      }),
    [businessId, presetEmployeeId, selectedService?.defaultEmployeeId, selectedService?.id, serviceId],
  );
  const availability = useSelector(availabilitySelector);
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === businessId));
  const bookedSheetRef = React.useRef<InfoBottomSheetRef>(null);

  const todayISO = useMemo(() => formatDateToISODate(new Date()), []);
  const firstAvailableDate = useMemo(
    () => getFirstAvailableDate(availability, todayISO),
    [availability, todayISO],
  );
  const [date, setDate] = useState<string>(firstAvailableDate);
  const [dateObj, setDateObj] = useState<Date>(parseISODate(firstAvailableDate));
  const [time, setTime] = useState<string | null>(null);
  const presetServiceLabel = useMemo(() => {
    if (otContext) {
      return selectedService?.name ?? presetServiceName ?? 'Observational Tool';
    }
    return selectedService?.name ?? presetServiceName ?? null;
  }, [otContext, presetServiceName, selectedService?.name]);

  const presetSpecialtyLabel = useMemo(() => {
    if (serviceSpecialty) {
      return serviceSpecialty;
    }
    if (selectedService?.specialty) {
      return selectedService.specialty;
    }
    if (appointmentType) {
      return appointmentType;
    }
    if (otContext) {
      return 'Observational Tool';
    }
    return null;
  }, [appointmentType, otContext, selectedService?.specialty, serviceSpecialty]);

  const [type, setType] = useState<string>(presetSpecialtyLabel ?? 'General Checkup');
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

  const typeLocked = Boolean(presetSpecialtyLabel);
  React.useEffect(() => {
    if (presetSpecialtyLabel && type !== presetSpecialtyLabel) {
      setType(presetSpecialtyLabel);
    }
  }, [presetSpecialtyLabel, type]);
  React.useEffect(() => {
    if (type !== 'Emergency' && emergency) {
      setEmergency(false);
    }
  }, [type, emergency]);

  const selectedServiceName = (selectedService?.name ?? presetServiceName ?? presetServiceLabel ?? '')?.trim() || null;
  const valid = !!(selectedCompanionId && date && time && agreeApp && agreeBusiness && selectedServiceName);

  const handleBook = async () => {
    if (!valid || !time || !selectedCompanionId || !selectedServiceName) {
      return;
    }
    const action = await dispatch(createAppointment({
      companionId: selectedCompanionId,
      businessId,
      serviceId: selectedService?.id ?? serviceId ?? (otContext ? otContext.toolId : null),
      serviceName: selectedServiceName,
      employeeId: null,
      date,
      time,
      type,
      concern,
      emergency,
    }));
    if (createAppointment.fulfilled.match(action)) {
      const created = action.payload;

      if (otContext) {
        const companion = companions.find(c => c.id === created.companionId);
        const evaluationFee = otContext.provider.evaluationFee;
        const appointmentFee = otContext.provider.appointmentFee;
        const subtotal = evaluationFee + appointmentFee;
        dispatch(
          upsertInvoice({
            id: `inv_${created.id}`,
            appointmentId: created.id,
            items: [
              {
                description: `${otContext.provider.businessId === businessId ? 'Observation tool evaluation' : 'Evaluation fee'}`,
                rate: evaluationFee,
                lineTotal: evaluationFee,
                qty: 1,
              },
              {
                description: 'Clinic appointment fee',
                rate: appointmentFee,
                lineTotal: appointmentFee,
                qty: 1,
              },
            ],
            subtotal,
            total: subtotal,
            invoiceNumber: `OBS-${created.id.slice(-6).toUpperCase()}`,
            invoiceDate: new Date().toISOString(),
            billedToName: companion ? `${companion.name}'s guardian` : undefined,
            image: Images.sampleInvoice,
          }),
        );
      }

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
          serviceCard={
            selectedServiceName
              ? {
                  title: selectedService?.name ?? selectedServiceName,
                  subtitlePrimary:
                    selectedService?.description ??
                    (otContext ? 'Observational tool assessment' : undefined),
                  subtitleSecondary: undefined,
                  badgeText: selectedService?.basePrice ? `$${selectedService.basePrice}` : null,
                  image: undefined,
                  showAvatar: false,
                  onEdit: otContext ? undefined : () => navigation.goBack(),
                  interactive: !otContext,
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
              textStyle={styles.confirmPrimaryButtonText}
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
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

export default BookingFormScreen;
