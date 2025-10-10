import React from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ScrollView, StyleSheet, Text, View, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import {useAuth} from '@/contexts/AuthContext';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';

export const AccountScreen: React.FC = () => {
  const {theme} = useTheme();
  const {user, logout} = useAuth();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>
              {(user?.firstName?.[0] ?? 'Y').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.nameText}>{user?.firstName ?? 'Your'}</Text>
          <Text style={styles.emailText}>{user?.email ?? 'account@email.com'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Full name</Text>
            <Text style={styles.rowValue}>
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Not set'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user?.email ?? 'Not set'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{user?.phone ?? 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.signOutContainer}>
          <LiquidGlassButton
            title="Sign out"
            onPress={logout}
            tintColor={theme.colors.secondary}
            style={Platform.OS === 'ios' ? styles.signOutButtonIOS : styles.signOutButtonAndroid}
            height={56}
            borderRadius="lg"
            textStyle={styles.signOutText}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flexGrow: 1,
      padding: 24,
      gap: 24,
    },
    headerCard: {
      alignItems: 'center',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 32,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.cardBackground,
      ...theme.shadows.xs,
      gap: 8,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    nameText: {
      ...theme.typography.h3,
      color: theme.colors.secondary,
    },
    emailText: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
    },
    section: {
      padding: 20,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardBackground,
      gap: 16,
      ...theme.shadows.xs,
    },
    sectionTitle: {
      ...theme.typography.screenTitle,
      color: theme.colors.secondary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLabel: {
      ...theme.typography.paragraphBold,
      color: theme.colors.textSecondary,
    },
    rowValue: {
      ...theme.typography.paragraph,
      color: theme.colors.secondary,
      textAlign: 'right',
      maxWidth: '60%',
    },
    signOutContainer: {
      marginTop: 24,
    },
    signOutButtonIOS: {
      width: '100%',
    },
    signOutButtonAndroid: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
    },
    signOutText: {
      ...theme.typography.cta,
      color: theme.colors.white,
    },
  });
