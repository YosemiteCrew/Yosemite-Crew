'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'definitions', label: '1. Definitions' },
  { id: 'scope', label: '2. Scope' },
  { id: 'overview', label: '3. Overview of the SaaS Services' },
  { id: 'account', label: '4. Registering an account' },
  { id: 'functions', label: '5. Functions of the PIMS' },
  { id: 'developers', label: '6. Functions for developers' },
  { id: 'p2b', label: '7. Offering services to pet owners (P2B transparency)' },
  { id: 'responsibilities', label: '8. Our responsibilities' },
  { id: 'rights', label: '9. Access rights and licences' },
  { id: 'obligations', label: '10. Your obligations' },
  { id: 'technical', label: '11. Technical requirements' },
  { id: 'fees', label: '12. Fees' },
  { id: 'customer-data', label: '13. Customer data' },
  { id: 'warranty', label: '14. Warranty' },
  { id: 'liability', label: '15. Limitation of liability' },
  { id: 'confidentiality', label: '16. Confidentiality' },
  { id: 'marks', label: '17. Use of name and logo' },
  { id: 'term', label: '18. Term and termination' },
  { id: 'law', label: '19. Governing law and jurisdiction' },
  { id: 'exhibits', label: 'Exhibit A (Service levels) and Exhibit B (Data Processing Agreement)' },
];

