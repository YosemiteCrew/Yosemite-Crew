'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';
import { LegalSections } from './LegalContent';
import { TERMS_SECTIONS } from './content';

const TOC: readonly TocEntry[] = TERMS_SECTIONS.map(({ id, title }) => ({ id, label: title }));

const TermsAndConditions = () => (
  <LegalDoc
    eyebrow="Legal"
    title="Terms and conditions"
    subtitle="The Yosemite Crew License and Subscription Terms (SaaS). These govern the hosted service. The self-hosting Software is governed only by its open-source licence."
    meta="Updated March 2026 · DuneXploration UG (haftungsbeschränkt), Mainz"
    toc={TOC}
  >
    <LegalSections sections={TERMS_SECTIONS} />
  </LegalDoc>
);

export default TermsAndConditions;
