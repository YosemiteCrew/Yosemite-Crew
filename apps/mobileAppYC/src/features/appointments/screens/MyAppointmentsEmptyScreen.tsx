import React from 'react';
import {View, Image, Text, StyleSheet} from 'react-native';
import {SafeArea} from '@/shared/components/common';
import {Header} from '@/shared/components/common/Header/Header';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AppointmentStackParamList} from '@/navigation/types';
import {useDispatch, useSelector} from 'react-redux';
import {selectCompanions, selectSelectedCompanionId, setSelectedCompanion} from '@/features/companion';
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

  const handleAdd = () => navigation.navigate('BrowseBusinesses');

  return (
    <SafeArea>
      <Header
        title="My Appointments"
        showBackButton={false}
        rightIcon={companions.length > 0 ? Images.addIconDark : undefined}
        onRightPress={companions.length > 0 ? handleAdd : undefined}
      />
      <View style={styles.container}>
        {companions.length > 0 && (
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
        <View style={styles.contentContainer}>
          <Image source={Images.emptyAppointments || Images.emptyTasksIllustration} style={styles.emptyImage} />
          <Text style={styles.title}>We’ve dug and dug… but no appointments found.</Text>
          <Text style={styles.subtitle}>We’ll save your appointment history here once you start seeing your vet.</Text>
        </View>
      </View>
    </SafeArea>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.background},
    selectorWrapper: {
      paddingHorizontal: theme.spacing['4'],
      paddingTop: theme.spacing['3'],
      marginBottom: theme.spacing['1'],
    },
    selectorContainer: {
      marginBottom: theme.spacing['2'],
    },
    contentContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: theme.spacing['52'],
      paddingHorizontal: theme.spacing['6'],
    },
    emptyImage: {width: 220, height: 220, resizeMode: 'contain', marginBottom: theme.spacing['6']},
    title: {...theme.typography.businessSectionTitle20, color: '#302F2E', marginBottom: theme.spacing['3'], textAlign: 'center'},
    subtitle: {...theme.typography.subtitleRegular14, color: '#302F2E', textAlign: 'center'},
  });

export default MyAppointmentsEmptyScreen;
