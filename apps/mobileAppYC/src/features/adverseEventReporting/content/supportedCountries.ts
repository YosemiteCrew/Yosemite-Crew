import countryList from '@/shared/utils/countryList.json';
import type {SupportedAdverseEventCountry} from '@/features/adverseEventReporting/types';

const BASE_COUNTRIES = countryList as {
  name: string;
  code: string;
  flag: string;
  dial_code: string;
}[];

const resolveMeta = (name: string, code: string) => {
  const match =
    BASE_COUNTRIES.find(c => c.code === code) ??
    BASE_COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase());

  return {
    flag: match?.flag ?? '',
    dial_code: match?.dial_code ?? '',
  };
};

type RawSupportedCountryTuple = [name: string, code: string, iso3: string, authorityName: string];

const RAW_SUPPORTED_COUNTRIES: RawSupportedCountryTuple[] = [
  ['United States', 'US', 'USA', 'FDA – Center for Veterinary Medicine (CVM)'],
  ['Canada', 'CA', 'CAN', 'Health Canada – Veterinary Drugs Directorate (VDD)'],
  ['United Kingdom', 'GB', 'GBR', 'Veterinary Medicines Directorate (VMD)'],
  ['Ireland', 'IE', 'IRL', 'Health Products Regulatory Authority (HPRA) – Veterinary Sciences'],
  ['France', 'FR', 'FRA', 'ANMV (Anses) – Département inspection, surveillance et pharmacovigilance'],
  [
    'Germany',
    'DE',
    'DEU',
    'BVL – Federal Office of Consumer Protection and Food Safety (Pharmacovigilance)',
  ],
  ['Spain', 'ES', 'ESP', 'AEMPS – Veterinary Pharmacovigilance'],
  [
    'Italy',
    'IT',
    'ITA',
    'Ministero della Salute – Direzione Generale della Sanità Animale e dei Farmaci Veterinari (Ufficio 4) / ISS Vet Med Lab',
  ],
  ['Netherlands', 'NL', 'NLD', 'CBG/MEB – Veterinary Medicinal Products Unit (VMPU)'],
  ['Sweden', 'SE', 'SWE', 'Läkemedelsverket (Swedish Medical Products Agency)'],
  ['Denmark', 'DK', 'DNK', 'Danish Medicines Agency (Lægemiddelstyrelsen)'],
  ['Australia', 'AU', 'AUS', 'APVMA – Adverse Experience Reporting Program (AERP)'],
  ['New Zealand', 'NZ', 'NZL', 'Ministry for Primary Industries (MPI) – ACVM Adverse Events'],
  ['Japan', 'JP', 'JPN', 'National Veterinary Assay Laboratory (NVAL), MAFF'],
  ['South Korea', 'KR', 'KOR', 'Animal and Plant Quarantine Agency (QIA)'],
  ['Singapore', 'SG', 'SGP', 'NParks – Animal & Veterinary Service (AVS)'],
  ['Argentina', 'AR', 'ARG', 'SENASA – Dirección de Productos Veterinarios (DPV)'],
  ['Mexico', 'MX', 'MEX', 'COFEPRIS (general) / SENASICA (veterinary products)'],
];

const withCountryMeta = (entry: RawSupportedCountryTuple): SupportedAdverseEventCountry => {
  const [name, code, iso3, authorityName] = entry;
  const meta = resolveMeta(name, code);
  return {
    name,
    code,
    iso3,
    authorityName,
    ...meta,
  };
};

export const SUPPORTED_ADVERSE_EVENT_COUNTRIES: SupportedAdverseEventCountry[] =
  RAW_SUPPORTED_COUNTRIES.map(withCountryMeta);
