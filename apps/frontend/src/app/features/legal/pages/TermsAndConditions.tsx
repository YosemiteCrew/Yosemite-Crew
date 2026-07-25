'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';
import { TermsAppendix1 } from './terms/TermsAppendix1';
import { TermsAppendix2 } from './terms/TermsAppendix2';
import { TermsBody } from './terms/TermsBody';
import { TermsExhibitA } from './terms/TermsExhibitA';
import { TermsExhibitB } from './terms/TermsExhibitB';

const TOC: readonly TocEntry[] = [
  { id: 'definitions', label: '1. Definitions' },
  { id: 'scope', label: '2. Scope' },
  { id: 'overview', label: '3. Overview of the SaaS Services' },
  { id: 'account', label: '4. Conclusion of the Agreement and registering for an account' },
  { id: 'pms-functions', label: '5. Functions of the PIMS' },
  { id: 'developer-functions', label: '6. Functions for Developers' },
  { id: 'pet-owner-services', label: '7. Offering services to Pet Owners' },
  { id: 'our-responsibilities', label: '8. DuneXploration\u2019s responsibilities' },
  { id: 'access-rights', label: '9. SaaS access rights and licenses' },
  { id: 'customer-obligations', label: '10. Customer\u2019s obligations' },
  { id: 'technical-dependencies', label: '11. Technical dependencies and limitations' },
  { id: 'acceptable-use', label: '12. Acceptable use policy' },
  { id: 'fees', label: '13. Fees' },
  { id: 'warranty', label: '14. Warranty' },
  { id: 'liability', label: '15. Limitation of liability' },
  { id: 'confidentiality', label: '16. Confidentiality' },
  { id: 'name-and-logo', label: '17. Use of Customer name and logo' },
  { id: 'term-and-termination', label: '18. Term and termination' },
  { id: 'miscellaneous', label: '20. Miscellaneous' },
  { id: 'exhibit-a', label: 'Exhibit A: Support Services and Service Level Policy' },
  { id: 'exhibit-b', label: 'Exhibit B: Data Processing Agreement' },
  { id: 'appendix-1', label: 'Appendix 1: Standard Contractual Clauses' },
  { id: 'appendix-2', label: 'Appendix 2: Annex Standard Contractual Clauses' },
];

const TermsAndConditions = () => (
  <LegalDoc
    eyebrow="Legal"
    title="Terms and conditions"
    subtitle="The Yosemite Crew License and Subscription Terms (SaaS). These govern the hosted service. The self-hosting Software is governed only by its open-source licence."
    meta="Updated March 2026 · DuneXploration UG (haftungsbeschränkt), Mainz"
    toc={TOC}
  >
    <TermsBody />
    <TermsExhibitA />
    <TermsExhibitB />
    <TermsAppendix1 />
    <TermsAppendix2 />
  </LegalDoc>
);

export default TermsAndConditions;
