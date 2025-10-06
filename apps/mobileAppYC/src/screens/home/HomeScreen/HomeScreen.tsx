import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../../../components';
import {useTheme} from '../../../hooks';
import {TabScreenProps} from '../../../navigation/types';
import { useAuth } from '@/contexts/AuthContext';

type Props = TabScreenProps<'Home'>;

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {theme} = useTheme();
  const {user, logout} = useAuth();

  const handleLogout = () => {
    logout();
  };

  // const handleThemeToggle = () => {
  //   // This will be implemented when we add theme toggle functionality
  // };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing['6'],
      paddingTop: theme.spacing['6'],
    },
    header: {
      marginBottom: theme.spacing['8'],
    },
    greeting: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    quickActions: {
      marginBottom: theme.spacing['8'],
    },
    sectionTitle: {
      ...theme.typography.h4,
      color: theme.colors.text,
      marginBottom: theme.spacing['4'],
    },
    actionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['6'],
      marginBottom: theme.spacing['4'],
      ...theme.shadows.sm,
    },
    actionTitle: {
      ...theme.typography.h5,
      color: theme.colors.text,
      marginBottom: theme.spacing['2'],
    },
    actionDescription: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing['4'],
    },
    stats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.spacing['8'],
    },
    statCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      flex: 1,
      marginHorizontal: theme.spacing['1'],
      alignItems: 'center',
      ...theme.shadows.sm,
    },
    statNumber: {
      ...theme.typography.h3,
      color: theme.colors.primary,
      marginBottom: theme.spacing['1'],
    },
    statLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    logoutContainer: {
      marginTop: 'auto',
      paddingBottom: theme.spacing['6'],
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hello, {user?.firstName || 'Pet Parent'}! 👋
          </Text>
          <Text style={styles.subtitle}>
            Welcome back to your pet care dashboard
          </Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Pets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Records</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Pets', {screen: 'AddPet'})}>
            <Text style={styles.actionTitle}>Add New Pet</Text>
            <Text style={styles.actionDescription}>
              Register a new furry friend to your family
            </Text>
            <Button
              title="Add Pet"
              onPress={() => navigation.navigate('Pets', {screen: 'AddPet'})}
              variant="outline"
              size="small"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Pets', {screen: 'PetList'})}>
            <Text style={styles.actionTitle}>View My Pets</Text>
            <Text style={styles.actionDescription}>
              Check on your pets and their information
            </Text>
            <Button
              title="View Pets"
              onPress={() => navigation.navigate('Pets', {screen: 'PetList'})}
              variant="outline"
              size="small"
            />
          </TouchableOpacity>

          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>Schedule Appointment</Text>
            <Text style={styles.actionDescription}>
              Book a vet appointment for your pet
            </Text>
            <Button
              title="Schedule"
              onPress={() => {}}
              variant="outline"
              size="small"
            />
          </View>
        </View>

        <View style={styles.logoutContainer}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};