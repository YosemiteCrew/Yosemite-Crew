import React, {useMemo, useCallback} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {SafeArea} from '@/components/common';
import {Header} from '@/components/common/Header/Header';
import {LiquidGlassButton} from '@/components/common/LiquidGlassButton/LiquidGlassButton';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {NavigationProp} from '@react-navigation/native';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import type {RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const PaymentSuccessScreen: React.FC = () => {
  const dispatch = useDispatch();
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const {appointmentId, companionId} = route.params as {appointmentId: string; companionId?: string};
  const appointment = useSelector((state: RootState) => state.appointments.items.find(a => a.id === appointmentId));
  const resolvedCompanionId = companionId ?? appointment?.companionId ?? null;
  const resetToMyAppointments = useCallback(() => {
    if (resolvedCompanionId) {
      dispatch(setSelectedCompanion(resolvedCompanionId));
    }
    const tabNavigation = navigation.getParent<NavigationProp<TabParamList>>();
    tabNavigation?.navigate('Appointments', {screen: 'MyAppointments'} as any);
    navigation.reset({
      index: 0,
      routes: [{name: 'MyAppointments'}],
    });
  }, [dispatch, navigation, resolvedCompanionId]);

  return (
    <SafeArea>
      <Header title="Successful Payment" showBackButton={false} />
      <View style={styles.container}>
        <Image source={Images.successPayment} style={styles.illustration} />
        <Text style={styles.title}>Thank you</Text>
        <Text style={styles.subtitle}>You have Successfully made Payment</Text>
        <View style={styles.detailsBlock}>
        <Text style={styles.detailsTitle}>Invoice Details</Text>
          <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Invoice number</Text>
            <Text style={styles.detailValue}>BDY024474</Text>
          </View>
          <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Invoice Date</Text>
            <Text style={styles.detailValue}>Aug 15th, 2025</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice</Text>
            <TouchableOpacity>
              <Text style={[styles.detailValue, styles.link]}>Download Invoice 📥</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Appointment date</Text>
            <Text style={styles.detailValue}>September 5th, 2025</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Appointment time</Text>
            <Text style={styles.detailValue}>11:00 AM CET</Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <LiquidGlassButton
            title="Dashboard"
            onPress={resetToMyAppointments}
            height={56}
            borderRadius={16}
            tintColor={theme.colors.secondary}
            shadowIntensity="medium"
          />
        </View>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing[4],
    padding: theme.spacing[4],
  },
  illustration: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
    marginBottom: theme.spacing[3],
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.secondary,
  },
  subtitle: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  detailsBlock: {
    gap: theme.spacing[2],
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing[4],
    backgroundColor: theme.colors.cardBackground,
    marginTop: theme.spacing[3],
  },
  detailsTitle: {
    ...theme.typography.titleMedium,
    color: theme.colors.secondary,
    marginBottom: theme.spacing[2],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[1],
  },
  detailLabel: {
    ...theme.typography.body14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    ...theme.typography.body14,
    color: theme.colors.secondary,
    fontWeight: '500',
  },
  link: {
    color: theme.colors.primary,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: theme.spacing[4],
  },
});

export default PaymentSuccessScreen;
