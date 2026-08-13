import type {LegalDocumentMeta} from './legalContentTypes';

// Header metadata for the legal readers. Update `lastUpdated` / `version`
// whenever the corresponding legal copy changes — these drive the serif
// display title and the "Last updated" pill, they are NOT legal content.
export const TERMS_META: LegalDocumentMeta = {
  displayTitle: 'Terms of service',
  lastUpdated: '10 Jul 2026',
  version: 'v1.0',
};

export const PRIVACY_META: LegalDocumentMeta = {
  displayTitle: 'How we handle your data',
  lastUpdated: '13 Aug 2026',
  version: 'GDPR',
};
