'use client';

import Link from 'next/link';
import { LegalDoc, DocSection, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'commitment', label: 'Our commitment' },
  { id: 'standard', label: 'Technical standard' },
  { id: 'status', label: 'Conformance status' },
  { id: 'measures', label: 'Measures we take' },
  { id: 'report', label: 'Report an accessibility barrier' },
  { id: 'alternatives', label: 'Alternative formats and support' },
  { id: 'third-party', label: 'Third-party content' },
];

const AccessibilityStatement = () => {
  return (
    <LegalDoc
      eyebrow="Accessibility"
      title="Accessibility Statement"
      subtitle="A system that only some people can use is not really open. Yosemite Crew is committed to making its digital services accessible to everyone, and we tell you honestly where we are on the way."
      meta="Last reviewed 6 May 2026 · Target: WCAG 2.2 Level AA"
      toc={TOC}
    >
      <DocSection id="commitment" title="Our commitment">
        <p>
          We treat accessibility as an ongoing product, design and engineering responsibility, so
          veterinary teams and pet-care businesses can use our platform effectively across devices,
          regions and assistive technologies.
        </p>
      </DocSection>

      <DocSection id="standard" title="Technical standard">
        <p>
          We target conformance with{' '}
          <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener noreferrer">
            WCAG 2.2 Level AA
          </a>{' '}
          as our product standard, and this statement follows W3C/WAI guidance. Conformance is
          assessed through automated tooling, manual keyboard checks, screen-reader review, design
          review and code review during development.
        </p>
      </DocSection>

      <DocSection id="status" title="Conformance status">
        <p>
          <strong>Partially conformant.</strong> Some content does not yet fully conform to WCAG 2.2
          AA, and we are remediating in a phased programme. Known remaining gaps include:
        </p>
        <ul>
          <li>Some data tables in operational views lack sort semantics.</li>
          <li>Certain third-party embedded surfaces (Stripe, IDEXX) are outside our control.</li>
          <li>Colour contrast in some legacy marketing components is under review.</li>
          <li>Some older workflows are still being reviewed for screen-reader clarity.</li>
        </ul>
      </DocSection>

      <DocSection id="measures" title="Measures we take">
        <ul>
          <li>
            Semantic HTML, labelled form controls, landmarks and keyboard-accessible controls.
          </li>
          <li>Reusable UI components with accessibility tests where practical.</li>
          <li>Automated checks with axe-core in targeted tests for key components and flows.</li>
          <li>
            Review of focus states, colour contrast, responsive layouts and error messaging during
            UI changes.
          </li>
        </ul>
      </DocSection>

      <DocSection id="report" title="Report an accessibility barrier">
        <p>
          If you encounter a barrier on any part of our service, please tell us so we can address
          it:
        </p>
        <ul>
          <li>
            Use our <Link href="/accessibility/report">accessibility barrier report form</Link>.
          </li>
          <li>
            Email <a href="mailto:accessibility@yosemitecrew.com">accessibility@yosemitecrew.com</a>
            {'.'}
          </li>
          <li>
            Support: <a href="mailto:support@yosemitecrew.com">support@yosemitecrew.com</a>.
          </li>
        </ul>
        <p>We aim to respond to accessibility reports within 5 business days.</p>
      </DocSection>

      <DocSection id="alternatives" title="Alternative formats and support">
        <p>
          If you need information in a different format, or a workflow is difficult to complete with
          assistive technology, contact us using the form or email above. We will work with you to
          provide a reasonable alternative and use the report to improve the product.
        </p>
      </DocSection>

      <DocSection id="third-party" title="Third-party content">
        <p>
          Our service integrates third-party surfaces including Stripe (payments), IDEXX
          (diagnostics workspace) and Merck Manuals (medical reference). The accessibility of these
          surfaces is subject to those providers&apos; own conformance programmes. We document known
          gaps and raise accessibility requirements with our providers where contractually possible.
        </p>
      </DocSection>
    </LegalDoc>
  );
};

export default AccessibilityStatement;
