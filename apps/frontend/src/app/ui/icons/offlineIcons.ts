import type { IconifyIcon } from '@iconify/react';
import iconData from './offlineIcons.json';

// Iconify's <Icon> fetches icon data from api.iconify.design at render time, so
// any surface using one waited on a third-party request and the CSP had to allow
// that origin. The icons this app uses are baked in here instead and passed to
// <Icon> directly - no network, no third party.
//
// The bodies live in offlineIcons.json rather than inline in this module: they
// are vendored third-party data, not code, and a table of 29 identically shaped
// entries is duplication by construction when it sits in a .ts file.
//
// Icon sets are open source: ion (MIT), mdi (Apache-2.0), solar (CC-BY-4.0).
// To add an icon, take its `body` from
// https://api.iconify.design/<prefix>.json?icons=<name>
// and add an entry to the JSON. offlineIcons.test.ts asserts this map covers
// every name the app renders, so a missing one fails CI rather than silently not
// drawing (the CSP no longer permits the remote lookup).

/** One vendored entry: the sets used here all publish on a square viewBox. */
type OfflineIconSource = {
  size: number;
  body: string;
};

const toIcon = ({ size, body }: OfflineIconSource): IconifyIcon => ({
  body,
  width: size,
  height: size,
});

export const OFFLINE_ICONS: Readonly<Record<string, IconifyIcon>> = Object.freeze(
  Object.fromEntries(
    Object.entries(iconData as Record<string, OfflineIconSource>).map(([name, source]) => [
      name,
      toIcon(source),
    ])
  )
);
