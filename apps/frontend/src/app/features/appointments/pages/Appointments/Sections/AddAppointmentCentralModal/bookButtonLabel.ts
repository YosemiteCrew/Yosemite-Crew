/**
 * Copy for the phone sticky-footer "Book" button.
 *
 * Split out of index.tsx because a module that exports both React components and
 * plain values loses per-component Fast Refresh: an edit here would invalidate the
 * whole modal module instead of hot-swapping one component
 * (react-doctor/only-export-components).
 */
export const buildBookButtonLabel = (selectedClientName?: string): string => {
  const firstName = selectedClientName?.split(' ')[0];
  return firstName ? `Book · ${firstName} gets notified` : 'Book appointment';
};
