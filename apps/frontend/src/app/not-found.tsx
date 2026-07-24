'use client';
import PublicShell from '@/app/ui/layout/PublicShell';
import NotFoundState from '@/app/ui/layout/states/NotFoundState';
import UniversalSearchPalette from '@/app/ui/layout/UniversalSearch/UniversalSearchPalette';

export default function NotFound() {
  return (
    <PublicShell>
      <NotFoundState />
      {/* Mount the palette so the "Search ⌘K" action (and the ⌘K shortcut) work
          from the not-found route, which lives outside the authenticated shell. */}
      <UniversalSearchPalette />
    </PublicShell>
  );
}
