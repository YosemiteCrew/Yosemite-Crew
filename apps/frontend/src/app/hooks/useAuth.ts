import { useAuthStore } from '@/app/stores/authStore';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';
import { useFullscreenLoaderStore } from '@/app/stores/fullscreenLoaderStore';
import { useRouteLoaderStore } from '@/app/stores/routeLoaderStore';

export function useSignOut() {
  return { signOut: hardSignOut };
}

export async function hardSignOut() {
  try {
    await useAuthStore.getState().signout();
  } finally {
    clearSessionScopedStores();
    useFullscreenLoaderStore.getState().clear();
    useRouteLoaderStore.getState().stop();
  }
}
