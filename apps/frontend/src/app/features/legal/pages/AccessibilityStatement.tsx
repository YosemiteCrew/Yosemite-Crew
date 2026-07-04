'use client';

import Link from 'next/link';
import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';

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
      <section id="commitment">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Our commitment</h2>
        <p>
          We treat accessibility as an ongoing product, design and engineering responsibility, so
          veterinary teams and pet-care businesses can use our platform effectively across devices,
          regions and assistive technologies.
        </p>
      </section>

      <section id="standard">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Technical standard</h2>
        <p>
          We target conformance with{' '}
          <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener">
            WCAG 2.2 Level AA
          </a>{' '}
          as our product standard, and this statement follows W3C/WAI guidance. Conformance is
          assessed through automated tooling, manual keyboard checks, screen-reader review, design
          review and code review during development.
        </p>
      </section>

      <section id="status">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Conformance status</h2>
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
      </section>

      <section id="measures">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Measures we take</h2>
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
      </section>

      <section id="report">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Report an accessibility barrier</h2>
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
            .
          </li>
          <li>
            Support: <a href="mailto:support@yosemitecrew.com">support@yosemitecrew.com</a>.
          </li>
        </ul>
        <p>We aim to respond to accessibility reports within 5 business days.</p>
      </section>

      <section id="alternatives">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Alternative formats and support</h2>
        <p>
          If you need information in a different format, or a workflow is difficult to complete with
          assistive technology, contact us using the form or email above. We will work with you to
          provide a reasonable alternative and use the report to improve the product.
        </p>
      </section>

      <section id="third-party">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Third-party content</h2>
        <p>
          Our service integrates third-party surfaces including Stripe (payments), IDEXX
          (diagnostics workspace) and Merck Manuals (medical reference). The accessibility of these
          surfaces is subject to those providers&apos; own conformance programmes. We document known
          gaps and raise accessibility requirements with our providers where contractually possible.
        </p>
      </section>
    </LegalDoc>
  );
};

export default AccessibilityStatement;
