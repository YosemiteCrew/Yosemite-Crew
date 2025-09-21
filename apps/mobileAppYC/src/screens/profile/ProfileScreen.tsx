import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../../components';
import {useTheme, useAuth} from '../../hooks';

export const ProfileScreen: React.FC = () => {
  const {theme, toggleTheme, isDark} = useTheme();
  const {user, logout} = useAuth();

  const handleLogout = () => {
    logout();
  };

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
      alignItems: 'center',
      marginBottom: theme.spacing['8'],
      paddingVertical: theme.spacing['6'],
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: theme.borderRadius.full,
      marginBottom: theme.spacing['4'],
      backgroundColor: theme.colors.backgroundSecondary,
    },
    userName: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing['1'],
    },
    userEmail: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    section: {
      marginBottom: theme.spacing['6'],
    },
    sectionTitle: {
      ...theme.typography.h5,
      color: theme.colors.text,
      marginBottom: theme.spacing['4'],
    },
    menuItem: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['4'],
      marginBottom: theme.spacing['2'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...theme.shadows.sm,
    },
    menuItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    menuItemIcon: {
      fontSize: 20,
      marginRight: theme.spacing['3'],
    },
    menuItemText: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    menuItemValue: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing['2'],
    },
    arrow: {
      ...theme.typography.h4,
      color: theme.colors.textSecondary,
    },
    logoutContainer: {
      marginTop: theme.spacing['8'],
      paddingBottom: theme.spacing['8'],
    },
    versionText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing['4'],
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={{uri: user?.avatar || 'https://picsum.photos/100/100'}}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🌙</Text>
              <Text style={styles.menuItemText}>Dark Mode</Text>
            </View>
            <Text style={styles.menuItemValue}>{isDark ? 'On' : 'Off'}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🔔</Text>
              <Text style={styles.menuItemText}>Notifications</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🌍</Text>
              <Text style={styles.menuItemText}>Language</Text>
            </View>
            <Text style={styles.menuItemValue}>English</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>❓</Text>
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>📄</Text>
              <Text style={styles.menuItemText}>Privacy Policy</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>⭐</Text>
              <Text style={styles.menuItemText}>Rate App</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutContainer}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="outline"
          />
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};