const TermsAndConditions = () => {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms and conditions"
      subtitle="The Yosemite Crew License and Subscription Terms (SaaS). These govern the hosted service. The self-hosting Software is governed only by its open-source licence."
      meta="Updated March 2026 · DuneXploration UG (haftungsbeschränkt), Mainz"
      toc={TOC}
    >
      <section id="definitions">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>1. Definitions</h2>
        <p>
          Key terms used throughout: <strong>Admin Account</strong> (the account you register, with
          the fullest rights), <strong>Business Owner</strong> and <strong>Developer</strong> (types
          of Customer), <strong>Customer Data</strong> (content and personal data you provide or
          generate through the service), <strong>SaaS Services</strong> (the hosted Yosemite Crew
          PIMS and developer marketplace), <strong>Software</strong> (the self-hosting version under
          an open-source licence), <strong>Mobile App</strong> (for Pet Owners), and{' '}
          <strong>DuneXploration</strong> (DuneXploration UG (haftungsbeschränkt), Am Finther Weg 7,
          55127 Mainz).
        </p>
      </section>

      <section id="scope">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>2. Scope</h2>
        <p>
          These Terms control the SaaS Services and prevail over conflicting terms.{' '}
          <strong>Licensing of the self-hosting Software is not covered here</strong> and is
          governed solely by its open-source licence. We do not accept customers&apos; own terms and
          conditions. An individual written agreement, where one exists, prevails over these Terms.
        </p>
      </section>

      <section id="overview">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>3. Overview of the SaaS Services</h2>
        <p>
          DuneXploration operates a flexible, scalable practice management system for Business
          Owners and marketplace tools for Developers. A separate Mobile App serves Pet Owners for
          booking and services, under its own terms. The service works anywhere with a good internet
          connection.
        </p>
      </section>

      <section id="account">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>4. Registering an account</h2>
        <p>
          Registration is free. You create an Admin Account, and the contract is concluded when you
          confirm your email. The person registering confirms they may act for the Customer. You
          must keep credentials confidential and report any suspected abuse. The agreement is
          concluded in English.
        </p>
      </section>

      <section id="functions">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>5. Functions of the PIMS</h2>
        <p>
          Depending on your business type, the PIMS provides an overview of business metrics, user
          management, clinic visibility options, appointment management, roles and permissions,
          inventory and procedure management, and billing and invoicing. We may add, change or
          remove functions but will keep the core available and notify you of changes.
        </p>
      </section>

      <section id="developers">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>6. Functions for developers</h2>
        <p>
          Developers can build plugins for the PIMS and sell them to Business Owners on the Digital
          Marketplace. The marketplace is under active development and details will follow.
        </p>
      </section>

      <section id="p2b">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          7. Offering services to pet owners (P2B transparency)
        </h2>
        <p>
          Where Business Owners make services visible to Pet Owners, we meet our obligations under
          the EU Platform-to-Business Regulation (EU) 2019/1150. Search results are ranked mainly by
          the{' '}
          <strong>
            services offered, location (where relevant), service hours, user ratings and business
            name
          </strong>
          . Ranking cannot be influenced by payments to us. After termination, we retain no
          identifiable Customer Data, though we may keep aggregated, anonymised data.
        </p>
      </section>

      <section id="responsibilities">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>8. Our responsibilities</h2>
        <p>
          We provide the technical resources and host the service up to our data-centre access
          point; you maintain your own internet access. Service levels are set out in Exhibit A. We
          maintain the environment, apply updates, provide support, and keep backups of the Customer
          Data we are required to retain.
        </p>
      </section>

      <section id="rights">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>9. Access rights and licences</h2>
        <p>
          During your subscription you get a non-exclusive, non-transferable, non-sublicensable
          right to use the SaaS Services for your internal business use. All other
          intellectual-property rights remain with DuneXploration. You may not reverse engineer the
          service, create derivative or substantially similar works, remove proprietary notices, or
          resell or transfer the rights granted.
        </p>
      </section>

      <section id="obligations">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>10. Your obligations</h2>
        <p>
          You allocate user accounts per your licence and ensure your use meets all statutory
          requirements, <strong>including maintaining a proper imprint</strong> and complying with
          consumer-protection and data-protection law. Use the service professionally and lawfully;
          do not harm third parties or us, compromise security, run penetration tests, attempt
          prompt-injection attacks, or pass off generated output as human-made.
        </p>
      </section>

      <section id="technical">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>11. Technical requirements</h2>
        <p>
          Current versions of Windows and macOS, and of Chrome, Firefox, Safari or Edge, are fully
          supported, with a sufficient broadband connection.
        </p>
      </section>

      <section id="fees">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>12. Fees</h2>
        <p>
          Fees are calculated as described on the website and invoiced at the end of each month, net
          of VAT. We may raise the underlying prices for the first time after 12 months, and only if
          our costs have risen by at least 20% year on year, with at least two months&apos; written
          notice. You may terminate within 30 days of such a notice, and we will tell you about this
          right each time.
        </p>
      </section>

      <section id="customer-data">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>13. Customer data</h2>
        <p>
          You own your Customer Data; we receive no ownership beyond what is needed to run the
          service. We may use aggregated, anonymised and de-identified information that cannot
          identify you, and access data for internal purposes such as support, administration and
          billing. You are responsible for having the rights and consents to provide the data and
          for its legality.
        </p>
      </section>

      <section id="warranty">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>14. Warranty</h2>
        <p>
          Statutory warranty applies, subject to the liability limits below. Claims to reduce fees
          lapse one year after the end of the calendar year in which they arose and you knew, or
          should have known, the relevant circumstances. We may briefly restrict access for
          scheduled maintenance under Exhibit A.
        </p>
      </section>

      <section id="liability">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>15. Limitation of liability</h2>
        <p>
          We are liable without limit for intent and gross negligence, for breach of a guarantee,
          for culpable injury to life, body or health, and under the German Product Liability Act.
          For ordinary negligence, we are liable only for breach of material contractual
          obligations, limited to typically foreseeable damage. In those cases our aggregate
          liability is capped at the greater of the fees paid in the prior 12 months or{' '}
          <strong>EUR 5,000</strong>. You are responsible for keeping regular backups of your data.
        </p>
      </section>

      <section id="confidentiality">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>16. Confidentiality</h2>
        <p>
          Each party protects the other&apos;s confidential information and does not disclose it,
          for ten years after disclosure, with the usual exceptions for information that becomes
          public, was already known, was independently developed, or must be disclosed by law.
        </p>
      </section>

      <section id="marks">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>17. Use of name and logo</h2>
        <p>
          You grant us a non-exclusive, royalty-free, worldwide licence to use your name, trademarks
          and logos on our website and in marketing materials.
        </p>
      </section>

      <section id="term">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>18. Term and termination</h2>
        <p>
          The agreement runs for the initial subscription term and renews automatically unless
          either party gives at least 30 days&apos; notice before the end of the term. Either party
          may terminate for cause, including an uncured material breach within 30 days of notice, or
          insolvency. Notices are given in writing, with email sufficing.
        </p>
      </section>

      <section id="law">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>19. Governing law and jurisdiction</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of Germany, excluding the UN
          Convention on Contracts for the International Sale of Goods and conflict-of-law rules. The
          courts of <strong>Mainz</strong> have exclusive jurisdiction.
        </p>
      </section>

      <section id="exhibits">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          Exhibit A (Service levels) and Exhibit B (Data Processing Agreement)
        </h2>
        <p>
          <strong>Exhibit A (Support and SLA):</strong> we target a monthly availability of 99.99%,
          excluding excused downtime, with severity-based response times and service-level credits,
          and support via email and Discord.
        </p>
        <p>
          <strong>Exhibit B (DPA):</strong> we process personal data as your processor under Art. 28
          GDPR, using the European Standard Contractual Clauses. Our sub-processors are Amazon Web
          Services EMEA (Luxembourg), Google Ireland, and Supabase, Inc. (Singapore). Data is
          encrypted with AES-256 at rest and TLS 1.3 in transit. The processor&apos;s data
          protection officer, Anna Upadhyay, can be reached at{' '}
          <a href="mailto:security@yosemitecrew.com">security@yosemitecrew.com</a>. The full Terms,
          Exhibits and Standard Contractual Clauses are available on request.
        </p>
      </section>
    </LegalDoc>
  );
};

export default TermsAndConditions;
