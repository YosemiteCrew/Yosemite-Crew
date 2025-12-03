import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeArea} from '@/shared/components/common';
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

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const EditAppointmentScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId} = route.params as {appointmentId: string};
  const {handleOpenTerms, handleOpenPrivacy} = useNavigateToLegalPages();
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
  const buildLocalSlotLabel = (dateStr: string, start?: string | null, end?: string | null) => {
    return formatTimeRange(dateStr, start, end);
  };
  const initialTimeLabel = (() => {
    if (!apt?.time) {
      return null;
    }
    return buildLocalSlotLabel(apt.date, apt.time, apt.endTime);
  })();
  const [time, setTime] = useState<string | null>(initialTimeLabel);
  const type = apt?.type || 'General Checkup';
  const [concern, setConcern] = useState(apt?.concern || '');
  const [emergency, setEmergency] = useState(apt?.emergency || false);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const googlePlacesId = business?.googlePlacesId ?? apt?.businessGooglePlacesId ?? null;
  const businessPhoto = business?.photo ?? apt?.businessPhoto ?? null;
  const linkStyle = {
    ...theme.typography.paragraphBold,
    color: theme.colors.primary,
  };

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
  const isReschedule = true;

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
  }, [businessPhoto, dispatch, fallbackPhoto, googlePlacesId]);

  if (!apt) return null;

  const handleSubmit = async () => {
    if (!time) {
      navigation.goBack();
      return;
    }
    const slotWindow = findSlotByLabel(availability, date, time);
    const {startTime, endTime} = parseSlotLabel(time);
    const startIso =
      slotWindow?.startTimeUtc ??
      new Date(`${date}T${(startTime ?? time).padEnd(5, ':00')}Z`).toISOString();
    const endIso =
      slotWindow?.endTimeUtc ??
      new Date(`${date}T${(endTime ?? startTime ?? time).padEnd(5, ':00')}Z`).toISOString();
    setSaving(true);
    try {
      await dispatch(
        rescheduleAppointment({
          appointmentId,
          startTime: startIso,
          endTime: endIso,
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

  return (
    <SafeArea>
      <Header
        title="Reschedule Appointment"
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
            title: business?.name ?? apt?.organisationName ?? '',
            subtitlePrimary: business?.address ?? apt?.organisationAddress ?? undefined,
            subtitleSecondary: business?.description ?? undefined,
            image: fallbackPhoto || (isDummyPhoto(businessPhoto) ? undefined : businessPhoto),
            interactive: false,
            maxTitleLines: 2,
            maxSubtitleLines: 2,
            avatarSize: 96,
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
          showAttachments={false}
          agreements={[
            {
              id: 'business-terms',
              value: true,
              label: (
                <Text>
                  I agree to {(business?.name ?? apt?.organisationName ?? 'this clinic')}'s{' '}
                  <Text style={linkStyle} onPress={handleOpenTerms}>
                    terms and conditions
                  </Text>
                  , and{' '}
                  <Text style={linkStyle} onPress={handleOpenPrivacy}>
                    privacy policy
                  </Text>
                  . I consent to the sharing of my companion's health information with{' '}
                  {business?.name ?? apt?.organisationName ?? 'this clinic'} for the purpose of assessment.
                </Text>
              ),
            },
            {
              id: 'app-terms',
              value: true,
              label: (
                <Text>
                  I agree to Yosemite Crew's{' '}
                  <Text style={linkStyle} onPress={handleOpenTerms}>
                    terms and conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={linkStyle} onPress={handleOpenPrivacy}>
                    privacy policy
                  </Text>
                </Text>
              ),
            },
          ]}
          actions={
            <LiquidGlassButton
              title={isReschedule ? 'Submit reschedule request' : 'Save changes'}
              onPress={handleSubmit}
              height={56}
              borderRadius={16}
              disabled={isReschedule && (!time || appointmentsLoading || saving)}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.confirmPrimaryButtonText}
            />
          }
        />
      </ScrollView>

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
