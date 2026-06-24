'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const getAnnouncementText = () => {
  const title = document.title.trim();
  return title ? `${title} loaded` : 'Page updated';
};

const RouteAnnouncer = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Start empty so the server render and the first client render agree (the
  // page title is only known on the client). Update after each route change.
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setAnnouncement(getAnnouncementText());
  }, [pathname, searchParams]);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
};

export default RouteAnnouncer;
