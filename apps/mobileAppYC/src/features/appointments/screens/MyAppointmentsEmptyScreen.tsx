import React from 'react';
import {View, Image, StyleSheet} from 'react-native';
import {LiquidGlassHeaderScreen} from '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen';
import {Header} from '@/shared/components/common/Header/Header';
import {EmptyState} from '@/shared/components/common/EmptyState/EmptyState';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';
import {Images} from '@/assets/images';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {useDispatch, useSelector} from 'react-redux';
import {
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
} from '@/features/companion';
import {CompanionSelector} from '@/shared/components/common/CompanionSelector/CompanionSelector';
import type {AppDispatch} from '@/app/store';

type Nav = NativeStackNavigationProp<AppointmentStackParamList>;

export const MyAppointmentsEmptyScreen: React.FC = () => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<Nav>();
  const dispatch = useDispatch<AppDispatch>();
  const companions = useSelector(selectCompanions);
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const hasCompanions = companions.length > 0;

  const handleAdd = () => navigation.navigate('BrowseBusinesses');

  return (
    <LiquidGlassHeaderScreen
      header={
        <Header
          title="My Appointments"
          variant="root"
          showBackButton={false}
          rightIcon={hasCompanions ? Images.addIconDark : undefined}
          onRightPress={hasCompanions ? handleAdd : undefined}
          glass={false}
        />
      }
      contentPadding={theme.spacing['3']}
      useSafeAreaView
      containerStyle={styles.safeArea}
      showBottomFade={false}>
      {contentPaddingStyle => (
        <View style={[styles.container, contentPaddingStyle]}>
          {hasCompanions && (
            <View style={styles.selectorWrapper}>
              <CompanionSelector
                companions={companions}
                selectedCompanionId={selectedCompanionId}
                onSelect={id => dispatch(setSelectedCompanion(id))}
                showAddButton={false}
                containerStyle={styles.selectorContainer}
                requiredPermission="appointments"
                permissionLabel="appointments"
              />
            </View>
          )}
          <EmptyState
            style={styles.emptyState}
            icon={
              <Image source={Images.calendarIcon} style={styles.ringIcon} />
            }
            title="No visits booked yet"
            description="Your upcoming veterinary visits will appear here once scheduled."
            actionLabel={hasCompanions ? 'Book an appointment' : undefined}
            actionIcon={
              hasCompanions ? (
                <Image source={Images.addIconWhite} style={styles.ctaIcon} />
              ) : undefined
            }
            onAction={hasCompanions ? handleAdd : undefined}
          />
        </View>
      )}
    </LiquidGlassHeaderScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.screen,
    },
    selectorWrapper: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['3'],
      marginBottom: theme.spacing['1'],
    },
    selectorContainer: {
      marginBottom: theme.spacing['2'],
    },
    emptyState: {
      flex: 1,
      paddingBottom: theme.spacing['52'],
    },
    ringIcon: {
      width: 44,
      height: 44,
      resizeMode: 'contain',
      tintColor: theme.colors.blueText,
    },
    ctaIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
      tintColor: theme.colors.ctaText,
    },
  });

export default MyAppointmentsEmptyScreen;
