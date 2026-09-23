import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {useTheme} from '@/hooks';
import {useAuth} from '@/features/auth/context/AuthContext';
import {appLocked, appUnlocked, authenticatingChanged} from './appLockSlice';
import {unlock, type AppLockResult} from './services/appLockKeychain';
import {
  coverRendered,
  monotonicNow,
  setPrivacy,
} from './services/privacyScreen';
import {shouldLockOnResume} from './appLockLogic';

export const AppLockGate: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {isLoggedIn, logout} = useAuth();
  const settings = useAppSelector(state => state.appLock);
  const status = useAppSelector(state => state.appLockStatus);
  const backgroundRef = useRef<{wall: number; mono: number | null} | null>(
    null,
  );
  const activeRef = useRef(false);
  const authenticatingRef = useRef(status.authenticating);
  authenticatingRef.current = status.authenticating;
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setPrivacy(settings.enabled, settings.timeoutMs).catch(() => undefined);
  }, [settings.enabled, settings.timeoutMs]);

  useEffect(() => {
    if (!settings.enabled || !isLoggedIn) {
      activeRef.current = false;
      dispatch(appUnlocked());
      return;
    }
    if (!activeRef.current) {
      dispatch(appLocked());
    }
    activeRef.current = true;
    const onStateChange = async (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundRef.current = {wall: Date.now(), mono: await monotonicNow()};
        return;
      }
      if (next !== 'active') return;
      if (authenticatingRef.current) return;
      const background = backgroundRef.current;
      backgroundRef.current = null;
      if (!background) {
        dispatch(appLocked());
      } else {
        const mono = await monotonicNow();
        if (
          shouldLockOnResume({
            wallElapsed: Date.now() - background.wall,
            monoElapsed:
              mono === null || background.mono === null
                ? null
                : mono - background.mono,
            timeoutMs: settings.timeoutMs,
          })
        ) {
          dispatch(appLocked());
        } else {
          dispatch(appUnlocked());
        }
      }
      await coverRendered();
    };
    const subscription = AppState.addEventListener('change', onStateChange);
    return () => subscription.remove();
  }, [dispatch, isLoggedIn, settings.enabled, settings.timeoutMs]);

  const handleUnlock = useCallback(async () => {
    if (status.authenticating) return;
    setFailure(null);
    dispatch(authenticatingChanged(true));
    const result: AppLockResult = await unlock();
    dispatch(authenticatingChanged(false));
    if (result.ok) {
      dispatch(appUnlocked());
      await coverRendered();
    } else {
      setFailure(t(`appLock.failure.${result.reason}`));
    }
  }, [dispatch, status.authenticating, t]);

  if (!settings.enabled || !isLoggedIn || !status.locked)
    return <>{children}</>;

  return (
    <>
      <View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none">
        {children}
      </View>
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
            disabled={status.authenticating}
            onPress={handleUnlock}
            style={[styles.button, {backgroundColor: theme.colors.blue}]}>
            <Text style={[styles.buttonText, {color: theme.colors.white}]}>
              {status.authenticating
                ? t('appLock.waiting')
                : t('appLock.unlock')}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={logout}>
            <Text style={[styles.signOut, {color: theme.colors.inkMuted}]}>
              {t('appLock.signOut')}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
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

export default AppLockGate;
