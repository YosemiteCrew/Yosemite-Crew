import React, {useCallback, useMemo} from 'react';
import {View, ActivityIndicator, Text, StyleSheet} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import WebView from 'react-native-webview';
import {Header} from '@/shared/components/common/Header/Header';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import type {AppointmentStackParamList} from '@/navigation/types';
import type {RootState, AppDispatch} from '@/app/store';
import {fetchAppointmentForms} from '@/features/forms';
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

  const appointment: Appointment | undefined = useSelector((state: RootState) =>
    state.appointments.items.find(a => a.id === appointmentId),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
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
      };
    }, [appointment, appointmentId, dispatch]),
  );

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

    return (
      <WebView
        source={{uri: signingUrl}}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        )}
      />
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
    surface: {
      flex: 1,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      minHeight: 320,
    },
  });

export default FormSigningScreen;
