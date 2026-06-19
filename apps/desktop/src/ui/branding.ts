'use strict';

// Branding metadata for native surfaces (About panel, Help menu).
// Pure and dependency-free so it can be unit tested without Electron.

const PRODUCT_NAME = 'Yosemite Crew PIMS';
const COMPANY = 'Yosemite Crew';
const WEBSITE = 'https://yosemitecrew.com';

export interface AboutPanelOptions {
  applicationName: string;
  applicationVersion: string;
  version: string;
  copyright: string;
  website: string;
}

export interface HelpLink {
  label: string;
  url: string;
}

export const aboutPanelOptions = (
  version: string,
  year = new Date().getFullYear()
): AboutPanelOptions => ({
  applicationName: PRODUCT_NAME,
  applicationVersion: version,
  version,
  copyright: `© ${year} ${COMPANY}`,
  website: WEBSITE,
});

export const HELP_LINKS: readonly HelpLink[] = Object.freeze([
  { label: 'Yosemite Crew Website', url: WEBSITE },
  { label: 'Contact Support', url: `${WEBSITE}/contact-us` },
  {
    label: 'Report an Issue',
    url: 'https://github.com/YosemiteCrew/Yosemite-Crew/issues',
  },
]);

export const branding = {
  PRODUCT_NAME,
  COMPANY,
  WEBSITE,
};
