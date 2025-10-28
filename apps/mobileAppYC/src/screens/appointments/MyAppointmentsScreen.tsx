import React, {useEffect} from 'react';
import {SectionList, View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {CompanionSelector} from '@/components/common/CompanionSelector/CompanionSelector';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {AppointmentCard} from '@/components/common/AppointmentCard/AppointmentCard';
import {LiquidGlassCard} from '@/components/common/LiquidGlassCard/LiquidGlassCard';
import {Images} from '@/assets/images';
import {useTheme} from '@/hooks';
import type {RootState, AppDispatch} from '@/app/store';
import {fetchAppointmentsForCompanion, updateAppointmentStatus} from '@/features/appointments/appointmentsSlice';
import {setSelectedCompanion} from '@/features/companion';
import {createSelectUpcomingAppointments, createSelectPastAppointments} from '@/features/appointments/selectors';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {openMapsToAddress} from '@/utils/openMaps';
import {RootState as RS} from '@/app/store';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type BusinessFilter = 'all' | 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder';

export const MyAppointmentsScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<Nav>();
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const companions = useSelector((s: RootState) => s.companion.companions);
  const selectedCompanionId = useSelector((s: RootState) => s.companion.selectedCompanionId);
  const hasHydrated = useSelector((s: RootState) => selectedCompanionId ? s.appointments.hydratedCompanions[selectedCompanionId] : false);

  const upcomingSelector = React.useMemo(() => createSelectUpcomingAppointments(), []);
  const pastSelector = React.useMemo(() => createSelectPastAppointments(), []);
  const upcoming = useSelector((state: RootState) => upcomingSelector(state, selectedCompanionId ?? null));
  const past = useSelector((state: RootState) => pastSelector(state, selectedCompanionId ?? null));
  const businesses = useSelector((s: RS) => s.businesses.businesses);
  const employees = useSelector((s: RS) => s.businesses.employees);
  const [filter, setFilter] = React.useState<BusinessFilter>('all');

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useEffect(() => {
    if (selectedCompanionId && !hasHydrated) {
      dispatch(fetchAppointmentsForCompanion({companionId: selectedCompanionId}));
    }
  }, [dispatch, selectedCompanionId, hasHydrated]);

  const businessMap = React.useMemo(() => new Map(businesses.map(b => [b.id, b])), [businesses]);
  const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  const formatDate = React.useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [],
  );

  const filteredUpcoming = React.useMemo(() => {
    return upcoming.filter(apt => {
      if (filter === 'all') return true;
      const biz = businessMap.get(apt.businessId);
      return biz?.category === filter;
    });
  }, [upcoming, filter, businessMap]);

  const filteredPast = React.useMemo(() => {
    return past.filter(apt => {
      if (filter === 'all') return true;
      const biz = businessMap.get(apt.businessId);
      return biz?.category === filter;
    });
  }, [past, filter, businessMap]);

  const renderEmptyCard = (title: string, subtitle: string) => (
    <LiquidGlassCard
      key={`${title}-empty`}
      glassEffect="clear"
      interactive
      shadow='none'
      style={styles.infoTile}
      fallbackStyle={styles.tileFallback}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </LiquidGlassCard>
  );

  const handleAdd = () => navigation.navigate('BrowseBusinesses');

  const handleApprove = (appointmentId: string, companionId: string) => {
    dispatch(updateAppointmentStatus({appointmentId, status: 'approved'}));
    navigation.navigate('PaymentInvoice', {appointmentId, companionId});
  };

  const sections = React.useMemo(
    () => [
      {key: 'upcoming', title: 'Upcoming', data: filteredUpcoming},
      {key: 'past', title: 'Past', data: filteredPast},
    ],
    [filteredUpcoming, filteredPast],
  );

  const renderSectionHeader = ({section}: {section: {key: string; title: string; data: typeof filteredUpcoming}}) => (
    <View style={styles.sectionHeaderWrapper}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.data.length === 0 &&
        (section.key === 'upcoming'
          ? renderEmptyCard('No upcoming appointments', 'Book a new appointment to see it here.')
          : renderEmptyCard('No past appointments', 'Completed appointments will appear here.'))}
    </View>
  );

  const renderItem = ({item, section}: {item: (typeof filteredUpcoming)[number]; section: {key: string}}) => {
    if (!item) {
      return null;
    }
    const emp = employeeMap.get(item.employeeId);
    const biz = businessMap.get(item.businessId);
    const formattedDate = formatDate(item.date);
    if (section.key === 'upcoming') {
      let footer: React.ReactNode;

      if (item.status === 'requested') {
        footer = (
          <View style={styles.upcomingFooter}>
            <View style={styles.statusBadgePending}>
              <Text style={styles.statusBadgeText}>Pending confirmation</Text>
            </View>
            <LiquidGlassButton
              title="Approve (mock)"
              onPress={() => handleApprove(item.id, item.companionId)}
              height={44}
              borderRadius={12}
              tintColor="rgba(255,255,255,0.95)"
              forceBorder
              borderColor={theme.colors.border}
              textStyle={styles.secondaryActionText}
              shadowIntensity="none"
              style={styles.footerButton}
            />
          </View>
        );
      } else if (item.status === 'approved') {
        footer = (
          <View style={styles.upcomingFooter}>
            <LiquidGlassButton
              title="Pay now"
              onPress={() => navigation.navigate('PaymentInvoice', {appointmentId: item.id, companionId: item.companionId})}
              height={48}
              borderRadius={12}
              tintColor={theme.colors.secondary}
              shadowIntensity="medium"
              textStyle={styles.reviewButtonText}
              style={styles.reviewButtonCard}
            />
          </View>
        );
      }

      return (
        <View style={styles.cardWrapper}>
          <AppointmentCard
            doctorName={emp?.name || 'Doctor'}
            specialization={emp?.specialization || ''}
            hospital={biz?.name || ''}
            dateTime={`${formattedDate} - ${item.time}`}
            avatar={emp?.avatar || Images.cat}
            note={item.status === 'paid' ? 'Note: Check in is only allowed if you arrive 5 minutes early at location.' : undefined}
            showActions={item.status === 'paid'}
            onViewDetails={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
            onGetDirections={() => {
              if (biz?.address) openMapsToAddress(biz.address);
            }}
            onChat={() => navigation.navigate('Chat', {appointmentId: item.id})}
            onCheckIn={() => dispatch(updateAppointmentStatus({appointmentId: item.id, status: 'completed'}))}
            footer={footer}
          />
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <AppointmentCard
          doctorName={emp?.name || 'Doctor'}
          specialization={emp?.specialization || ''}
          hospital={biz?.name || ''}
          dateTime={`${formattedDate} - ${item.time}`}
          avatar={emp?.avatar || Images.cat}
          showActions={false}
          onViewDetails={() => navigation.navigate('ViewAppointment', {appointmentId: item.id})}
          footer={
            <View style={styles.pastFooter}>
              <View style={styles.pastStatusWrapper}>
                <Text style={[styles.pastStatusBadge, item.status === 'canceled' && styles.pastStatusBadgeCanceled]}>
                  {item.status === 'canceled' ? 'Canceled' : 'Completed'}
                </Text>
              </View>
              {item.status !== 'canceled' && (
                <LiquidGlassButton
                  title="Review"
                  onPress={() => navigation.navigate('Review', {appointmentId: item.id})}
                  height={48}
                  borderRadius={12}
                  tintColor={theme.colors.secondary}
                  shadowIntensity="medium"
                  textStyle={styles.reviewButtonText}
                  style={styles.reviewButtonCard}
                />
              )}
            </View>
          }
        />
      </View>
    );
  };

  const keyExtractor = (item: (typeof filteredUpcoming)[number]) => item.id;

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <CompanionSelector
        companions={companions}
        selectedCompanionId={selectedCompanionId}
        onSelect={id => dispatch(setSelectedCompanion(id))}
        showAddButton={false}
        containerStyle={styles.companionSelector}
      />

      <SectionListHorizontalPills filter={filter} setFilter={setFilter} />
    </View>
  );

  const handleEndReached = () => {
    // Placeholder for future pagination when backend is available
    // console.log('Reached end of past appointments');
  };

  return (
    <SafeArea>
      <Header title="My Appointments" showBackButton={false} rightIcon={Images.addIconDark} onRightPress={handleAdd} />
      <SectionList
        style={styles.sectionList}
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.container}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      />
    </SafeArea>
  );
};

