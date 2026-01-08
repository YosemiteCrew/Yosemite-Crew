import React, {useCallback, useMemo, useState} from 'react';
import {View, ActivityIndicator, Text, StyleSheet, Linking} from 'react-native';
import {useNavigation, useRoute, useFocusEffect, useIsFocused} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {LiquidGlassButton} from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {RootState, AppDispatch} from '@/app/store';
import {fetchAppointmentForms, selectFormsForAppointment} from '@/features/forms';
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

  const appointment: Appointment | undefined = useSelector((state: RootState) =>
    state.appointments.items.find(a => a.id === appointmentId),
  );
  const forms = useSelector((state: RootState) => selectFormsForAppointment(state, appointmentId));
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
    if (currentEntry?.status === 'signed') {
      navigation.goBack();
    }
  }, [currentEntry?.status, navigation]);

  React.useEffect(() => {
    if (!signingUrl || openedRef.current) {
      return;
    }
    openedRef.current = true;
    Linking.openURL(signingUrl)
      .then(() => setHasOpenedOnce(true))
      .catch(() => {
        openedRef.current = false;
        setHasOpenedOnce(false);
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
      .then(() => setHasOpenedOnce(true))
      .catch(() => {});
  }, [signingUrl]);

  const renderContent = () => {
    if (!signingUrl) {
      return (
        <View style={styles.centered}>
          <Text style={styles.message}>
            Signing link is not available yet. Please try again from the appointment.
          </Text>
        </View>
      );
    }

    if (!hasOpenedOnce && !refreshing) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.message}>
            We opened the signing link in your browser. Complete signing, then return here to refresh the status.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        {refreshing ? <ActivityIndicator style={styles.refreshSpinner} /> : null}
        <Text style={styles.message}>
          Complete signing in your browser. When you come back, tap Refresh status to update this screen.
        </Text>
        <View style={styles.buttonGroup}>
          <LiquidGlassButton
            title="Refresh status"
            onPress={handleRefresh}
            height={56}
            borderRadius={theme.borderRadius.lg}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
            loading={refreshing}
            disabled={refreshing}
            textStyle={styles.buttonText}
          />
          <LiquidGlassButton
            title="Open signing link again"
            onPress={handleReopenLink}
            height={56}
            borderRadius={theme.borderRadius.md}
            glassEffect="clear"
            forceBorder
            borderColor={theme.colors.secondary}
            textStyle={styles.secondaryButtonText}
            shadowIntensity="light"
          />
        </View>
      </View>
    );
  };

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title={formTitle ?? 'Sign form'}
          showBackButton
          onBack={() => navigation.goBack()}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <View style={[styles.container, contentPaddingStyle]}>
          <View style={styles.surface}>{renderContent()}</View>
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 300,
      paddingBottom: theme.spacing['6'],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing['4'],
    },
    message: {
      ...theme.typography.body14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    buttonGroup: {
      marginTop: theme.spacing['4'],
      gap: theme.spacing['3'],
      alignSelf: 'stretch',
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.white,
      textAlign: 'center',
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    refreshSpinner: {
      marginBottom: theme.spacing['2'],
    },
    surface: {
      flex: 1,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
      minHeight: 320,
    },
  });

export default FormSigningScreen;
