import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Alert, Text} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {useDocumentUpload} from '@/shared/hooks/useDocumentUpload';
import type {RootState, AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {selectAvailabilityFor, selectServiceById} from '@/features/appointments/selectors';
import {createAppointment} from '@/features/appointments/appointmentsSlice';
import {DocumentUploadSheets} from '@/features/appointments/components/DocumentUploadSheets';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {
  AppointmentStackParamList,
} from '@/navigation/types';
import type {DocumentFile} from '@/features/documents/types';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
  findSlotByLabel,
  parseSlotLabel,
} from '@/features/appointments/utils/availability';
import {formatDateToISODate, parseISODate} from '@/shared/utils/dateHelpers';
import {fetchServiceSlots} from '@/features/appointments/businessesSlice';
import {uploadDocumentFiles} from '@/features/documents/documentSlice';
import {useNavigateToLegalPages} from '@/shared/hooks/useNavigateToLegalPages';
import {useAutoSelectCompanion} from '@/shared/hooks/useAutoSelectCompanion';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {useOrganisationDocumentNavigation} from '@/shared/hooks/useOrganisationDocumentNavigation';
import {LiquidGlassHeader} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeader';
import {createLiquidGlassHeaderStyles} from '@/shared/utils/screenStyles';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type Route = RouteProp<AppointmentStackParamList, 'BookingForm'>;

