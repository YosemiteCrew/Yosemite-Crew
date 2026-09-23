import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';

type AppLockOverlayProps = {
  failure: string | null;
  isOwner: boolean;
  locked: boolean;
  authenticating: boolean;
  onUnlock: () => void;
  onLogout: () => void;
};

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({
  failure,
  isOwner,
  locked,
  authenticating,
  onUnlock,
  onLogout,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  if (!locked) return null;
  return (
    <View style={[styles.root, {backgroundColor: theme.colors.screen}]}>
      <View
        accessible
        accessibilityLabel={t('appLock.lockedLabel')}
        style={styles.card}>
        <Text style={[styles.title, {color: theme.colors.ink}]}>
          {t('appLock.lockedTitle')}
        </Text>
        <Text style={[styles.caption, {color: theme.colors.inkMuted}]}>
          {failure ?? t('appLock.lockedCaption')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('appLock.unlock')}
          disabled={authenticating || !isOwner}
          onPress={onUnlock}
          style={[styles.button, {backgroundColor: theme.colors.blue}]}>
          <Text style={[styles.buttonText, {color: theme.colors.white}]}>
            {authenticating ? t('appLock.waiting') : t('appLock.unlock')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onLogout}>
          <Text style={[styles.signOut, {color: theme.colors.inkMuted}]}>
            {t('appLock.signOut')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: 1000,
    justifyContent: 'center',
    padding: 24,
  },
  card: {alignItems: 'center', gap: 16},
  title: {fontSize: 24, fontWeight: '700', textAlign: 'center'},
  caption: {fontSize: 16, textAlign: 'center', maxWidth: 300},
  button: {
    minWidth: 180,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonText: {fontSize: 16, fontWeight: '700'},
  signOut: {fontSize: 14, padding: 12},
});
