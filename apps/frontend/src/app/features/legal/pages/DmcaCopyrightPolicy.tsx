import React from 'react';
import './DmcaCopyrightPolicy.css';

const DMCA_EMAIL = 'dmca@yosemitecrew.com';

const takedownRequirements = [
  {
    label: 'Your signature',
    text: 'A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.',
  },
  {
    label: 'Identification of the copyrighted work',
    text: 'A description of the copyrighted work you claim has been infringed. If multiple works are covered by a single notice, a representative list is acceptable.',
  },
  {
    label: 'Identification of the infringing material',
    text: 'The specific URL or location on Yosemite Crew containing the allegedly infringing material.',
  },
  {
    label: 'Your contact information',
    text: 'Your name, mailing address, telephone number, and email address.',
  },
  {
    label: 'Good faith statement',
    text: 'A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.',
  },
  {
    label: 'Accuracy statement',
    text: "A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or are authorized to act on the copyright owner's behalf.",
  },
];

const DmcaCopyrightPolicy = () => {
  return (
    <main className="DmcaPolicySec">
      <div className="DmcaPolicyData">
        <header className="DmcaPolicyHead">
          <p className="DmcaPolicyEyebrow">Copyright policy</p>
          <h1>DMCA Copyright Policy</h1>
          <div className="DmcaPolicyMetaRow">
            <span>Effective date: 28.9.2024</span>
            <span className="DmcaPolicyMetaSeparator" aria-hidden="true" />
            <span>Last updated: June 2026</span>
          </div>
          <p className="DmcaPolicyLead">
            Yosemite Crew respects intellectual property rights and expects users of our services to
            do the same. This policy explains how Yosemite Crew handles copyright infringement
            claims and how rights holders and users can interact with us regarding copyright
            concerns.
          </p>
          <p className="DmcaPolicyLead">
            This policy is designed to help rights holders submit notices of claimed copyright
            infringement under the Digital Millennium Copyright Act, 17 U.S.C. § 512
            (&quot;DMCA&quot;).
          </p>
        </header>

        <div className="DmcaPolicyContent">
          <section className="DmcaPolicySection" aria-labelledby="dmca-reporting">
            <h2 id="dmca-reporting">Reporting Copyright Infringement</h2>
            <p>
              If you believe that content on Yosemite Crew infringes your copyright, you may submit
              a DMCA takedown notice to our copyright agent.
            </p>
            <div className="DmcaAgentCard" aria-label="Copyright agent">
              <h3>Copyright Agent</h3>
              <p>DuneXploration UG (haftungsbeschränkt)</p>
              <p>Am Finther Weg 7</p>
              <p>Mainz, 55127</p>
              <p>Germany</p>
              <p>
                Email:{' '}
                <a className="DmcaPolicyLink" href={`mailto:${DMCA_EMAIL}`}>
                  {DMCA_EMAIL}
                </a>
              </p>
            </div>
          </section>

          <section className="DmcaPolicySection" aria-labelledby="dmca-notice-requirements">
            <h2 id="dmca-notice-requirements">Required Elements of a Takedown Notice</h2>
            <p>
              To be valid under 17 U.S.C. § 512(c)(3), your notice must include all of the following
              in the given order:
            </p>
            <ol>
              {takedownRequirements.map((requirement) => (
                <li key={requirement.label}>
                  <strong>{requirement.label}</strong>
                  {' - '}
                  {requirement.text}
                </li>
              ))}
            </ol>
            <p className="DmcaNoticeCard">
              Please be aware that, under 17 U.S.C. § 512(f), any person who knowingly materially
              misrepresents that material is infringing may be subject to liability for damages,
              including costs and attorneys&apos; fees.
            </p>
          </section>

          <section className="DmcaPolicySection" aria-labelledby="dmca-submit">
            <h2 id="dmca-submit">How to Submit</h2>
            <p>
              Email your complete notice to{' '}
              <a className="DmcaPolicyLink" href={`mailto:${DMCA_EMAIL}`}>
                {DMCA_EMAIL}
              </a>
              {
                '. Use the subject line "DMCA Notice - Attn: Copyright Agent." We process notices received at that address only. Notices sent elsewhere may not be reviewed promptly.'
              }
            </p>
          </section>

          <section className="DmcaPolicySection" aria-labelledby="dmca-questions">
            <h2 id="dmca-questions">Questions</h2>
            <p>
              If you have questions about this policy, please contact us at{' '}
              <a className="DmcaPolicyLink" href={`mailto:${DMCA_EMAIL}`}>
                {DMCA_EMAIL}
              </a>
              {'.'}
            </p>
            <p>
              This policy applies to content hosted on Yosemite Crew&apos;s platform. Yosemite Crew
              is not a law firm and this page does not constitute legal advice. We encourage you to
              consult an attorney if you have questions about your specific situation.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default DmcaCopyrightPolicy;
