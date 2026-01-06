import type {CoParent} from '@/features/coParent/types';
import type {User} from '@/features/auth/types';

/**
 * Get a user-friendly display name for an assigned user
 * @param userId - The ID of the user to get the name for
 * @param currentUser - The currently logged-in user
 * @param coParents - List of accepted co-parents
 * @returns Display name or undefined if user not found
 */
export const getAssignedUserName = (
  userId: string | null | undefined,
  currentUser: User | null,
  coParents: CoParent[],
): string | undefined => {
  if (!userId) return undefined;

  // Check current user
  const currentUserId = currentUser?.parentId ?? currentUser?.id;
  if (userId === currentUserId) {
    return currentUser?.firstName || currentUser?.email || 'You';
  }

  // Check co-parents
  const coParent = coParents.find(cp => {
    const cpId = cp.parentId || cp.id || cp.userId;
    return cpId === userId;
  });

  if (coParent) {
    return [coParent.firstName, coParent.lastName].filter(Boolean).join(' ').trim() ||
      coParent.email ||
      'Co-parent';
  }

  return undefined;
};