export const BookingFormScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [topGlassHeight, setTopGlassHeight] = useState(0);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {
    businessId,
    serviceId,
    serviceName: presetServiceName,
    serviceSpecialty,
    serviceSpecialtyId,
    employeeId: presetEmployeeId,
    appointmentType,
    otContext,
  } = route.params;
  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const selectedService = useSelector(selectServiceById(serviceId ?? null));
  const effectiveServiceId = useMemo(
    () => selectedService?.id ?? serviceId ?? '',
    [selectedService?.id, serviceId],
  );
  const availabilitySelector = React.useMemo(
    () =>
      selectAvailabilityFor(businessId, {
        serviceId: effectiveServiceId,
        employeeId: selectedService?.defaultEmployeeId ?? presetEmployeeId ?? null,
      }),
    [
      businessId,
      presetEmployeeId,
      selectedService?.defaultEmployeeId,
      effectiveServiceId,
    ],
  );
  const availability = useSelector(availabilitySelector);
  const business = useSelector((s: RootState) => s.businesses.businesses.find(b => b.id === businessId));
  const appointmentsLoading = useSelector((s: RootState) => s.appointments.loading);
  const businessDisplayName =
    (business?.name ?? '').trim().length > 0
      ? business?.name
      : 'the clinic';
  const linkStyle = {
    ...theme.typography.paragraphBold,
    color: theme.colors.primary,
  };
  const {handleOpenTerms: handleOpenAppTerms, handleOpenPrivacy: handleOpenAppPrivacy} = useNavigateToLegalPages();
  const {
    openTerms: openBusinessTerms,
    openPrivacy: openBusinessPrivacy,
    openCancellation: openBusinessCancellation,
  } = useOrganisationDocumentNavigation({
    organisationId: business?.id ?? businessId,
    organisationName: business?.name ?? businessDisplayName,
  });
  useAutoSelectCompanion(companions, selectedCompanionId);

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
  const resolveAttachmentName = React.useCallback(
    (file: DocumentFile) => {
      if (file.name && !file.name.startsWith('rn_image_picker_lib_temp')) {
        return file.name;
      }
      if (file.key) {
        const parts = file.key.split('/').filter(Boolean);
        const last = parts.at(-1);
        if (last) {
          return last;
        }
      }
      return file.name || 'attachment';
    },
    [],
  );

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

  React.useEffect(() => {
    if (!effectiveServiceId || !businessId || !date) {
      return;
    }
    dispatch(fetchServiceSlots({businessId, serviceId: effectiveServiceId, date}));
  }, [businessId, dispatch, effectiveServiceId, date]);

  const selectedServiceName =
    (selectedService?.name ?? presetServiceName ?? presetServiceLabel ?? '')?.trim() || null;
  const valid = !!(selectedCompanionId && date && time && agreeApp && agreeBusiness && selectedServiceName);
  const [submitting, setSubmitting] = useState(false);

  const validateBookingInputs = (): boolean => {
    if (valid && time && selectedCompanionId && selectedServiceName) {
      return true;
    }
    const missing: string[] = [];
    if (!selectedCompanionId) missing.push('companion');
    if (!date) missing.push('date');
    if (!time) missing.push('time slot');
    if (!selectedServiceName) missing.push('service');
    if (!agreeBusiness || !agreeApp) missing.push('agreements');
    Alert.alert(
      'Complete booking details',
      `Please select ${missing.join(', ')} to continue.`,
    );
    return false;
  };

  const prepareAttachments = async (companionId: string): Promise<Array<{key: string; name?: string | null; contentType?: string | null}>> => {
    if (!files.length) {
      return [];
    }
    const uploaded = await dispatch(
      uploadDocumentFiles({files, companionId}),
    ).unwrap();
    return uploaded
      .filter(f => f.key)
      .map(f => ({
        key: f.key as string,
        name: resolveAttachmentName(f),
        contentType: f.type ?? null,
      }));
  };

  const handleBook = async () => {
    console.log('[Booking] Attempting to book', {
      selectedCompanionId,
      businessId,
      serviceId,
      date,
      time,
      agreeBusiness,
      agreeApp,
      selectedServiceName,
    });
    if (!validateBookingInputs()) {
      return;
    }
    const resolvedServiceId = effectiveServiceId;
    if (!resolvedServiceId) {
      Alert.alert('Select service', 'Please choose a service before booking.');
      return;
    }
    setSubmitting(true);
    try {
      const slotWindow = findSlotByLabel(availability, date, time);
      const {startTime, endTime} = parseSlotLabel(time);
      const startIsoUtc =
        slotWindow?.startTimeUtc ??
        new Date(`${date}T${(startTime ?? time!).padEnd(5, ':00')}Z`).toISOString();
      const endIsoUtc =
        slotWindow?.endTimeUtc ??
        new Date(`${date}T${(endTime ?? startTime ?? time!).padEnd(5, ':00')}Z`).toISOString();
      const attachments = await prepareAttachments(selectedCompanionId!);

      const action = await dispatch(
        createAppointment({
          companionId: selectedCompanionId!,
          businessId,
          serviceId: resolvedServiceId,
          serviceName: selectedServiceName!,
          specialityId: selectedService?.specialityId ?? serviceSpecialtyId ?? null,
          specialityName: serviceSpecialty ?? selectedService?.specialty ?? type,
          date,
          startTime: slotWindow?.startTimeLocal ?? startTime ?? time!,
          endTime: slotWindow?.endTimeLocal ?? endTime ?? startTime ?? time!,
          startTimeUtc: startIsoUtc,
          endTimeUtc: endIsoUtc,
          concern,
          emergency,
          attachments,
        }),
      );
      if (createAppointment.fulfilled.match(action)) {
        const created = action.payload.appointment;
        navigation.replace('PaymentInvoice', {
          appointmentId: created.id,
          companionId: created.companionId,
          invoice: action.payload.invoice,
          paymentIntent: action.payload.paymentIntent,
        });
      } else {
        const message =
          (action.payload as string) ??
          (action.error?.message ?? 'Unable to book appointment. Please try again.');
        Alert.alert('Booking failed', message);
      }
    } catch (error) {
      console.warn('[Booking] Failed to book appointment', error);
      const message =
        error instanceof Error ? error.message : 'Unable to book appointment. Please try again.';
      Alert.alert('Booking failed', message);
    } finally {
      setSubmitting(false);
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
    <>
      <SafeAreaView style={styles.root} edges={[]}>
        <LiquidGlassHeader
          insetsTop={insets.top}
          currentHeight={topGlassHeight}
          onHeightChange={setTopGlassHeight}
          topSectionStyle={styles.topSection}
          shadowWrapperStyle={styles.topGlassShadowWrapper}
          cardStyle={styles.topGlassCard}
          fallbackStyle={styles.topGlassFallback}>
          <Header title="Book an Appointment" showBackButton onBack={() => navigation.goBack()} glass={false} />
        </LiquidGlassHeader>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            topGlassHeight
              ? {paddingTop: topGlassHeight + theme.spacing['3']}
              : null,
          ]}>
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
                  badgeText: selectedService?.basePrice ? `${resolveCurrencySymbol(selectedService?.currency ?? 'USD')}${selectedService.basePrice}` : null,
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
          resetKey={date}
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
              label: (
                <Text>
                  I agree to {businessDisplayName}'s{' '}
                  <Text style={linkStyle} onPress={openBusinessTerms}>
                    terms and conditions
                  </Text>
                  ,{' '}
                  <Text style={linkStyle} onPress={openBusinessPrivacy}>
                    privacy policy
                  </Text>
                  , and{' '}
                  <Text style={linkStyle} onPress={openBusinessCancellation}>
                    cancellation policy
                  </Text>
                  .
                </Text>
              ),
              onChange: setAgreeBusiness,
            },
            {
              id: 'app-terms',
              value: agreeApp,
              label: (
                <Text>
                  I agree to Yosemite Crew's{' '}
                  <Text style={linkStyle} onPress={handleOpenAppTerms}>
                    terms and conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={linkStyle} onPress={handleOpenAppPrivacy}>
                    privacy policy
                  </Text>
                </Text>
              ),
              onChange: setAgreeApp,
            },
          ]}
          actions={
            <LiquidGlassButton
              title="Book appointment"
              onPress={handleBook}
              height={56}
              borderRadius={16}
              disabled={appointmentsLoading || submitting}
              loading={appointmentsLoading || submitting}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          }
        />

        </ScrollView>
      </SafeAreaView>
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
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    ...createLiquidGlassHeaderStyles(theme),
    container: {
      padding: theme.spacing['4'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['4'],
    },
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

export default BookingFormScreen;
