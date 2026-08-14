'use client';

import { Icon as IconifyIcon, type IconProps } from '@iconify/react';
import { OFFLINE_ICONS } from '@/app/ui/icons/offlineIcons';

/**
 * Drop-in replacement for Iconify's `<Icon>` that renders from bundled icon data.
 *
 * Import this rather than `@iconify/react` directly: a bare string name makes
 * Iconify fetch the icon from api.iconify.design at render time, which costs a
 * third-party request on first paint and is no longer allowed by the CSP.
 * Passing the data inline keeps rendering local and synchronous.
 */
const Icon = ({ icon, ...rest }: IconProps) => {
  const resolved = typeof icon === 'string' ? (OFFLINE_ICONS[icon] ?? icon) : icon;
  return <IconifyIcon icon={resolved} {...rest} />;
};

export default Icon;
export { Icon };
