import React, {useState} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {Button} from '../../components';
import {useTheme} from '../../hooks';
import { useAuth } from '@/contexts/AuthContext';

const LANGUAGES = [
  {code: 'en', name: 'English', flag: '🇺🇸'},
  {code: 'es', name: 'Español', flag: '🇪🇸'},
];

export const ProfileScreen: React.FC = () => {
  const {theme, toggleTheme, isDark} = useTheme();
  const {user, logout} = useAuth();
  const {t, i18n} = useTranslation();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      t('common.sign_out'),
      t('profile.logout_confirmation'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {text: t('common.sign_out'), onPress: logout, style: 'destructive'},
      ]
    );
  };

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setShowLanguageModal(false);
  };

  const getCurrentLanguageName = () => {
    const currentLang = LANGUAGES.find(lang => lang.code === i18n.language);
    return currentLang?.name || 'English';
  };

  const handleNotifications = () => {
    Alert.alert(
      t('profile.notifications'),
      t('profile.notifications_message'),
      [{text: t('common.ok')}]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      t('profile.help_support'),
      t('profile.help_message'),
      [{text: t('common.ok')}]
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      t('profile.privacy_policy'),
      t('profile.privacy_message'),
      [{text: t('common.ok')}]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      t('profile.rate_app'),
      t('profile.rate_message'),
      [{text: t('common.ok')}]
    );
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
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['6'],
      width: '80%',
      maxWidth: 300,
    },
    modalTitle: {
      ...theme.typography.h4,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing['6'],
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
      paddingHorizontal: theme.spacing['2'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['2'],
    },
    selectedLanguage: {
      backgroundColor: theme.colors.primary + '20',
    },
    languageFlag: {
      fontSize: 24,
      marginRight: theme.spacing['3'],
    },
    languageName: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    selectedIndicator: {
      color: theme.colors.primary,
      fontSize: 16,
    },
    modalCloseButton: {
      marginTop: theme.spacing['4'],
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={{uri: user?.profilePicture || 'https://picsum.photos/100/100'}}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{user?.firstName || t('profile.user')}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🌙</Text>
              <Text style={styles.menuItemText}>{t('profile.dark_mode')}</Text>
            </View>
            <Text style={styles.menuItemValue}>{isDark ? t('common.on') : t('common.off')}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleNotifications}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🔔</Text>
              <Text style={styles.menuItemText}>{t('profile.notifications')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageModal(true)}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>🌍</Text>
              <Text style={styles.menuItemText}>{t('profile.language')}</Text>
            </View>
            <Text style={styles.menuItemValue}>{getCurrentLanguageName()}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.support')}</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>❓</Text>
              <Text style={styles.menuItemText}>{t('profile.help_support')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handlePrivacy}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>📄</Text>
              <Text style={styles.menuItemText}>{t('profile.privacy_policy')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleRateApp}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemIcon}>⭐</Text>
              <Text style={styles.menuItemText}>{t('profile.rate_app')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.logoutContainer}>
          <Button
            title={t('common.sign_out')}
            onPress={handleLogout}
            variant="outline"
          />
          <Text style={styles.versionText}>{t('profile.version', {version: '1.0.0'})}</Text>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.select_language')}</Text>
            
            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageOption,
                  i18n.language === language.code && styles.selectedLanguage,
                ]}
                onPress={() => handleLanguageChange(language.code)}>
                <Text style={styles.languageFlag}>{language.flag}</Text>
                <Text style={styles.languageName}>{language.name}</Text>
                {i18n.language === language.code && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.modalCloseButton}>
              <Button
                title={t('common.cancel')}
                onPress={() => setShowLanguageModal(false)}
                variant="outline"
                size="small"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};