const SectionListHorizontalPills = ({
  filter,
  setFilter,
}: {
  filter: BusinessFilter;
  setFilter: (value: BusinessFilter) => void;
}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const filterOptions: Array<{id: BusinessFilter; label: string}> = [
    {id: 'all', label: 'All'},
    {id: 'hospital', label: 'Hospital'},
    {id: 'groomer', label: 'Groomer'},
    {id: 'breeder', label: 'Breeder'},
    {id: 'pet_center', label: 'Pet Center'},
    {id: 'boarder', label: 'Boarder'},
  ];

  return (
    <View style={styles.pillContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContent}>
        {filterOptions.map(option => (
          <TouchableOpacity
            key={option.id}
            onPress={() => setFilter(option.id)}
            activeOpacity={0.8}
            style={[styles.pill, filter === option.id && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === option.id && styles.pillTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    sectionList: {flex: 1},
    container: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      paddingBottom: theme.spacing[10],
    },
    listHeader: {gap: theme.spacing[3], marginBottom: theme.spacing[4]},
    companionSelector: {marginBottom: theme.spacing[2]},
    sectionHeaderWrapper: {marginTop: theme.spacing[4], marginBottom: theme.spacing[2], gap: theme.spacing[2]},
    sectionTitle: {...theme.typography.titleMedium, color: theme.colors.secondary},
    pillContainer: {marginBottom: theme.spacing[1]},
    pillsContent: {gap: 8, paddingRight: 8},
    pill: {
      minWidth: 80,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#302F2E',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pillActive: {backgroundColor: theme.colors.primaryTint, borderColor: theme.colors.primary},
    pillText: {...theme.typography.pillSubtitleBold15, color: '#302F2E'},
    pillTextActive: {color: theme.colors.primary},
    list: {gap: 16},
    cardWrapper: {marginBottom: theme.spacing[4]},
    statusBadgePending: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: theme.colors.primaryTint,
    },
    statusBadgeText: {
      ...theme.typography.body12,
      color: theme.colors.secondary,
    },
    reviewButtonCard: {marginTop: theme.spacing[1]},
    reviewButtonText: {...theme.typography.paragraphBold, color: theme.colors.white},
    upcomingFooter: {
      gap: theme.spacing[2],
      marginTop: theme.spacing[3],
    },
    footerButton: {
      alignSelf: 'flex-start',
    },
    secondaryActionText: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
    },
    pastFooter: {
      gap: theme.spacing[3],
      marginTop: theme.spacing[1],
    },
    pastStatusWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    pastStatusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[2],
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      ...theme.typography.body12,
      color: '#0F5132',
      fontWeight: '600',
    },
    pastStatusBadgeCanceled: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      color: '#991B1B',
    },
    infoTile: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
      padding: theme.spacing[5],
      gap: theme.spacing[2],
      overflow: 'hidden',
    },
    tileFallback: {
      borderRadius: theme.borderRadius.lg,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.cardBackground,
    },
    tileTitle: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    tileSubtitle: {
      ...theme.typography.bodySmallTight,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    bottomSpacer: {height: theme.spacing[16]},
  });

export default MyAppointmentsScreen;
