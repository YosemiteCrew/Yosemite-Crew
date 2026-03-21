import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {NavigationProp, RouteProp} from '@react-navigation/native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import type {AppointmentStackParamList, TabParamList} from '@/navigation/types';
import {MerckSearchWidget} from '@/features/merck/components/MerckSearchWidget';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;
type Route = RouteProp<AppointmentStackParamList, 'MerckManuals'>;

export const MerckManualSearchScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const {organisationId, initialQuery, context} = route.params;

  const returnToHomeAndResetAppointments = React.useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{name: 'MyAppointments'}],
    });

    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate('HomeStack', {screen: 'Home'});
  }, [navigation]);

  const handleBack = React.useCallback(() => {
    if (context === 'home') {
      returnToHomeAndResetAppointments();
      return;
    }

    navigation.goBack();
  }, [context, navigation, returnToHomeAndResetAppointments]);

  useFocusEffect(
    React.useCallback(() => {
      if (context !== 'home') {
        return undefined;
      }

      const unsubscribe = navigation.addListener('beforeRemove', event => {
        if (
          event.data.action.type !== 'GO_BACK' &&
          event.data.action.type !== 'POP'
        ) {
          return;
        }

        event.preventDefault();
        returnToHomeAndResetAppointments();
      });

      return unsubscribe;
    }, [context, navigation, returnToHomeAndResetAppointments]),
  );

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="Merck Manuals"
          showBackButton
          onBack={handleBack}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <ScrollView
          contentContainerStyle={[styles.container, contentPaddingStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.widgetWrap}>
            <MerckSearchWidget
              organisationId={organisationId}
              title="Consumer Merck Search"
              description="Mobile supports the consumer experience only."
              initialQuery={initialQuery}
              compact={false}
            />
          </View>
        </ScrollView>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['4'],
      paddingBottom: theme.spacing['20'],
    },
    widgetWrap: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
  });

export default MerckManualSearchScreen;
