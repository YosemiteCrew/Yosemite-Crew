import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

let _onboardingLoaded = false;
let _showOnboarding = false;
let _onboardingFetching = false;
const _onboardingListeners = new Set<() => void>();

function _notifyOnboarding() {
  _onboardingListeners.forEach(l => l());
}

function _startOnboardingFetch() {
  if (_onboardingFetching) return;
  _onboardingFetching = true;
  AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
    .then(value => {
      _showOnboarding = value === null;
    })
    .catch(() => {
      _showOnboarding = true;
    })
    .finally(() => {
      _onboardingLoaded = true;
      _notifyOnboarding();
    });
}

export function subscribeOnboarding(l: () => void) {
  _onboardingListeners.add(l);
  _startOnboardingFetch();
  return () => {
    _onboardingListeners.delete(l);
  };
}

export function getShowOnboarding() {
  return _showOnboarding;
}
export function getOnboardingLoading() {
  return !_onboardingLoaded;
}

export function markOnboardingComplete() {
  _showOnboarding = false;
  _notifyOnboarding();
}

export function _resetOnboardingStoreForTesting() {
  _onboardingLoaded = false;
  _showOnboarding = false;
  _onboardingFetching = false;
  _onboardingListeners.clear();
}
