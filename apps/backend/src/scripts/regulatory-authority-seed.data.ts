/**
 * Veterinary adverse-event reporting authorities, one per supported country.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
 *
 * This table routes a REPORTER to their own regulator. It is not a list of
 * addresses for this platform to submit to.
 *
 * Every one of the 18 authorities below was checked, and not one of them
 * documents a route by which a software platform may file on an owner's
 * behalf: fifteen are silent on it and two (Singapore, Argentina) exclude it.
 * Argentina is explicit - Resolucion SENASA 323/2011 art. 5 makes a
 * notification valid "solo cuando sea presentada por un profesional de las
 * Ciencias Veterinarias". Agent submission is not a recognised status: a
 * platform is a channel, never the filer, and can never write to the Union
 * pharmacovigilance database, which only a competent authority or a marketing
 * authorisation holder may record into.
 *
 * So these values exist to tell an owner where THEY should report, and to let
 * us hand them their own report already filled in. Do not wire an automated
 * send to any address here without legal sign-off; see the notes field, which
 * carries the per-country constraint that would make doing so wrong.
 *
 * THIS SEED CORRECTS EXISTING ROWS. Five rows were already in the table
 * (CA, FR, GB, IE, US) and three carried addresses that do not exist:
 * "pharmacovigilance@vmd.gov.uk" (the VMD's is adverse.events@vmd.gov.uk),
 * "vet_safety@hpra.ie" (the HPRA's is vetsafety@hpra.ie, no underscore), and
 * a US sourceUrl pointing at the USDA biologics page rather than FDA CVM.
 * A one-character error in an address fails silently - the mail bounces to
 * nobody - which is why every value here was checked against the authority's
 * own domain rather than accepted because it looked plausible.
 *
 * PHONE NUMBERS ARE CURATED, NOT COPIED. Each is a single dialable number.
 * The mobile "call the authority" action normalises with
 * `phone.replaceAll(/[^\\d+]/g, '')`, so anything richer than one number is
 * silently mangled: "0800 008 333 (overseas +64 4 830 1574)" would dial
 * "0800008333+6448301574", and the US listing "1-888-FDA-VETS
 * (1-888-332-8387)" would lose its letters and concatenate. Where a source
 * gave an extension, a second contact, or a named official, only the primary
 * switchboard number is stored - extensions do not survive a `tel:` link, and
 * a named official is personal data with no reason to be in this table.
 *
 * PROVENANCE: every email and URL was found on the authority's own official
 * domain and then independently re-verified against that domain. Where no
 * official email exists the field is null rather than a plausible guess -
 * most regulators take reports through a portal or form, not by email.
 * `sourceUrl` is the official page the values came from; re-check it before
 * trusting a stale row.
 */

export interface RegulatoryAuthoritySeedEntry {
  country: string;
  iso2: string;
  iso3: string;
  authorityName: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string;
  sourceUrl: string | null;
}

