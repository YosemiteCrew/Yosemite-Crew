'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';
import { LegalBlocks, LegalSections } from './LegalContent';
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from './content';

const TOC: readonly TocEntry[] = PRIVACY_SECTIONS.map(({ id, title }) => ({ id, label: title }));

const PrivacyPolicy = () => (
  <LegalDoc
    eyebrow="Legal"
    title="Privacy policy"
    subtitle="The protection and security of your personal data matters to us. This describes how our open-source practice management software collects, processes and stores personal data, as a web app and a mobile app."
    meta="Updated March 2026 · Controller: DuneXploration UG (haftungsbeschränkt), Mainz"
    toc={TOC}
  >
    <LegalBlocks blocks={PRIVACY_INTRO} />
    <LegalSections sections={PRIVACY_SECTIONS} />
  </LegalDoc>
);

export default PrivacyPolicy;
