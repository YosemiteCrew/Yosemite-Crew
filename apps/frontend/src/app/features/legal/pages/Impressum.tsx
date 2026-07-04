'use client';

import { LegalDoc, type TocEntry } from '@/app/features/marketing/site';

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
      <section id="provider">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Provider (Angaben gemäß § 5 DDG)</h2>
        <p>
          DuneXploration UG (haftungsbeschränkt)
          <br />
          Am Finther Weg 7
          <br />
          55127 Mainz
          <br />
          Germany
        </p>
      </section>

      <section id="represented">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Represented by</h2>
        <p>Geschäftsführer: Ankit Upadhyay</p>
      </section>

      <section id="contact">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Contact</h2>
        <p>
          Telephone: <a href="tel:+4915227763275">+49 152 277 63275</a>
          <br />
          Email: <a href="mailto:support@yosemitecrew.com">support@yosemitecrew.com</a>
        </p>
      </section>

      <section id="register">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Register entry</h2>
        <p>Registered at Amtsgericht Mainz, HRB 52778.</p>
      </section>

      <section id="vat">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>VAT identification number</h2>
        <p>VAT ID under § 27 a Umsatzsteuergesetz: DE367920596.</p>
      </section>

      <section id="responsible">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>
          Responsible for content (§ 18 (2) MStV)
        </h2>
        <p>Ankit Upadhyay, Am Finther Weg 7, 55127 Mainz, Germany.</p>
      </section>

      <section id="dispute">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>EU dispute resolution</h2>
        <p>
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener">
            https://ec.europa.eu/consumers/odr/
          </a>
          . We are neither obliged nor willing to participate in dispute-resolution proceedings
          before a consumer arbitration board.
        </p>
      </section>

      <section id="trademark">
        <h2 style={{ fontFamily: 'var(--font-newsreader)' }}>Trademark</h2>
        <p>
          Yosemite Crew™ is a trademark of DuneXploration UG (haftungsbeschränkt) in the EU,
          Australia, Great Britain, India, New Zealand and the USA. Third-party names and logos are
          the property of their respective owners.
        </p>
      </section>
    </LegalDoc>
  );
};

export default Impressum;
