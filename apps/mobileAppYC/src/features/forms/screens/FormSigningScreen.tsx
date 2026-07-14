import React, {useCallback, useMemo, useState} from 'react';
import {View, ActivityIndicator, Text, StyleSheet, Linking} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  useIsFocused,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {RootState, AppDispatch} from '@/app/store';
import {
  fetchAppointmentForms,
  selectFormsForAppointment,
} from '@/features/forms';
import {useTheme} from '@/hooks';
import type {Appointment} from '@/features/appointments/types';

type Route = RouteProp<AppointmentStackParamList, 'FormSigning'>;
type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const FormSigningScreen: React.FC = () => {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {appointmentId, submissionId, signingUrl, formTitle} = route.params;
  const openedRef = React.useRef(false);
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);

  const appointment: Appointment | undefined = useSelector((state: RootState) =>
    state.appointments.items.find(a => a.id === appointmentId),
  );
  const forms = useSelector((state: RootState) =>
    selectFormsForAppointment(state, appointmentId),
  );
  const currentEntry = React.useMemo(
    () => forms.find(entry => entry.submission?._id === submissionId),
    [forms, submissionId],
  );

  useFocusEffect(
    useCallback(() => {
      if (appointment) {
        dispatch(
          fetchAppointmentForms({
            appointmentId,
            serviceId: appointment.serviceId ?? null,
            organisationId: appointment.businessId ?? null,
            species: appointment.species ?? null,
          }),
        ).catch(() => {});
      }
    }, [appointment, appointmentId, dispatch]),
  );

  React.useEffect(() => {
    if (!isFocused) return;
    if (appointment) {
      dispatch(
        fetchAppointmentForms({
          appointmentId,
          serviceId: appointment.serviceId ?? null,
          organisationId: appointment.businessId ?? null,
          species: appointment.species ?? null,
        }),
      ).catch(() => {});
    }
  }, [appointment, appointmentId, dispatch, isFocused]);

  React.useEffect(() => {
    if (
      currentEntry?.status === 'signed' ||
      currentEntry?.status === 'completed'
    ) {
      navigation.goBack();
    }
  }, [currentEntry?.status, navigation]);

  React.useEffect(() => {
    if (!signingUrl || openedRef.current) {
      return;
    }
    openedRef.current = true;
    Linking.openURL(signingUrl)
      .then(() => {
        setHasOpenedOnce(true);
        setOpenFailed(false);
      })
      .catch(() => {
        openedRef.current = false;
        setHasOpenedOnce(false);
        setOpenFailed(true);
      });
  }, [signingUrl]);

  const handleRefresh = useCallback(() => {
    if (!appointment) return;
    setRefreshing(true);
    dispatch(
      fetchAppointmentForms({
        appointmentId,
        serviceId: appointment.serviceId ?? null,
        organisationId: appointment.businessId ?? null,
        species: appointment.species ?? null,
      }),
    )
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [appointment, appointmentId, dispatch]);

  const handleReopenLink = useCallback(() => {
    if (!signingUrl) return;
    Linking.openURL(signingUrl)
      .then(() => {
        setHasOpenedOnce(true);
        setOpenFailed(false);
      })
      .catch(() => setOpenFailed(true));
  }, [signingUrl]);

  const formName = currentEntry?.form?.name ?? formTitle ?? 'Sign form';
  const formDescription = currentEntry?.form?.description ?? null;

  const renderSummaryCard = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIconTile}>
        <Ionicons
          name="create-outline"
          size={20}
          color={theme.colors.blueText}
        />
      </View>
      <View style={styles.summaryText}>
        <Text style={styles.summaryTitle} numberOfLines={2}>
          {formName}
        </Text>
        {formDescription ? (
          <Text style={styles.summaryMeta} numberOfLines={2}>
            {formDescription}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderInfoBanner = (icon: string, message: string) => (
    <View style={styles.infoBanner}>
      <Ionicons
        name={icon}
        size={16}
        color={theme.colors.blueText}
        style={styles.leadingIcon}
      />
      <Text style={styles.infoText}>{message}</Text>
    </View>
  );

  const buildStateContent = () => {
    if (!signingUrl) {
      return {
        body: (
          <View style={styles.noteChip}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={theme.colors.inkFaint}
              style={styles.leadingIcon}
            />
            <Text style={styles.noteText}>
              Signing link is not available yet. Please try again from the
              appointment.
            </Text>
          </View>
        ),
        actions: null as React.ReactNode,
        footnote: null as React.ReactNode,
      };
    }

    if (openFailed) {
      return {
        body: renderInfoBanner(
          'warning-outline',
          "We couldn't open the signing link automatically. Tap below to open it in your browser.",
        ),
        actions: (
          <View style={styles.actionBar}>
            <LiquidGlassButton
              title="Open signing link"
              onPress={handleReopenLink}
              height={56}
              borderRadius={theme.borderRadius.button}
              tintColor={theme.colors.cta}
              shadowIntensity="medium"
              textStyle={styles.ctaText}
              leftIcon={
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={theme.colors.ctaText}
                />
              }
            />
          </View>
        ),
        footnote: null as React.ReactNode,
      };
    }

    if (!hasOpenedOnce && !refreshing) {
      return {
        body: (
          <>
            <View style={styles.pendingBlock}>
              <ActivityIndicator color={theme.colors.blueText} />
            </View>
            {renderInfoBanner(
              'open-outline',
              'We opened the signing link in your browser. Complete signing, then return here to refresh the status.',
            )}
          </>
        ),
        actions: null as React.ReactNode,
        footnote: null as React.ReactNode,
      };
    }

    return {
      body: renderInfoBanner(
        'shield-checkmark-outline',
        'Complete signing in your browser. When you come back, tap Refresh status to update this screen.',
      ),
      actions: (
        <View style={styles.actionBar}>
          <LiquidGlassButton
            title="Refresh status"
            onPress={handleRefresh}
            height={56}
            borderRadius={theme.borderRadius.button}
            tintColor={theme.colors.cta}
            shadowIntensity="medium"
            loading={refreshing}
            disabled={refreshing}
            textStyle={styles.ctaText}
            leftIcon={
              <Ionicons name="refresh" size={18} color={theme.colors.ctaText} />
            }
          />
          <LiquidGlassButton
            title="Open signing link again"
            onPress={handleReopenLink}
            height={54}
            borderRadius={theme.borderRadius.button}
            glassEffect="clear"
            tintColor={theme.colors.transparent}
            borderColor={theme.colors.divider}
            shadowIntensity="none"
            textStyle={styles.secondaryText}
            leftIcon={
              <Ionicons
                name="open-outline"
                size={17}
                color={theme.colors.inkBody}
              />
            }
          />
        </View>
      ),
      footnote: (
        <Text style={styles.footnote}>
          Once signed, a copy is saved to your Documents and shared with the
          clinic.
        </Text>
      ),
    };
  };

  const {body, actions, footnote} = buildStateContent();

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Review & sign"
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <View style={[styles.container, contentPaddingStyle]}>
          <View style={styles.body}>
            {renderSummaryCard()}
            {body}
          </View>
          {actions}
          {footnote ? (
            <View style={styles.footnoteWrap}>{footnote}</View>
          ) : null}
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['6'],
    },
    body: {
      flex: 1,
      paddingTop: theme.spacing['4'],
      gap: theme.spacing['3.5'],
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing['3'],
      backgroundColor: theme.colors.screen,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      borderRadius: theme.borderRadius.cardSmall,
      padding: theme.spacing['3.5'],
    },
    summaryIconTile: {
      width: 42,
      height: 42,
      borderRadius: theme.borderRadius.field,
      backgroundColor: theme.colors.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryText: {
      flex: 1,
      gap: theme.spacing['1'],
    },
    summaryTitle: {
      ...theme.typography.pillSubtitleBold15,
      lineHeight: 20,
      color: theme.colors.inkBody,
    },
    summaryMeta: {
      ...theme.typography.body13,
      color: theme.colors.inkFaint,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2.5'],
      backgroundColor: theme.colors.blueSoft,
      borderRadius: theme.borderRadius.field,
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
    },
    infoText: {
      ...theme.typography.body13,
      color: theme.colors.navActive,
      flex: 1,
    },
    noteChip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing['2.5'],
      backgroundColor: theme.colors.inset,
      borderRadius: theme.borderRadius.field,
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['4'],
    },
    noteText: {
      ...theme.typography.caption,
      lineHeight: 17,
      color: theme.colors.inkFaint,
      flex: 1,
    },
    leadingIcon: {
      marginTop: 1,
    },
    pendingBlock: {
      alignItems: 'center',
      paddingVertical: theme.spacing['4'],
    },
    actionBar: {
      gap: theme.spacing['2.5'],
      paddingTop: theme.spacing['3'],
    },
    ctaText: {
      ...theme.typography.button,
      color: theme.colors.ctaText,
    },
    secondaryText: {
      ...theme.typography.button,
      color: theme.colors.inkBody,
    },
    footnoteWrap: {
      paddingTop: theme.spacing['3.5'],
      alignItems: 'center',
    },
    footnote: {
      ...theme.typography.caption,
      color: theme.colors.inkFaint2,
      textAlign: 'center',
    },
  });

export default FormSigningScreen;
