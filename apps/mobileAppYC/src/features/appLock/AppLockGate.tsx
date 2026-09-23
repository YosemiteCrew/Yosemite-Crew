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
  const {isLoggedIn, logout, user} = useAuth();
  const settings = useAppSelector(state => state.appLock);
  const status = useAppSelector(state => state.appLockStatus);
  const backgroundRef = useRef<{wall: number; mono: number | null} | null>(
    null,
  );
  const activeRef = useRef(false);
  const authenticatingRef = useRef(status.authenticating);
  const promptInactiveRef = useRef(false);
  const skipNextActiveRef = useRef(false);
  if (status.authenticating) {
    authenticatingRef.current = true;
  }
  const [failure, setFailure] = useState<string | null>(null);
  const currentUserId = user?.parentId ?? user?.id ?? null;
  const isOwner = !settings.ownerId || settings.ownerId === currentUserId;

  useEffect(() => {
    setPrivacy(settings.enabled, settings.timeoutMs).catch(() => undefined);
  }, [settings.enabled, settings.timeoutMs]);

  useEffect(() => {
    if (!settings.enabled || !isLoggedIn) {
      activeRef.current = false;
      dispatch(appUnlocked());
      return;
    }
    if (settings.ownerId && settings.ownerId !== currentUserId) {
      activeRef.current = false;
      dispatch(appUnlocked());
      return;
    }
    if (!activeRef.current) {
      dispatch(appLocked());
    }
    activeRef.current = true;
    const onStateChange = async (next: AppStateStatus) => {
      if (authenticatingRef.current) {
        if (next === 'background' || next === 'inactive') {
          promptInactiveRef.current = true;
        }
        return;
      }
      if (next === 'active' && skipNextActiveRef.current) {
        skipNextActiveRef.current = false;
        return;
      }
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
  }, [
    currentUserId,
    dispatch,
    isLoggedIn,
    settings.enabled,
    settings.ownerId,
    settings.timeoutMs,
  ]);

  const handleUnlock = useCallback(async () => {
    if (status.authenticating || !isOwner) return;
    setFailure(null);
    authenticatingRef.current = true;
    dispatch(authenticatingChanged(true));
    const result: AppLockResult = await unlock();
    dispatch(authenticatingChanged(false));
    authenticatingRef.current = false;
    if (promptInactiveRef.current) {
      skipNextActiveRef.current = true;
      promptInactiveRef.current = false;
    }
    if (result.ok) {
      dispatch(appUnlocked());
      await coverRendered();
    } else {
      setFailure(t(`appLock.failure.${result.reason}`));
    }
  }, [dispatch, isOwner, status.authenticating, t]);

  const locked = settings.enabled && isLoggedIn && isOwner && status.locked;

  return (
    <>
      <View
        style={styles.content}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={locked}
        pointerEvents={locked ? 'none' : 'auto'}>
        {children}
      </View>
      {locked ? (
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
              disabled={status.authenticating || !isOwner}
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
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  content: {flex: 1},
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
