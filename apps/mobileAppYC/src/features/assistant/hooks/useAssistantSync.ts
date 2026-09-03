import {useCallback, useEffect, useRef} from 'react';
import {AppState, Platform, type AppStateStatus} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {selectAssistantData} from '../selectors';
import {refreshAssistantSnapshot} from '../thunks';
import {consumePendingLink} from '../services/assistantSnapshot';
import {resolveHandoffTarget} from '../services/handoffNavigation';
import {getSnapshotModule} from '../services/nativeBridge';
import {ASSISTANT_ACTIONS} from '../actions/catalogue';

/**
 * The slice of the navigation container this hook needs.
 *
 * Taking the container ref rather than calling `useNavigation()` keeps the
 * hook independent of navigator context: it is mounted at the app root, which
 * renders above the navigator in some trees and in none at all under test.
 */
export interface AssistantNavigator {
  isReady: () => boolean;
  navigate: (name: string, params?: object) => void;
}

/** How long to wait after a data change before rewriting the snapshot. */
const SNAPSHOT_DEBOUNCE_MS = 1_500;

/** Actions worth a launcher shortcut, in the order they are shown. */
const SHORTCUT_ACTION_IDS = [
  'upcomingTasks',
  'nextAppointment',
  'addCareTask',
  'bookAppointment',
] as const;

/**
 * Keeps the OS-facing surfaces in step with the app.
 *
 * Three jobs, all of them fire-and-forget:
 *  - rewrite the offline snapshot when the underlying records change, so Siri
 *    and the launcher shortcuts answer with today's facts;
 *  - publish the Android app shortcuts once per launch;
 *  - pick up a deep link parked by an intent or shortcut and route to it.
 *
 * Every one of these no-ops when the native module is absent, which is the
 * case in Jest and in a JS-only reload.
 */
export const useAssistantSync = (
  navigator?: AssistantNavigator | null,
): void => {
  const dispatch = useAppDispatch();
  const {t} = useTranslation();
  const data = useAppSelector(selectAssistantData);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rewriting on every keystroke of a task form would be wasteful, and the
  // snapshot only has to be right by the time the app is backgrounded.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      dispatch(refreshAssistantSnapshot());
    }, SNAPSHOT_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    dispatch,
    data.companions,
    data.tasks,
    data.appointments,
    data.vaccinations,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const module = getSnapshotModule();
    if (!module?.publishShortcuts) {
      return;
    }
    const payload = SHORTCUT_ACTION_IDS.map(id => {
      const action = ASSISTANT_ACTIONS.find(entry => entry.id === id);
      return {
        id,
        label: action ? t(action.titleKey) : id,
        longLabel: action ? t(action.descriptionKey) : id,
        link: action?.deepLink ?? 'yc://app/assistant',
      };
    });
    module.publishShortcuts(JSON.stringify(payload));
  }, [t]);

  const routePendingLink = useCallback(async () => {
    const link = await consumePendingLink();
    if (!link) {
      return;
    }
    const target = resolveHandoffTarget(link);
    if (!target) {
      return;
    }
    // A link can arrive before the navigator has mounted, on a cold start from
    // a shortcut. Dropping it beats throwing; the app still opens.
    if (!navigator?.isReady()) {
      return;
    }
    navigator.navigate('Main', {
      screen: target.tab,
      params: target.nested
        ? {screen: target.screen, params: target.nested}
        : {screen: target.screen, params: target.params},
    });
  }, [navigator]);

  useEffect(() => {
    routePendingLink();

    // A handoff intent opens the app; if it was already running, the link
    // arrives while the app is resuming rather than at mount.
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        if (status === 'active') {
          routePendingLink();
        }
      },
    );
    return () => subscription.remove();
  }, [routePendingLink]);
};
