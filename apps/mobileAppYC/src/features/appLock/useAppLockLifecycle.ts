import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import type {AppDispatch} from '@/app/store';
import {appLocked, appUnlocked} from './appLockSlice';
import {coverRendered, monotonicNow} from './services/privacyScreen';
import {shouldLockOnResume} from './appLockLogic';

type AppLockLifecycleOptions = {
  currentUserId: string | null;
  dispatch: AppDispatch;
  isLoggedIn: boolean;
  ownerId: string | null;
  timeoutMs: number;
  enabled: boolean;
};

export const useAppLockLifecycle = ({
  currentUserId,
  dispatch,
  isLoggedIn,
  ownerId,
  timeoutMs,
  enabled,
}: AppLockLifecycleOptions) => {
  const backgroundRef = useRef<{wall: number; mono: number | null} | null>(
    null,
  );
  const activeRef = useRef(false);
  const isAppLockPromptActive = useRef(false);
  const promptInactiveRef = useRef(false);
  const skipNextActiveRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isLoggedIn || (ownerId && ownerId !== currentUserId)) {
      activeRef.current = false;
      dispatch(appUnlocked());
      return;
    }
    if (!activeRef.current) dispatch(appLocked());
    activeRef.current = true;

    const handleResume = async () => {
      if (isAppLockPromptActive.current) return;
      const background = backgroundRef.current;
      backgroundRef.current = null;
      if (!background) {
        dispatch(appLocked());
      } else {
        const mono = await monotonicNow();
        const shouldLock = shouldLockOnResume({
          wallElapsed: Date.now() - background.wall,
          monoElapsed:
            mono === null || background.mono === null
              ? null
              : mono - background.mono,
          timeoutMs,
        });
        dispatch(shouldLock ? appLocked() : appUnlocked());
      }
      await coverRendered();
    };

    const onStateChange = async (next: AppStateStatus) => {
      if (isAppLockPromptActive.current) {
        promptInactiveRef.current =
          next === 'background' || next === 'inactive';
        return;
      }
      if (next === 'active' && skipNextActiveRef.current) {
        skipNextActiveRef.current = false;
        return;
      }
      if (next === 'background' || next === 'inactive') {
        const entry = {wall: Date.now(), mono: null as number | null};
        backgroundRef.current = entry;
        entry.mono = await monotonicNow();
        return;
      }
      if (next === 'active') await handleResume();
    };

    const subscription = AppState.addEventListener('change', onStateChange);
    return () => subscription.remove();
  }, [currentUserId, dispatch, enabled, isLoggedIn, ownerId, timeoutMs]);

  return {
    activeRef,
    isAppLockPromptActive,
    promptInactiveRef,
    skipNextActiveRef,
  };
};
