import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {CancelAppointmentBottomSheet, type CancelAppointmentBottomSheetRef} from '@/features/appointments/components/CancelAppointmentBottomSheet';
import {AppointmentFormContent} from '@/features/appointments/components/AppointmentFormContent';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import type {RootState, AppDispatch} from '@/app/store';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {selectAvailabilityFor, selectServiceById} from '@/features/appointments/selectors';
import {cancelAppointment, rescheduleAppointment} from '@/features/appointments/appointmentsSlice';
import {
  getFirstAvailableDate,
  getFutureAvailabilityMarkers,
  getSlotsForDate,
  findSlotByLabel,
  parseSlotLabel,
} from '@/features/appointments/utils/availability';
import {formatTimeRange} from '@/features/appointments/utils/timeFormatting';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';
import {fetchServiceSlots} from '@/features/appointments/businessesSlice';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import {useNavigateToLegalPages} from '@/shared/hooks/useNavigateToLegalPages';
import {useOrganisationDocumentNavigation} from '@/shared/hooks/useOrganisationDocumentNavigation';
import {resolveCurrencySymbol} from '@/shared/utils/currency';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

const isAppointmentCancellable = (status?: string | null) => {
  return status !== 'NO_PAYMENT' && status !== 'AWAITING_PAYMENT' && status !== 'PAYMENT_FAILED';
};

const getInitialTimeLabel = (apt?: {
  time?: string | null;
  date?: string | null;
  endTime?: string | null;
}) => {
  if (!apt?.time || !apt?.date) {
    return null;
  }
  return formatTimeRange(apt.date, apt.time, apt.endTime);
};

const getRescheduleIsoTimes = (
  availability: any,
  selectedDate: string,
  selectedTime: string | null,
) => {
  if (!selectedTime) return null;
  const slotWindow = findSlotByLabel(availability, selectedDate, selectedTime);
  const {startTime, endTime} = parseSlotLabel(selectedTime);
  const resolvedStart = (startTime ?? selectedTime).padEnd(5, ':00');
  const resolvedEnd = (endTime ?? startTime ?? selectedTime).padEnd(5, ':00');
  return {
    startIso: slotWindow?.startTimeUtc ?? new Date(`${selectedDate}T${resolvedStart}Z`).toISOString(),
    endIso: slotWindow?.endTimeUtc ?? new Date(`${selectedDate}T${resolvedEnd}Z`).toISOString(),
  };
};

const useFetchServiceSlots = ({
  dispatch,
  businessId,
  serviceId,
  date,
}: {
  dispatch: AppDispatch;
  businessId?: string | null;
  serviceId?: string | null;
  date?: string | null;
}) => {
  useEffect(() => {
    if (!businessId || !serviceId || !date) {
      return;
    }
    dispatch(
      fetchServiceSlots({
        businessId,
        serviceId,
        date,
      }),
    );
  }, [businessId, serviceId, date, dispatch]);
};

const useBusinessPhotoFallback = ({
  googlePlacesId,
  businessPhoto,
  fallbackPhoto,
  setFallbackPhoto,
  dispatch,
}: {
  googlePlacesId: string | null;
  businessPhoto: string | null;
  fallbackPhoto: string | null;
  setFallbackPhoto: React.Dispatch<React.SetStateAction<string | null>>;
  dispatch: AppDispatch;
}) => {
  useEffect(() => {
    if (!googlePlacesId) return;
    const needsPhoto = (!businessPhoto || isDummyPhoto(businessPhoto)) && !fallbackPhoto;
    if (!needsPhoto) return;
    dispatch(fetchBusinessDetails(googlePlacesId))
      .unwrap()
      .then(res => {
        if (res.photoUrl) setFallbackPhoto(res.photoUrl);
      })
      .catch(() => {
        dispatch(fetchGooglePlacesImage(googlePlacesId))
          .unwrap()
          .then(img => {
            if (img.photoUrl) setFallbackPhoto(img.photoUrl);
          })
          .catch(() => {});
      });
  }, [businessPhoto, dispatch, fallbackPhoto, googlePlacesId, setFallbackPhoto]);
};

