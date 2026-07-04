'use client';

import Link from 'next/link';
import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'controller', label: '1. Controller and Data Protection Officer' },
  { id: 'roles', label: '2. Our role regarding your data' },
  { id: 'processing', label: '3. What we process, and why' },
  { id: 'analytics', label: '4. Analytics (PostHog)' },
  { id: 'recipients', label: '5. Recipients and subprocessors' },
  { id: 'transfers', label: '6. International transfers' },
  { id: 'storage', label: '7. Storage periods' },
  { id: 'automated', label: '8. Automated decisions' },
  { id: 'rights', label: '9. Your rights' },
  { id: 'objection', label: '10. Right to object and to withdraw consent' },
  { id: 'contact', label: '11. Questions and comments' },
];

const PrivacyPolicy = () => {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy policy"
      subtitle="The protection and security of your personal data matters to us. This describes how our open-source practice management software collects, processes and stores personal data, as a web app and a mobile app."
      meta="Updated March 2026 · Controller: DuneXploration UG (haftungsbeschränkt), Mainz"
      toc={TOC}
    >
      <section id="controller">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          1. Controller and Data Protection Officer
        </h2>
        <p>
          <strong>The controller is:</strong>
          <br />
          DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7, 55127 Mainz, Germany.
          <br />
          Email: <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>
        </p>
        <p>
          <strong>Our data protection officer</strong> can be reached at the same address, by email
          to <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>.
        </p>
      </section>

      <section id="roles">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>2. Our role regarding your data</h2>
        <p>
          Under the GDPR, the controller determines the purposes and means of processing, and a
          processor processes data on the controller&apos;s behalf. Depending on the activity,
          DuneXploration acts as either.
        </p>
        <ul>
          <li>
            DuneXploration is the <strong>controller</strong> when it decides how and why your data
            is processed, for example when you create an account.
          </li>
          <li>
            Pet service providers (clinics, breeders, groomers, hospitals) are controllers when they
            manage their interactions with you, such as appointments, invoices and prescriptions,
            and Yosemite Crew acts as their <strong>processor</strong>.
          </li>
        </ul>
        <p>
          Either way, we take appropriate measures to protect the confidentiality of the data we
          process, in line with the GDPR and German law.
        </p>
      </section>

      <section id="processing">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>3. What we process, and why</h2>
        <h3>Hosting and provision</h3>
        <p>
          The software can be self-hosted or run in our cloud. If you use our cloud, we temporarily
          process your{' '}
          <strong>
            IP address, date and time of access, browser type and version, and operating system
          </strong>{' '}
          to keep it available and secure. <strong>Legal basis:</strong> our legitimate interest in
          the technical functionality and security of the software (Art. 6(1)(f) GDPR).{' '}
          <strong>Storage:</strong> log data is deleted after 7 days.
        </p>
        <h3>Accounts and profiles</h3>
        <p>
          To register a clinic or a pet parent we process details such as name, work email, business
          name and type, address, professional background and licence, or for pet parents your name,
          email, phone and user type. <strong>Legal basis:</strong> establishing the user
          relationship (Art. 6(1)(b)), and consent for voluntary profile details (Art. 6(1)(a)).{' '}
          <strong>Storage:</strong> for as long as your account exists, then deleted unless
          statutory retention applies.
        </p>
        <h3>Using the product</h3>
        <p>
          To run appointments, records, prescriptions, invoices, health logs and tasks, we process
          the information you enter and data generated in use. <strong>Legal basis:</strong>{' '}
          performance of the user contract (Art. 6(1)(b)) and our legitimate interest (Art.
          6(1)(f)).
        </p>
        <h3>Communications</h3>
        <p>
          Messages, attachments and pet context sent between clinics, teams and pet parents are
          processed to enable that communication. <strong>Legal basis:</strong> Art. 6(1)(b).{' '}
          <strong>Storage:</strong> until the conversation or account is deleted, subject to
          statutory retention.
        </p>
        <h3>Health records</h3>
        <p>
          To let you record, track and share a pet&apos;s medical information, we process medical
          records, health logs and notes. <strong>Legal basis:</strong> our legitimate interest in
          these purposes (Art. 6(1)(f)). <strong>Storage:</strong> while the pet profile exists,
          deleted on request or account removal.
        </p>
        <h3>Payments</h3>
        <p>
          Clinics use their own preferred payment providers, and payment happens directly through
          them. <strong>DuneXploration does not process any payment data.</strong>
        </p>
      </section>

      <section id="analytics">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>4. Analytics (PostHog)</h2>
        <p>
          To understand how the product is used and improve it, we use <strong>PostHog</strong> for
          privacy-friendly product analytics on our hosted service. We keep this to aggregate,
          product-improvement insights and do not run advertising trackers or sell data.
        </p>
        <p>
          <strong>Legal basis:</strong> your consent (Art. 6(1)(a) GDPR), which we request through
          the cookie notice and which you can withdraw at any time with future effect. If you reject
          non-essential cookies, analytics is not loaded.
        </p>
      </section>

      <section id="recipients">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>5. Recipients and subprocessors</h2>
        <p>
          Where necessary, your data may be shared with the following processors, bound by
          data-processing agreements:
        </p>
        <ul>
          <li>
            Amazon Web Services EMEA SARL, 38 Avenue John F. Kennedy, L-1855, Luxembourg (EU).
          </li>
          <li>Google Cloud EMEA Ltd., 70 Sir John Rogerson&apos;s Quay, Dublin 2, Ireland (EU).</li>
          <li>Supabase, Inc., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513.</li>
          <li>PostHog, for product analytics (EU hosting), where you have consented.</li>
          <li>
            Your chosen pet service provider, identity provider (Google, Apple, Meta) or payment
            provider, where you use them.
          </li>
        </ul>
      </section>

      <section id="transfers">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>6. International transfers</h2>
        <p>
          Where a recipient sits outside the EEA and no adequacy decision applies (for example
          Supabase in Singapore), we put appropriate safeguards in place, in particular the European
          Commission&apos;s{' '}
          <a
            href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj"
            target="_blank"
            rel="noopener"
          >
            Standard Contractual Clauses
          </a>
          {', to ensure an adequate level of protection.'}
        </p>
      </section>

      <section id="storage">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>7. Storage periods</h2>
        <p>
          We keep data for the periods described above. Where data serves more than one purpose, the
          longest applicable period applies, after which it is deleted. Booking and billing data is
          kept for the statutory retention periods (6 years under the HGB, 10 years under the AO).
        </p>
      </section>

      <section id="automated">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>8. Automated decisions</h2>
        <p>
          We do not use automated decision-making that produces legal effects on you or similarly
          significantly affects you. You are not obliged to provide data, but some is needed to
          create an account or use the service.
        </p>
      </section>

      <section id="rights">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>9. Your rights</h2>
        <p>Subject to the legal requirements, you have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> your data (Art. 15 GDPR).
          </li>
          <li>
            <strong>Rectification</strong> of inaccurate or incomplete data (Art. 16).
          </li>
          <li>
            <strong>Erasure</strong> (Art. 17).
          </li>
          <li>
            <strong>Restriction</strong> of processing (Art. 18).
          </li>
          <li>
            <strong>Data portability</strong>, in a structured, common, machine-readable format
            (Art. 20).
          </li>
          <li>
            <strong>Lodge a complaint</strong> with a supervisory authority (Art. 77 GDPR with § 19
            BDSG), in particular in your country of residence, workplace or place of the alleged
            infringement.
          </li>
        </ul>
        <p>
          To exercise any of these, use the <Link href="/contact-us">data request form</Link> or
          email <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>.
        </p>
      </section>

      <section id="objection">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          10. Right to object and to withdraw consent
        </h2>
        <p>
          You may object at any time, on grounds relating to your particular situation, to
          processing based on our legitimate interest. If you do, we stop unless we can show
          compelling legitimate grounds that override your interests, or the processing is for
          establishing or defending legal claims. Where we process for direct marketing, you can
          object at any time.
        </p>
        <p>
          You can <strong>withdraw any consent</strong> (including analytics) at any time with
          future effect, via any contact address known to you.
        </p>
      </section>

      <section id="contact">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>11. Questions and comments</h2>
        <p>
          For any question about the collection, processing or use of your data, or to request
          information, correction, restriction or deletion, or to withdraw consent, contact{' '}
          <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>.
        </p>
      </section>
    </LegalDoc>
  );
};

export default PrivacyPolicy;
