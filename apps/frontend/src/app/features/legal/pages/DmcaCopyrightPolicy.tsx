'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'reporting', label: 'Reporting copyright infringement' },
  { id: 'requirements', label: 'Required elements of a takedown notice' },
  { id: 'submit', label: 'How to submit' },
  { id: 'questions', label: 'Questions' },
];

const DmcaCopyrightPolicy = () => {
  return (
    <LegalDoc
      eyebrow="Copyright policy"
      title="DMCA Copyright Policy"
      subtitle="Yosemite Crew respects intellectual property and expects users to do the same. This explains how we handle copyright claims and how rights holders and users can reach us."
      meta="Effective 28 September 2024 · Last updated June 2026"
      toc={TOC}
    >
      <section id="reporting">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Reporting copyright infringement</h2>
        <p>
          This policy helps rights holders submit notices of claimed copyright infringement under
          the Digital Millennium Copyright Act, 17 U.S.C. § 512 (&quot;DMCA&quot;). If you believe
          content on Yosemite Crew infringes your copyright, you may submit a takedown notice to our
          copyright agent.
        </p>
        <div
          style={{
            border: '1px solid #e5dccf',
            borderRadius: 18,
            padding: '20px 22px',
            background: '#efe8dc',
            maxWidth: 460,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#a9a39e',
              marginBottom: 10,
            }}
          >
            Copyright agent
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.6, color: '#302f2e' }}>
            DuneXploration UG (haftungsbeschränkt)
            <br />
            Am Finther Weg 7
            <br />
            Mainz, 55127
            <br />
            Germany
            <br />
            Email: <a href="mailto:dmca@yosemitecrew.com">dmca@yosemitecrew.com</a>
          </div>
        </div>
      </section>

      <section id="requirements">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          Required elements of a takedown notice
        </h2>
        <p>
          To be valid under 17 U.S.C. § 512(c)(3), your notice must include all of the following, in
          this order:
        </p>
        <ul>
          <li>
            <strong>Your signature</strong>, physical or electronic, as the copyright owner or a
            person authorised to act for them.
          </li>
          <li>
            <strong>Identification of the copyrighted work</strong> you claim has been infringed. A
            representative list is acceptable where one notice covers several works.
          </li>
          <li>
            <strong>Identification of the infringing material</strong>, with the specific URL or
            location on Yosemite Crew.
          </li>
          <li>
            <strong>Your contact information</strong>: name, mailing address, telephone number and
            email.
          </li>
          <li>
            <strong>A good-faith statement</strong> that the use is not authorised by the owner, its
            agent or the law.
          </li>
          <li>
            <strong>An accuracy statement</strong>, under penalty of perjury, that the information
            is accurate and that you are the owner or authorised to act for them.
          </li>
        </ul>
        <p>
          Under 17 U.S.C. § 512(f), anyone who knowingly materially misrepresents that material is
          infringing may be liable for damages, including costs and attorneys&apos; fees.
        </p>
      </section>

      <section id="submit">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>How to submit</h2>
        <p>
          Email your complete notice to{' '}
          <a href="mailto:dmca@yosemitecrew.com">dmca@yosemitecrew.com</a> with the subject line{' '}
          <strong>&quot;DMCA Notice - Attn: Copyright Agent.&quot;</strong> We process notices
          received at that address only; notices sent elsewhere may not be reviewed promptly.
        </p>
      </section>

      <section id="questions">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Questions</h2>
        <p>
          Questions about this policy? Contact{' '}
          <a href="mailto:dmca@yosemitecrew.com">dmca@yosemitecrew.com</a>. This policy applies to
          content hosted on Yosemite Crew&apos;s platform. Yosemite Crew is not a law firm and this
          page is not legal advice; please consult an attorney about your specific situation.
        </p>
      </section>
    </LegalDoc>
  );
};

export default DmcaCopyrightPolicy;
