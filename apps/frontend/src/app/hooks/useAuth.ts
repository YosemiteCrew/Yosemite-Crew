import { useAuthStore } from '@/app/stores/authStore';
import { clearSessionScopedStores } from '@/app/lib/resetSessionStores';

export function useSignOut() {
  return { signOut: hardSignOut };
}

export async function hardSignOut() {
  try {
    await useAuthStore.getState().signout();
  } finally {
    clearSessionScopedStores();
  }
}