const useAppointmentSlots = ({
  availability,
  date,
  time,
  todayISO,
}: {
  availability: any;
  date: string;
  time: string | null;
  todayISO: string;
}) => {
  return useMemo(() => {
    const available = getSlotsForDate(availability, date, todayISO);
    if (available.length === 0 && time) {
      return [time];
    }
    return available;
  }, [availability, date, time, todayISO]);
};

const useFutureDateMarkers = (availability: any, todayISO: string) => {
  return useMemo(() => getFutureAvailabilityMarkers(availability, todayISO), [availability, todayISO]);
};

const buildBusinessCard = ({
  business,
  apt,
  fallbackPhoto,
  businessPhoto,
}: {
  business: any;
  apt: any;
  fallbackPhoto: string | null;
  businessPhoto: string | null;
}) => ({
  title: business?.name ?? apt?.organisationName ?? '',
  subtitlePrimary: business?.address ?? apt?.organisationAddress ?? undefined,
  subtitleSecondary: business?.description ?? undefined,
  image: fallbackPhoto || (isDummyPhoto(businessPhoto) ? undefined : businessPhoto),
  interactive: false,
  maxTitleLines: 2,
  maxSubtitleLines: 2,
  avatarSize: 96,
});

const buildServiceCard = (service: any, apt: any) => {
  if (!service && !apt?.serviceName) {
    return undefined;
  }
  return {
    title: service?.name ?? apt?.serviceName ?? 'Requested service',
    subtitlePrimary: service?.description,
    subtitleSecondary: undefined,
    badgeText: service?.basePrice
      ? `${resolveCurrencySymbol(service?.currency ?? 'USD')}${service.basePrice}`
      : null,
    image: undefined,
    showAvatar: false,
    interactive: false,
  };
};

const buildEmployeeCard = (employee: any, onEdit: () => void) => {
  if (!employee) {
    return undefined;
  }
  return {
    title: employee.name,
    subtitlePrimary: employee.specialization,
    subtitleSecondary: employee.title,
    image: employee.avatar,
    onEdit,
  };
};

const buildAgreements = ({
  businessDisplayName,
  linkStyle,
  openBusinessTerms,
  openBusinessPrivacy,
  openBusinessCancellation,
  handleOpenAppTerms,
  handleOpenAppPrivacy,
}: {
  businessDisplayName: string;
  linkStyle: any;
  openBusinessTerms: () => void;
  openBusinessPrivacy: () => void;
  openBusinessCancellation: () => void;
  handleOpenAppTerms: () => void;
  handleOpenAppPrivacy: () => void;
}) => [
  {
    id: 'business-terms',
    value: true,
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
        . I consent to the sharing of my companion's health information with {businessDisplayName} for the purpose of assessment.
      </Text>
    ),
  },
  {
    id: 'app-terms',
    value: true,
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
  },
];

const getRescheduleButtonLabel = () => 'Submit reschedule request';

const getRescheduleButtonState = ({
  time,
  appointmentsLoading,
  saving,
}: {
  time: string | null;
  appointmentsLoading: boolean;
  saving: boolean;
}) => {
  const disabled = !time || appointmentsLoading || saving;
  const loading = appointmentsLoading || saving;
  return {disabled, loading};
};

