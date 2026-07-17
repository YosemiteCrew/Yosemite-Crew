'use client';

import { LegalDoc, DocSection, type TocEntry } from '@/app/features/marketing/site';

const TOC: readonly TocEntry[] = [
  { id: 'provider', label: 'Provider (Angaben gemäß § 5 DDG)' },
  { id: 'represented', label: 'Represented by' },
  { id: 'contact', label: 'Contact' },
  { id: 'register', label: 'Register entry' },
  { id: 'vat', label: 'VAT identification number' },
  { id: 'responsible', label: 'Responsible for content (§ 18 (2) MStV)' },
  { id: 'dispute', label: 'EU dispute resolution' },
  { id: 'trademark', label: 'Trademark' },
];

const Impressum = () => {
  return (
    <LegalDoc
      eyebrow="Legal notice"
      title="Impressum"
      subtitle="Legal notice and provider identification under § 5 DDG (Digitale-Dienste-Gesetz) and § 18 (2) MStV."
      meta="DuneXploration UG (haftungsbeschränkt), Mainz"
      toc={TOC}
    >
      <DocSection id="provider" title="Provider (Angaben gemäß § 5 DDG)">
        <p>
          DuneXploration UG (haftungsbeschränkt)
          <br />
          Am Finther Weg 7
          <br />
          55127 Mainz
          <br />
          Germany
        </p>
      </DocSection>

      <DocSection id="represented" title="Represented by">
        <p>Geschäftsführer: Ankit Upadhyay</p>
      </DocSection>

      <DocSection id="contact" title="Contact">
        <p>
          Telephone: <a href="tel:+4915227763275">+49 152 277 63275</a>
          <br />
          Email: <a href="mailto:support@yosemitecrew.com">support@yosemitecrew.com</a>
        </p>
      </DocSection>

      <DocSection id="register" title="Register entry">
        <p>Registered at Amtsgericht Mainz, HRB 52778.</p>
      </DocSection>

      <DocSection id="vat" title="VAT identification number">
        <p>VAT ID under § 27 a Umsatzsteuergesetz: DE367920596.</p>
      </DocSection>

      <DocSection
        id="responsible"
        title="
          Responsible for content (§ 18 (2) MStV)
        "
      >
        <p>Ankit Upadhyay, Am Finther Weg 7, 55127 Mainz, Germany.</p>
      </DocSection>

      <DocSection id="dispute" title="EU dispute resolution">
        <p>
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>
          {
            '. We are neither obliged nor willing to participate in dispute-resolution proceedings before a consumer arbitration board.'
          }
        </p>
      </DocSection>

      <DocSection id="trademark" title="Trademark">
        <p>
          Yosemite Crew™ is a trademark of DuneXploration UG (haftungsbeschränkt) in the EU,
          Australia, Great Britain, India, New Zealand and the USA. Third-party names and logos are
          the property of their respective owners.
        </p>
      </DocSection>
    </LegalDoc>
  );
};

export default Impressum;