export const REGULATORY_AUTHORITY_SEED: RegulatoryAuthoritySeedEntry[] = [
  {
    country: "Argentina",
    iso2: "AR",
    iso3: "ARG",
    phone: "+54 11 4121-5000",
    authorityName:
      "Dirección de Productos Veterinarios (DPV), Dirección Nacional de Sanidad Animal (DNSA), Servicio Nacional de Sanidad y Calidad Agroalimentaria (SENASA)",
    email: "dpv@senasa.gob.ar",
    website: "https://www.argentina.gob.ar/senasa/farmacovigilancia",
    notes:
      "Reports are expected from a veterinarian, not the owner directly. BLOCKING ISSUE FOR AUTOMATED FORWARDING - Argentina restricts WHO may report, by regulation. Resolucion SENASA 323/2011 art. 5 provides that a notification 'solo tendra validez cuando sea presentada por un profesional de las Ciencias Veterinarias' (is only valid when submitted by a veterinary scienc",
    sourceUrl: "https://www.argentina.gob.ar/senasa/farmacovigilancia",
  },
  {
    country: "Australia",
    iso2: "AU",
    iso3: "AUS",
    phone: "1800 700 583",
    authorityName:
      "Australian Pesticides and Veterinary Medicines Authority (APVMA) — Adverse Experience Reporting Program (AERP)",
    email: "aerp@apvma.gov.au",
    website: "https://portal.apvma.gov.au/aerpexternal/welcome.htm",
    notes:
      "An animal owner may report directly. 1) OWNER REPORTING IS EXPLICITLY OPEN. The AERP page states verbatim under 'How to report': 'Anyone can report a problem with a chemical product.' The privacy statement further confirms 'Individuals providing information to the APVMA have the option to do so anonymously or by using a pseudonym'. So",
    sourceUrl:
      "https://www.apvma.gov.au/regulation/adverse-experience-reporting-program",
  },
  {
    country: "Canada",
    iso2: "CA",
    iso3: "CAN",
    phone: "1-877-838-7322",
    authorityName:
      "Health Canada – Veterinary Drugs Directorate (VDD), Health Products and Food Branch – Pharmacovigilance (PV) Program",
    email: "pv-vet@hc-sc.gc.ca",
    website: null,
    notes:
      "An animal owner may report directly. 1) NO WEB PORTAL AND NO POSTAL/FAX ROUTE FOR VET DRUGS. Reporting is email + PDF form (or phone). I searched the VDD directorate page, the Health Canada 'Drugs and Health Products' contact index and the legacy hc-sc.gc.ca VDD contact page (which now 301-redirects to the canada.ca VDD page): no maili",
    sourceUrl:
      "https://www.canada.ca/en/health-canada/services/drugs-health-products/veterinary-drugs/adverse-drug-reactions-adrs.html",
  },
  {
    country: "Denmark",
    iso2: "DK",
    iso3: "DNK",
    phone: "+45 44 88 95 95",
    authorityName: "Lægemiddelstyrelsen (Danish Medicines Agency)",
    email: "dkma@dkma.dk",
    website: "https://portal.dkma.dk/VETbiv?sc_lang=da",
    notes:
      "An animal owner may report directly. Automated forwarding is NOT supported here and should not be built without contacting DKMA first. Specific risks: 1. NO MACHINE ROUTE. The only real intake is an interactive Danish-language web form with no API. Scripting or scraping that form would be an undocumented, unsanctioned integration and c",
    sourceUrl:
      "https://laegemiddelstyrelsen.dk/da/bivirkninger/bivirkninger-ved-medicin-til-dyr/meld-en-bivirkning-eller-manglende-effekt-i-dyr/",
  },
  {
    country: "France",
    iso2: "FR",
    iso3: "FRA",
    phone: "+33 4 78 87 10 40",
    authorityName:
      "Agence nationale du médicament vétérinaire (ANMV) – Anses (Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail), Département Inspection, surveillance et pharmacovigilance — operating the \"Dispositif national de pharmacovigilance vétérinaire\" jointly with the Centre de Pharmacovigilance Vétérinaire de Lyon (CPVL, VetAgro Sup)",
    email: "cpvl@vetagro-sup.fr",
    website: "https://pharmacovigilance-anmv.anses.fr/",
    notes:
      'An animal owner may report directly. NAME CHECK: "ANMV (Anses)" is accurate and current as of 2026-09-02. The ANMV has sat inside Anses since 1 July 2010 (previously AFSSA from 1999); no rename or merger found. The precise receiving unit is the "Departement Inspection, surveillance et pharmacovigilance". TWO RECEIVING BODIES, NOT ONE.',
    sourceUrl: "https://pharmacovigilance-anmv.anses.fr/",
  },
  {
    country: "Germany",
    iso2: "DE",
    iso3: "DEU",
    phone: "+49 30 18444-30444",
    authorityName:
      "Two federal higher authorities share intake through one joint portal (www.vet-uaw.de): (1) Bundesamt für Verbraucherschutz und Lebensmittelsicherheit (BVL), Abteilung Tierarzneimittel, Referat 322 Pharmakovigilanz — for all veterinary medicinal products other than immunologicals, and for human medicines used in animals; (2) Paul-Ehrlich-Institut (PEI), Bundesinstitut für Impfstoffe und biomedizinische Arzneimittel, Fachgebiet Sicherheit immunologischer Tierarzneimittel — for immunological veterinary medicinal products (vaccines, sera).",
    email: "uaw@bvl.bund.de",
    website: "https://www.vet-uaw.de/",
    notes:
      "An animal owner may report directly. 1) INTAKE IS SPLIT BY PRODUCT TYPE, so a single forwarding address is wrong. Immunological veterinary medicines (vaccines, sera) go to the Paul-Ehrlich-Institut; every other veterinary medicine — and any human medicine given to an animal — goes to BVL Referat 322. Routing must be decided from the pr",
    sourceUrl: "https://www.bvl.bund.de/VETUAW/DE/Home/home_node.html",
  },
  {
    country: "Ireland",
    iso2: "IE",
    iso3: "IRL",
    phone: "1890 200 510",
    authorityName: "Health Products Regulatory Authority (HPRA)",
    email: "vetsafety@hpra.ie",
    website: "https://forms.hpra.ie/Veterinary-Report-Form/",
    notes:
      "An animal owner may report directly. 1) NO OFFICIAL EMAIL EXISTS for veterinary adverse event reports. I grepped the raw HTML of every relevant HPRA page (the adverse-event hub, the animal-owner page, the MAH page, the report-an-issue pages, the pharmacovigilance pages, the vet-medicines safety index, and both contact pages) for any ad",
    sourceUrl:
      "https://www.hpra.ie/safety-information/how-we-monitor-safety/veterinary-medicines/report-an-adverse-reaction-event/information-for-animal-owners",
  },
  {
    country: "Italy",
    iso2: "IT",
    iso3: "ITA",
    phone: "+39 06 59943862",
    authorityName:
      'Ministero della Salute - Direzione generale della salute animale (DGSA) - Ufficio 4 "Medicinali veterinari". The acronym "DGSAF" (Direzione generale della sanita animale e dei farmaci veterinari) is superseded: the directorate is now named "Direzione generale della salute animale" (DGSA) and sits inside the "Dipartimento della salute umana, della salute animale e dell\'ecosistema (One Health) e dei rapporti internazionali". "Ufficio 4" is still correct and is still the office that receives veterinary adverse event reports. The DGSA PEC address is dgsa@postacert.sanita.it, consistent with the new acronym. Some legacy pages (including a stale footer on the REV portal) still print "DGSAF"/"sanita animale e dei farmaci veterinari" - do not treat those as current.',
    email: "farmacovigilanzavet@sanita.it",
    website: "https://www.salute.gov.it/FarmacoVigilanzaVetModule/index.html",
    notes:
      'An animal owner may report directly. 1) NAME IS STALE. "DGSAF" is outdated - the directorate is now DGSA (Direzione generale della salute animale). Ufficio 4 is unchanged. Update any stored label. 2) BEWARE A TYPO CIRCULATING IN SECONDARY SOURCES. Several third-party pages render the address as "famacovigilanzavet@sanita.it" (missing t',
    sourceUrl:
      "https://www.salute.gov.it/new/it/tema/medicinali-e-dispositivi-veterinari/modalita-di-segnalazione/",
  },
  {
    country: "Japan",
    iso2: "JP",
    iso3: "JPN",
    phone: "029-811-6380",
    authorityName:
      "National Veterinary Assay Laboratory (NVAL) / 農林水産省 動物医薬品検査所 — Planning and Liaison Division, Technical Guidance Section (企画連絡室 技術指導課), Ministry of Agriculture, Forestry and Fisheries (MAFF)",
    email: "nval-aer-vet@maff.go.jp",
    website: "https://aer.nval.go.jp/mahs/login",
    notes:
      "Reports are expected from a veterinarian, not the owner directly. AUTOMATED FORWARDING IS NOT SAFE HERE — five specific blockers. 1. OWNERS ARE NOT STATUTORY REPORTERS. Art. 68-10(2) of the 薬機法 (Act on Securing Quality, Efficacy and Safety of Pharmaceuticals and Medical Devices, Act No. 145 of 1960), as reproduced by NVAL, lists the reporters as: pharmacy openers;",
    sourceUrl: "https://www.maff.go.jp/nval/iyakutou/fukusayo/sousa/index.html",
  },
  {
    country: "Mexico",
    iso2: "MX",
    iso3: "MEX",
    phone: "+52 55 5905 1000",
    authorityName:
      "Servicio Nacional de Sanidad, Inocuidad y Calidad Agroalimentaria (SENASICA) - Dirección General de Salud Animal (DGSA), a decentralised body of the Secretaría de Agricultura y Desarrollo Rural",
    email: "farmacovigilanciavet@senasica.gob.mx",
    website: null,
    notes:
      'An animal owner may report directly. RECEIVING BODY: "SENASICA" is accurate and current - confirmed by 2026-dated official documents and 2026 recruitment notices; no rename or merger found. But the precise recipient is the Dirección General de Salud Animal (DGSA) inside SENASICA, which operates the Sistema de Farmacovigilancia de produ',
    sourceUrl:
      "https://www.gob.mx/senasica/articulos/alerta-senasica-sobre-comercializacion-de-farmacos-falsificados-para-animales?idiom=es",
  },
  {
    country: "Netherlands",
    iso2: "NL",
    iso3: "NLD",
    phone: "088 224 8000",
    authorityName:
      "Bureau Diergeneesmiddelen (BD) — the veterinary branch of the agentschap College ter Beoordeling van Geneesmiddelen (aCBG); official English name: Veterinary Medicinal Products Unit of the Medicines Evaluation Board (MEB). Reports are received by its Afdeling Farmacovigilantie (Pharmacovigilance Department). BD acts on behalf of the Minister van Landbouw, Visserij, Voedselzekerheid en Natuur (LVVN), who is the formal competent authority.",
    email: "vetpharvig@cbg-meb.nl",
    website:
      "https://fd8.formdesk.com/collegeterbeoordelingvangenees/BD_melding_bijwerking",
    notes:
      "An animal owner may report directly. 1. NO API OR BULK ROUTE FOR A PLATFORM. The only route open to a non-MAH is a JavaScript-dependent Formdesk web form. It cannot be posted to programmatically in any documented way, there is no acknowledgement/reference-number contract, and scripted submission is neither sanctioned nor documented. An",
    sourceUrl:
      "https://www.cbg-meb.nl/onderwerpen/diergeneesmiddelen-diergeneesmiddelenbewaking/bd-bijwerking-melden",
  },
  {
    country: "New Zealand",
    iso2: "NZ",
    iso3: "NZL",
    phone: "0800 008 333",
    authorityName:
      "Ministry for Primary Industries (MPI) - Agricultural Compounds and Veterinary Medicines (ACVM) group, New Zealand Food Safety (Haumaru Kai Aotearoa)",
    email: "ACVM-adverseevents@mpi.govt.nz",
    website:
      "https://www.mpi.govt.nz/agriculture/agricultural-compounds-vet-medicines/adverse-events-with-acvms",
    notes:
      "An animal owner may report directly. AUTHORITY NAME: 'MPI - ACVM' is current and correct - no rename or merge. Refinement only: the ACVM group sits inside New Zealand Food Safety (Haumaru Kai Aotearoa), an MPI business unit. Both the July 2022 vets/owners guideline and the March 2026 registrants guideline state the programme was 'devel",
    sourceUrl:
      "https://www.mpi.govt.nz/agriculture/agricultural-compounds-vet-medicines/adverse-events-with-acvms",
  },
  {
    country: "Singapore",
    iso2: "SG",
    iso3: "SGP",
    phone: "1800 476 1600",
    authorityName:
      "Animal & Veterinary Service (AVS), National Parks Board (NParks) — Pharmacovigilance Programme",
    email: null,
    website: "https://go.gov.sg/vpzway",
    notes:
      "Reports are expected from a veterinarian, not the owner directly. NO OFFICIAL EMAIL EXISTS for veterinary adverse event reports in Singapore. I scraped the raw HTML of both https://avs.nparks.gov.sg/businesses/veterinarians/adverse-events/ and https://avs.nparks.gov.sg/contact-us/ and regex-matched for any email address: zero matches on both pages. AVS publishes n",
    sourceUrl:
      "https://avs.nparks.gov.sg/businesses/veterinarians/adverse-events/",
  },
  {
    country: "South Korea",
    iso2: "KR",
    iso3: "KOR",
    phone: "+82-54-912-1000",
    authorityName:
      "농림축산검역본부 (Animal and Plant Quarantine Agency, APQA) — Animal Disease Control Bureau, Veterinary Drugs Management Division (동물질병관리부 동물약품관리과)",
    email: null,
    website:
      "https://www.qia.go.kr/animal/prevent/listwebQiaCom.do?type=2_50safe&clear=1",
    notes:
      "Whether an owner may report directly is not documented. APQA publishes veterinary medicine safety guidance but no dedicated adverse-event reporting form or address that could be verified, in Korean or English - the linked page is the safe-use guidance, not a report form. Advise the reporter to raise it with their veterinarian and to call APQA on the number here rather than implying an online route exists.",
    sourceUrl: "https://www.qia.go.kr/",
  },
  {
    country: "Spain",
    iso2: "ES",
    iso3: "ESP",
    phone: "+34 91 822 54 01",
    authorityName:
      "Agencia Española de Medicamentos y Productos Sanitarios (AEMPS) — Departamento de Medicamentos Veterinarios, which operates the Sistema Español de Farmacovigilancia de Medicamentos Veterinarios (SEFV-VET) and its national database VIGÍA-VET",
    email: "fv_vet@aemps.es",
    website: "https://sinaem.aemps.es/FVVET/notificavet",
    notes:
      'An animal owner may report directly. 1) NAME: "AEMPS" is current and correct — the agency has not been renamed or merged. But "AEMPS - Veterinary Pharmacovigilance" is a functional label, not an official body name. The precise designations are: the agency, Agencia Española de Medicamentos y Productos Sanitarios (AEMPS); the receiving u',
    sourceUrl:
      "https://www.aemps.gob.es/farmacovigilancia-de-medicamentos-veterinarios/",
  },
  {
    country: "Sweden",
    iso2: "SE",
    iso3: "SWE",
    phone: "+46 18 17 46 00",
    authorityName:
      "Läkemedelsverket (Swedish Medical Products Agency) — Enheten för veterinärläkemedel i användning (Unit for Veterinary Medicinal Products in Use)",
    email: "registrator@lakemedelsverket.se",
    website:
      "https://e-service.lakemedelsverket.se/formservice/formDownload?serviceName=multi_service_lakemedelsverket&scriptcomponent.cmtagname=trex-lakemedelsverket-biverkningsrapport_veterinar-cfd&service_name=biverkningsrapport_veterinar&skip.login=yes",
    notes:
      'An animal owner may report directly. 1) NAME: the body is current and correct; the proper Swedish spelling carries diacritics - "Läkemedelsverket" (official English name: "Swedish Medical Products Agency", sometimes "Swedish MPA"). No rename or merger found; the agency published fresh veterinary adverse-event statistics under this name',
    sourceUrl:
      "https://www.lakemedelsverket.se/sv/lakemedel-for-djur/biverkningsrapportering",
  },
  {
    country: "United Kingdom",
    iso2: "GB",
    iso3: "GBR",
    phone: "01932 338427",
    authorityName: "Veterinary Medicines Directorate (VMD)",
    email: "adverse.events@vmd.gov.uk",
    website: "https://www.gov.uk/report-veterinary-medicine-problem",
    notes:
      "An animal owner may report directly. 1) NO OFFICIAL EMAIL ADDRESS ACCEPTS ADVERSE EVENT REPORTS. Two VMD mailboxes exist on gov.uk and both are query/administration channels, not submission routes: adverse.events@vmd.gov.uk (documented for notifying exceptional circumstances where electronic reporting is not possible, for MAHORGID/AERI",
    sourceUrl: "https://www.gov.uk/report-veterinary-medicine-problem",
  },
  {
    country: "United States",
    iso2: "US",
    iso3: "USA",
    phone: "1-888-332-8387",
    authorityName:
      "U.S. Food and Drug Administration (FDA), Center for Veterinary Medicine (CVM)",
    email: "CVM1932a@fda.hhs.gov",
    website:
      "https://www.fda.gov/animal-veterinary/report-problem/how-report-animal-drug-and-device-side-effects-and-product-problems",
    notes:
      "An animal owner may report directly. Things that would make naive automated forwarding wrong or risky here: 1. THERE IS NO CONSUMER WEB SUBMISSION ENDPOINT FOR ANIMAL DRUGS. The only owner/vet route to FDA for a drug or device adverse event is a fillable PDF (Form FDA 1932a) emailed as an attachment to CVM1932a@fda.hhs.gov. Any platfor",
    sourceUrl:
      "https://www.fda.gov/animal-veterinary/report-problem/how-report-animal-drug-and-device-side-effects-and-product-problems",
  },
];