export const EditAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId} = route.params as {appointmentId: string};
  const {handleOpenTerms: handleOpenAppTerms, handleOpenPrivacy: handleOpenAppPrivacy} = useNavigateToLegalPages();
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
  const {
    openTerms: openBusinessTerms,
    openPrivacy: openBusinessPrivacy,
    openCancellation: openBusinessCancellation,
  } = useOrganisationDocumentNavigation({
    organisationId: apt?.businessId ?? business?.id,
    organisationName: business?.name ?? apt?.organisationName ?? undefined,
  });

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const firstAvailableDate = useMemo(
    () => getFirstAvailableDate(availability, todayISO, apt?.date),
    [availability, todayISO, apt?.date],
  );
  const [date, setDate] = useState<string>(apt?.date ?? firstAvailableDate);
  const [dateObj, setDateObj] = useState<Date>(new Date(apt?.date ?? firstAvailableDate));
  const initialTimeLabel = getInitialTimeLabel(apt);
  const [time, setTime] = useState<string | null>(initialTimeLabel);
  const type = apt?.type || 'General Checkup';
  const [concern, setConcern] = useState(apt?.concern || '');
  const [emergency, setEmergency] = useState(apt?.emergency || false);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const businessDisplayName = business?.name ?? apt?.organisationName ?? 'this clinic';

  useFetchServiceSlots({
    dispatch,
    businessId: apt?.businessId,
    serviceId: apt?.serviceId,
    date,
  });

  const cancelSheetRef = React.useRef<CancelAppointmentBottomSheetRef>(null);

  const slots = useAppointmentSlots({
    availability,
    date,
    time,
    todayISO,
  });

  const futureDateMarkers = useFutureDateMarkers(availability, todayISO);

  useBusinessPhotoFallback({
    googlePlacesId,
    businessPhoto,
    fallbackPhoto,
    setFallbackPhoto,
    dispatch,
  });

  const handleSubmit = async () => {
    const isoTimes = getRescheduleIsoTimes(availability, date, time);
    if (!isoTimes) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        rescheduleAppointment({
          appointmentId,
          startTime: isoTimes.startIso,
          endTime: isoTimes.endIso,
          isEmergency: emergency,
          concern,
        }),
      ).unwrap();
      navigation.goBack();
    } catch (error) {
      console.warn('[EditAppointment] Failed to reschedule', error);
    } finally {
      setSaving(false);
    }
  };

  const isCancellable = isAppointmentCancellable(apt?.status);
  const businessCard = useMemo(
    () =>
      buildBusinessCard({
        business,
        apt,
        fallbackPhoto,
        businessPhoto,
      }),
    [apt, business, businessPhoto, fallbackPhoto],
  );
  const serviceCard = useMemo(() => buildServiceCard(service, apt), [apt, service]);
  const employeeCard = useMemo(
    () => buildEmployeeCard(employee, () => navigation.goBack()),
    [employee, navigation],
  );
  const agreements = useMemo(() => {
    const linkStyle = {
      ...theme.typography.paragraphBold,
      color: theme.colors.primary,
    };
    return buildAgreements({
      businessDisplayName,
      linkStyle,
      openBusinessTerms,
      openBusinessPrivacy,
      openBusinessCancellation,
      handleOpenAppTerms,
      handleOpenAppPrivacy,
    });
  }, [
    businessDisplayName,
    handleOpenAppPrivacy,
    handleOpenAppTerms,
    openBusinessCancellation,
    openBusinessPrivacy,
    openBusinessTerms,
    theme.typography.paragraphBold,
    theme.colors.primary,
  ]);
  const submitLabel = getRescheduleButtonLabel();
  const submitState = getRescheduleButtonState({
    time,
    appointmentsLoading,
    saving,
  });

  if (!apt) return null;

  return (
    <>
      <LiquidGlassHeaderScreen
        header={
          <Header
            title="Reschedule"
            showBackButton
            onBack={() => navigation.goBack()}
            rightIcon={isCancellable ? Images.deleteIcon : undefined}
            onRightPress={isCancellable ? () => cancelSheetRef.current?.open?.() : undefined}
            glass={false}
          />
        }
        cardGap={theme.spacing['3']}
        contentPadding={theme.spacing['1']}>
        {contentPaddingStyle => (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.container,
              contentPaddingStyle,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <AppointmentFormContent
              businessCard={businessCard}
              serviceCard={serviceCard}
              employeeCard={employeeCard}
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
              showAttachments={false}
              agreements={agreements}
              actions={
                <LiquidGlassButton
                  title={submitLabel}
                  onPress={handleSubmit}
                  height={56}
                  borderRadius={16}
                  disabled={submitState.disabled}
                  loading={submitState.loading}
                  tintColor={theme.colors.secondary}
                  shadowIntensity="medium"
                  textStyle={styles.confirmPrimaryButtonText}
                />
              }
            />
          </ScrollView>
        )}
      </LiquidGlassHeaderScreen>
      <CancelAppointmentBottomSheet
        ref={cancelSheetRef}
        onConfirm={() => {
          dispatch(cancelAppointment({appointmentId}));
          navigation.goBack();
        }}
      />
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      paddingHorizontal: theme.spacing['6'],
      paddingBottom: theme.spacing['24'],
      gap: theme.spacing['4'],
    },
    confirmPrimaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
  });

export default EditAppointmentScreen;
