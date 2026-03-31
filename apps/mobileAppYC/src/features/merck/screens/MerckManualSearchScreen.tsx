import React from 'react';
import {StyleSheet, View} from 'react-native';
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

  const {
    organisationId,
    initialQuery,
    initialEntries,
    initialLanguage,
    initialHasSearched,
    context,
  } = route.params;

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
          title="MSD Veterinary Manual"
          showBackButton
          onBack={handleBack}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}>
      {contentPaddingStyle => (
        <View style={[styles.container, contentPaddingStyle]}>
          <View style={styles.widgetWrap}>
            <MerckSearchWidget
              organisationId={organisationId}
              title="Consumer MSD Veterinary Manual Search"
              description="Trusted companion health guidance, anywhere."
              initialQuery={initialQuery}
              initialEntries={initialEntries}
              initialLanguage={initialLanguage}
              initialHasSearched={initialHasSearched}
              compact={false}
            />
          </View>
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing['3'],
      paddingTop: theme.spacing['3'],
      paddingBottom: theme.spacing['3'],
    },
    widgetWrap: {
      flex: 1,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
    },
  });

export default MerckManualSearchScreen;
