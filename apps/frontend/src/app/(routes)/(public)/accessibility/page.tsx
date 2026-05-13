import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/app/ui/widgets/Footer/Footer';

export const metadata: Metadata = {
  title: 'Accessibility Statement — Yosemite Crew',
  description:
    'Yosemite Crew accessibility statement. Our commitment to WCAG 2.2 Level AA and inclusive access.',
};

export default function AccessibilityPage() {
  return (
    <>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-display-2 text-text-primary mb-8">Accessibility Statement</h1>

        <section aria-labelledby="commitment-heading" className="mb-10">
          <h2 id="commitment-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Our commitment
          </h2>
          <p className="text-body-4 text-text-primary mb-3">
            Yosemite Crew is committed to making its digital services accessible to all users,
            including people with disabilities. We treat accessibility as an ongoing product,
            design, and engineering responsibility so veterinary teams and pet-care businesses can
            use our platform effectively across devices, regions, and assistive technologies.
          </p>
          <p className="text-body-4 text-text-primary">
            This statement was last reviewed on <time dateTime="2026-05-06">6 May 2026</time>.
          </p>
        </section>

        <section aria-labelledby="standard-heading" className="mb-10">
          <h2 id="standard-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Technical standard
          </h2>
          <p className="text-body-4 text-text-primary mb-3">
            We target conformance with{' '}
            <a
              href="https://www.w3.org/TR/WCAG22/"
              className="text-text-brand underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              WCAG 2.2 Level AA
            </a>{' '}
            as our product standard. Our accessibility statement structure follows W3C/WAI guidance
            for accessibility statements and focuses on clear conformance status, known limitations,
            and a direct feedback path.
          </p>
          <p className="text-body-4 text-text-primary">
            Conformance is assessed through automated tooling, manual keyboard checks, screen-reader
            review, design review, and code review during product development.
          </p>
        </section>

        <section aria-labelledby="status-heading" className="mb-10">
          <h2 id="status-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Conformance status
          </h2>
          <p className="text-body-4 text-text-primary mb-3">
            <strong>Partially conformant.</strong> Some parts of the content do not fully conform to
            WCAG 2.2 AA. We are actively remediating issues in a phased programme. Known remaining
            gaps include:
          </p>
          <ul className="list-disc pl-6 text-body-4 text-text-primary space-y-1">
            <li>Some data tables in operational views lack sort semantics.</li>
            <li>Certain third-party embedded surfaces (Stripe, IDEXX) are outside our control.</li>
            <li>Colour contrast in some legacy marketing components is under review.</li>
            <li>Some older workflows are still being reviewed for screen-reader clarity.</li>
          </ul>
        </section>

        <section aria-labelledby="measures-heading" className="mb-10">
          <h2 id="measures-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Measures we take
          </h2>
          <ul className="list-disc pl-6 text-body-4 text-text-primary space-y-1">
            <li>
              Use semantic HTML, labelled form controls, landmarks, and keyboard-accessible
              controls.
            </li>
            <li>Maintain reusable UI components with accessibility tests where practical.</li>
            <li>
              Run automated checks with axe-core in targeted tests for key components and flows.
            </li>
            <li>
              Review focus states, colour contrast, responsive layouts, and error messaging during
              UI changes.
            </li>
          </ul>
        </section>

        <section aria-labelledby="feedback-heading" className="mb-10">
          <h2 id="feedback-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Report an accessibility barrier
          </h2>
          <p className="text-body-4 text-text-primary mb-3">
            If you encounter an accessibility barrier on any part of our service, please contact us
            so we can address it:
          </p>
          <ul className="list-none text-body-4 text-text-primary space-y-2">
            <li>
              <Link href="/accessibility/report" className="text-text-brand underline">
                Use our accessibility barrier report form
              </Link>
            </li>
            <li>
              Email:{' '}
              <a href="mailto:accessibility@yosemitecrew.com" className="text-text-brand underline">
                accessibility@yosemitecrew.com
              </a>
            </li>
            <li>
              Support:{' '}
              <a href="mailto:support@yosemitecrew.com" className="text-text-brand underline">
                support@yosemitecrew.com
              </a>
            </li>
          </ul>
          <p className="text-body-4 text-text-primary mt-3">
            We aim to respond to accessibility reports within 5 business days.
          </p>
        </section>

        <section aria-labelledby="formats-heading" className="mb-10">
          <h2 id="formats-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Alternative formats and support
          </h2>
          <p className="text-body-4 text-text-primary mb-3">
            If you need information from Yosemite Crew in a different format, or if a workflow is
            difficult to complete with assistive technology, contact us using the report form or
            email address above. We will work with you to provide a reasonable alternative and use
            the report to improve the product.
          </p>
        </section>

        <section aria-labelledby="thirdparty-heading" className="mb-10">
          <h2 id="thirdparty-heading" className="text-body-1-emphasis text-text-primary mb-3">
            Third-party content
          </h2>
          <p className="text-body-4 text-text-primary">
            Our service integrates third-party surfaces including Stripe (payment processing), IDEXX
            (diagnostics workspace), and Merck Manuals (medical reference). Accessibility compliance
            of these surfaces is subject to those providers&apos; own conformance programmes. We
            document known third-party gaps and raise accessibility requirements with our providers
            where contractually possible.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
