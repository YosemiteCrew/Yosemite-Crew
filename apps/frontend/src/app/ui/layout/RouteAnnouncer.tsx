'use client';

import { useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const getAnnouncementText = () => {
  const title = document.title.trim();
  return title ? `${title} loaded` : 'Page updated';
};

const subscribeToRouteAnnouncement = () => () => undefined;

const getServerAnnouncementSnapshot = () => '';

const RouteAnnouncer = () => {
  usePathname();
  useSearchParams();
  const announcement = useSyncExternalStore(
    subscribeToRouteAnnouncement,
    getAnnouncementText,
    getServerAnnouncementSnapshot
  );

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
};

export default RouteAnnouncer;
