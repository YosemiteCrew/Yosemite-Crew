import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {useAuth} from '@/features/auth/context/AuthContext';
import {appUnlocked, authenticatingChanged} from './appLockSlice';
import {unlock, type AppLockResult} from './services/appLockKeychain';
import {coverRendered, setPrivacy} from './services/privacyScreen';
import {useAppLockLifecycle} from './useAppLockLifecycle';
import {AppLockOverlay} from './AppLockOverlay';

export const AppLockGate: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {isLoggedIn, logout, user} = useAuth();
  const settings = useAppSelector(state => state.appLock);
  const status = useAppSelector(state => state.appLockStatus);
  const currentUserId = user?.parentId ?? user?.id ?? null;
  const isOwner = !settings.ownerId || settings.ownerId === currentUserId;
  const {authenticatingRef, promptInactiveRef, skipNextActiveRef} =
    useAppLockLifecycle({
      currentUserId,
      dispatch,
      enabled: settings.enabled,
      isLoggedIn,
      ownerId: settings.ownerId,
      timeoutMs: settings.timeoutMs,
    });
  if (status.authenticating) {
    authenticatingRef.current = true;
  }
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    setPrivacy(settings.enabled, settings.timeoutMs).catch(() => undefined);
  }, [settings.enabled, settings.timeoutMs]);

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
  }, [
    authenticatingRef,
    dispatch,
    isOwner,
    promptInactiveRef,
    skipNextActiveRef,
    status.authenticating,
    t,
  ]);

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
      <AppLockOverlay
        failure={failure}
        isOwner={isOwner}
        locked={locked}
        authenticating={status.authenticating}
        onUnlock={handleUnlock}
        onLogout={logout}
      />
    </>
  );
};

export default AppLockGate;

const styles = StyleSheet.create({content: {flex: 1}});
