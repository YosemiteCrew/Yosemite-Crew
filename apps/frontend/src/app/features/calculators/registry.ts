import { type CalculatorSpecies } from '@/app/features/calculators/utils/shared';
import { type ResultRow } from '@/app/features/calculators/components/CalculatorResult';
import { parseOptionalNumber, parseRequiredNumber } from '@/app/features/calculators/utils/form';
import {
  calculateFluidRate,
  calculateDrugDose,
  calculateBodySurfaceArea,
} from '@/app/features/calculators/utils/calculations';
import { calculateCri } from '@/app/features/calculators/engine/cri';
import { calculateConcentration } from '@/app/features/calculators/engine/concentration';
import { calculateEnergyRequirement } from '@/app/features/calculators/engine/energy';
import { calculateShockBolus } from '@/app/features/calculators/engine/shock-bolus';
import { calculateTransfusion } from '@/app/features/calculators/engine/transfusion';
import { calculateDripRate } from '@/app/features/calculators/engine/drip-rate';
import { calculateCorrectedSodium } from '@/app/features/calculators/engine/corrected-sodium';
import { calculateCorrectedCalcium } from '@/app/features/calculators/engine/corrected-calcium';
import { calculateAnionGap } from '@/app/features/calculators/engine/anion-gap';
import { calculateOsmolality } from '@/app/features/calculators/engine/osmolality';
import { calculateFreeWaterDeficit } from '@/app/features/calculators/engine/free-water-deficit';
import { calculateIrisStage } from '@/app/features/calculators/engine/iris-stage';
import { classifyBloodPressure } from '@/app/features/calculators/engine/blood-pressure';
import { calculateGestation } from '@/app/features/calculators/engine/gestation';
import { calculateOxygenFlow } from '@/app/features/calculators/engine/oxygen-flow';

export type CalculatorField = {
  name: string;
  label: string;
  type?: 'number' | 'date';
};

export type CalculatorValues = Record<string, string>;

export type CalculatorConfig = {
  key: string;
  category: string;
  label: string;
  intro: string;
  species?: boolean;
  fields: CalculatorField[];
  compute: (values: CalculatorValues, species: CalculatorSpecies) => ResultRow[];
};

const num = (values: CalculatorValues, key: string): number =>
  parseRequiredNumber(values[key] ?? '');

const opt = (values: CalculatorValues, key: string): number | undefined =>
  parseOptionalNumber(values[key] ?? '');

const optionalRow = (
  rows: ResultRow[],
  value: number | null,
  label: string,
  unit: string
): ResultRow[] => {
  if (value !== null) rows.push({ label, value: `${value} ${unit}` });
  return rows;
};

export const CALCULATORS: CalculatorConfig[] = [
  // Fluids & emergency
  {
    key: 'fluid-rate',
    category: 'Fluids & emergency',
    label: 'Fluid rate',
    intro: 'Maintenance fluids plus dehydration deficit and ongoing losses, given over 24 hours.',
    species: true,
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'dehydrationPercent', label: 'Dehydration (%)' },
      { name: 'ongoingLossesMlPerDay', label: 'Ongoing losses (mL/day, optional)' },
    ],
    compute: (v, species) => {
      const r = calculateFluidRate({
        species,
        weightKg: num(v, 'weightKg'),
        dehydrationPercent: num(v, 'dehydrationPercent'),
        ongoingLossesMlPerDay: opt(v, 'ongoingLossesMlPerDay'),
      });
      return [
        { label: 'Maintenance', value: `${r.maintenanceMlPerDay} mL/day` },
        { label: 'Dehydration deficit', value: `${r.deficitMl} mL` },
        { label: 'Ongoing losses', value: `${r.ongoingLossesMlPerDay} mL/day` },
        { label: 'Total volume', value: `${r.totalMlPerDay} mL/day` },
        { label: 'Infusion rate', value: `${r.ratePerHourMl} mL/hr` },
      ];
    },
  },
  {
    key: 'cri',
    category: 'Fluids & emergency',
    label: 'Constant rate infusion',
    intro: 'How much drug to add to a fluid bag to deliver a target µg/kg/min dose.',
    fields: [
      { name: 'doseMcgPerKgMin', label: 'Dose (µg/kg/min)' },
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'bagVolumeMl', label: 'Fluid bag volume (mL)' },
      { name: 'fluidRateMlPerHr', label: 'Fluid rate (mL/hr)' },
      { name: 'drugConcentrationMgPerMl', label: 'Drug concentration (mg/mL, optional)' },
    ],
    compute: (v) => {
      const r = calculateCri({
        doseMcgPerKgMin: num(v, 'doseMcgPerKgMin'),
        weightKg: num(v, 'weightKg'),
        bagVolumeMl: num(v, 'bagVolumeMl'),
        fluidRateMlPerHr: num(v, 'fluidRateMlPerHr'),
        drugConcentrationMgPerMl: opt(v, 'drugConcentrationMgPerMl'),
      });
      return optionalRow(
        [
          { label: 'Drug per hour', value: `${r.drugPerHourMcg} µg/hr` },
          { label: 'Bag duration', value: `${r.bagDurationHr} hr` },
          { label: 'Drug to add to bag', value: `${r.drugToAddMg} mg` },
        ],
        r.drugVolumeToAddMl,
        'Volume to add',
        'mL'
      );
    },
  },
  {
    key: 'shock-bolus',
    category: 'Fluids & emergency',
    label: 'Shock fluid bolus',
    intro: 'Resuscitation bolus and infusion rate (typical canine 10-20 mL/kg, feline 5-10 mL/kg).',
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'doseMlPerKg', label: 'Bolus dose (mL/kg)' },
      { name: 'minutes', label: 'Give over (minutes, optional, default 15)' },
    ],
    compute: (v) => {
      const r = calculateShockBolus({
        weightKg: num(v, 'weightKg'),
        doseMlPerKg: num(v, 'doseMlPerKg'),
        minutes: opt(v, 'minutes'),
      });
      return [
        { label: 'Bolus volume', value: `${r.bolusMl} mL` },
        { label: 'Infusion rate', value: `${r.rateMlPerHr} mL/hr` },
      ];
    },
  },
  {
    key: 'transfusion',
    category: 'Fluids & emergency',
    label: 'Transfusion volume',
    intro: 'Whole-blood volume to reach a target PCV.',
    species: true,
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'currentPcv', label: 'Current PCV (%)' },
      { name: 'targetPcv', label: 'Target PCV (%)' },
      { name: 'donorPcv', label: 'Donor PCV (%)' },
    ],
    compute: (v, species) => {
      const r = calculateTransfusion({
        species,
        weightKg: num(v, 'weightKg'),
        currentPcv: num(v, 'currentPcv'),
        targetPcv: num(v, 'targetPcv'),
        donorPcv: num(v, 'donorPcv'),
      });
      return [{ label: 'Transfusion volume', value: `${r.transfusionVolumeMl} mL` }];
    },
  },
  {
    key: 'drip-rate',
    category: 'Fluids & emergency',
    label: 'IV drip rate',
    intro: 'Drops per minute for a gravity giving set.',
    fields: [
      { name: 'rateMlPerHr', label: 'Fluid rate (mL/hr)' },
      { name: 'dropFactorGttPerMl', label: 'Drop factor (gtt/mL, optional, default 20)' },
    ],
    compute: (v) => {
      const r = calculateDripRate({
        rateMlPerHr: num(v, 'rateMlPerHr'),
        dropFactorGttPerMl: opt(v, 'dropFactorGttPerMl'),
      });
      return [
        { label: 'Drops per minute', value: `${r.dropsPerMin} gtt/min` },
        { label: 'Seconds per drop', value: `${r.secondsPerDrop} s/drop` },
      ];
    },
  },
  {
    key: 'free-water-deficit',
    category: 'Fluids & emergency',
    label: 'Free water deficit',
    intro: 'Free water deficit for hypernatremia and the minimum safe correction time.',
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'currentNa', label: 'Current sodium (mEq/L)' },
      { name: 'targetNa', label: 'Target sodium (mEq/L)' },
      { name: 'bodyWaterFraction', label: 'Body water fraction (optional, default 0.6)' },
    ],
    compute: (v) => {
      const r = calculateFreeWaterDeficit({
        weightKg: num(v, 'weightKg'),
        currentNa: num(v, 'currentNa'),
        targetNa: num(v, 'targetNa'),
        bodyWaterFraction: opt(v, 'bodyWaterFraction'),
      });
      return [
        { label: 'Free water deficit', value: `${r.freeWaterDeficitL} L` },
        { label: 'Min correction time', value: `${r.correctionHours} hr` },
      ];
    },
  },
  // Dosing & pharmacy
  {
    key: 'drug-dose',
    category: 'Dosing & pharmacy',
    label: 'Drug dose',
    intro: 'Dose by body weight, with optional concentration to get the volume to draw up.',
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'doseMgPerKg', label: 'Dose (mg/kg)' },
      { name: 'concentrationMgPerMl', label: 'Concentration (mg/mL, optional)' },
      { name: 'frequencyPerDay', label: 'Frequency (per day, optional)' },
    ],
    compute: (v) => {
      const r = calculateDrugDose({
        weightKg: num(v, 'weightKg'),
        doseMgPerKg: num(v, 'doseMgPerKg'),
        concentrationMgPerMl: opt(v, 'concentrationMgPerMl'),
        frequencyPerDay: opt(v, 'frequencyPerDay'),
      });
      return optionalRow(
        [
          { label: 'Dose per administration', value: `${r.doseMgPerAdministration} mg` },
          { label: 'Frequency', value: `${r.frequencyPerDay} ×/day` },
          { label: 'Daily dose', value: `${r.dailyDoseMg} mg/day` },
        ],
        r.volumeMlPerAdministration,
        'Volume per administration',
        'mL'
      );
    },
  },
  {
    key: 'body-surface-area',
    category: 'Dosing & pharmacy',
    label: 'Body surface area',
    intro: 'Body surface area from weight, with optional mg/m² dose for BSA-normalised dosing.',
    species: true,
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'dosePerM2', label: 'Dose (mg/m², optional)' },
    ],
    compute: (v, species) => {
      const r = calculateBodySurfaceArea({
        species,
        weightKg: num(v, 'weightKg'),
        dosePerM2: opt(v, 'dosePerM2'),
      });
      return optionalRow(
        [{ label: 'Body surface area', value: `${r.bsaM2} m²` }],
        r.totalDoseMg,
        'Total dose',
        'mg'
      );
    },
  },
  {
    key: 'concentration',
    category: 'Dosing & pharmacy',
    label: 'Solution concentration',
    intro: 'Convert a percent solution to mg/mL, with optional volume for a dose.',
    fields: [
      { name: 'percentSolution', label: 'Solution strength (%)' },
      { name: 'doseMg', label: 'Dose (mg, optional)' },
    ],
    compute: (v) => {
      const r = calculateConcentration({
        percentSolution: num(v, 'percentSolution'),
        doseMg: opt(v, 'doseMg'),
      });
      return optionalRow(
        [{ label: 'Concentration', value: `${r.concentrationMgPerMl} mg/mL` }],
        r.volumeMl,
        'Volume for dose',
        'mL'
      );
    },
  },
  // Electrolytes & metabolic
  {
    key: 'corrected-sodium',
    category: 'Electrolytes & metabolic',
    label: 'Corrected sodium',
    intro: 'Sodium corrected for hyperglycemia.',
    fields: [
      { name: 'measuredNa', label: 'Measured sodium (mEq/L)' },
      { name: 'glucoseMgDl', label: 'Glucose (mg/dL)' },
    ],
    compute: (v) => {
      const r = calculateCorrectedSodium({
        measuredNa: num(v, 'measuredNa'),
        glucoseMgDl: num(v, 'glucoseMgDl'),
      });
      return [{ label: 'Corrected sodium', value: `${r.correctedNa} mEq/L` }];
    },
  },
  {
    key: 'corrected-calcium',
    category: 'Electrolytes & metabolic',
    label: 'Corrected calcium (canine)',
    intro: 'Albumin-corrected calcium. Canine formula only.',
    fields: [
      { name: 'totalCalciumMgDl', label: 'Total calcium (mg/dL)' },
      { name: 'albuminGdl', label: 'Albumin (g/dL)' },
    ],
    compute: (v) => {
      const r = calculateCorrectedCalcium({
        totalCalciumMgDl: num(v, 'totalCalciumMgDl'),
        albuminGdl: num(v, 'albuminGdl'),
      });
      return [{ label: 'Corrected calcium', value: `${r.correctedCalcium} mg/dL` }];
    },
  },
  {
    key: 'anion-gap',
    category: 'Electrolytes & metabolic',
    label: 'Anion gap',
    intro: 'Serum anion gap from an electrolyte panel.',
    fields: [
      { name: 'na', label: 'Sodium (mEq/L)' },
      { name: 'k', label: 'Potassium (mEq/L)' },
      { name: 'cl', label: 'Chloride (mEq/L)' },
      { name: 'hco3', label: 'Bicarbonate (mEq/L)' },
    ],
    compute: (v) => {
      const r = calculateAnionGap({
        na: num(v, 'na'),
        k: num(v, 'k'),
        cl: num(v, 'cl'),
        hco3: num(v, 'hco3'),
      });
      return [{ label: 'Anion gap', value: `${r.anionGap} mEq/L` }];
    },
  },
  {
    key: 'osmolality',
    category: 'Electrolytes & metabolic',
    label: 'Osmolality',
    intro: 'Calculated serum osmolality, with optional osmolal gap.',
    fields: [
      { name: 'na', label: 'Sodium (mEq/L)' },
      { name: 'k', label: 'Potassium (mEq/L)' },
      { name: 'glucoseMgDl', label: 'Glucose (mg/dL)' },
      { name: 'bunMgDl', label: 'BUN (mg/dL)' },
      { name: 'measuredOsm', label: 'Measured osmolality (mOsm/kg, optional)' },
    ],
    compute: (v) => {
      const r = calculateOsmolality({
        na: num(v, 'na'),
        k: num(v, 'k'),
        glucoseMgDl: num(v, 'glucoseMgDl'),
        bunMgDl: num(v, 'bunMgDl'),
        measuredOsm: opt(v, 'measuredOsm'),
      });
      return optionalRow(
        [{ label: 'Calculated osmolality', value: `${r.calculatedOsm} mOsm/kg` }],
        r.osmolalGap,
        'Osmolal gap',
        'mOsm/kg'
      );
    },
  },
  // Nutrition
  {
    key: 'energy',
    category: 'Nutrition',
    label: 'Energy requirement',
    intro: 'Resting and maintenance energy requirement, with optional feeding amount.',
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'merFactor', label: 'MER factor (optional, default 1.6)' },
      { name: 'dietKcalPer100g', label: 'Diet energy (kcal/100 g, optional)' },
    ],
    compute: (v) => {
      const r = calculateEnergyRequirement({
        weightKg: num(v, 'weightKg'),
        merFactor: opt(v, 'merFactor'),
        dietKcalPer100g: opt(v, 'dietKcalPer100g'),
      });
      return optionalRow(
        [
          { label: 'Resting energy (RER)', value: `${r.rerKcalPerDay} kcal/day` },
          { label: 'Maintenance energy (MER)', value: `${r.merKcalPerDay} kcal/day` },
        ],
        r.gramsPerDay,
        'Feeding amount',
        'g/day'
      );
    },
  },
  // Renal & cardio
  {
    key: 'iris-stage',
    category: 'Renal & cardio',
    label: 'IRIS CKD stage',
    intro: 'IRIS chronic kidney disease stage from serum creatinine.',
    species: true,
    fields: [{ name: 'creatinineMgDl', label: 'Creatinine (mg/dL)' }],
    compute: (v, species) => {
      const r = calculateIrisStage({ species, creatinineMgDl: num(v, 'creatinineMgDl') });
      return [
        { label: 'IRIS stage', value: `Stage ${r.stage}` },
        { label: 'Interpretation', value: r.interpretation },
      ];
    },
  },
  {
    key: 'blood-pressure',
    category: 'Renal & cardio',
    label: 'Blood pressure (ACVIM)',
    intro: 'Systolic blood pressure category and target-organ-damage risk.',
    fields: [{ name: 'sbpMmHg', label: 'Systolic BP (mmHg)' }],
    compute: (v) => {
      const r = classifyBloodPressure({ sbpMmHg: num(v, 'sbpMmHg') });
      return [
        { label: 'Category', value: r.category },
        { label: 'Target-organ-damage risk', value: r.risk },
      ];
    },
  },
  // Repro & anesthesia
  {
    key: 'gestation',
    category: 'Repro & anesthesia',
    label: 'Gestation / due date',
    intro: 'Estimated whelping/queening date from the breeding date.',
    species: true,
    fields: [{ name: 'breedingDate', label: 'Breeding date', type: 'date' }],
    compute: (v, species) => {
      const r = calculateGestation({ species, breedingDate: v.breedingDate });
      return [
        { label: 'Estimated due date', value: r.dueDate },
        { label: 'Earliest', value: r.earliest },
        { label: 'Latest', value: r.latest },
      ];
    },
  },
  {
    key: 'oxygen-flow',
    category: 'Repro & anesthesia',
    label: 'Oxygen flow rate',
    intro: 'Oxygen flow from body weight (default 100 mL/kg/min, non-rebreathing).',
    fields: [
      { name: 'weightKg', label: 'Weight (kg)' },
      { name: 'flowMlPerKgPerMin', label: 'Flow (mL/kg/min, optional, default 100)' },
    ],
    compute: (v) => {
      const r = calculateOxygenFlow({
        weightKg: num(v, 'weightKg'),
        flowMlPerKgPerMin: opt(v, 'flowMlPerKgPerMin'),
      });
      return [
        { label: 'Oxygen flow (mL/min)', value: `${r.flowMlPerMin} mL/min` },
        { label: 'Oxygen flow (L/min)', value: `${r.flowLPerMin} L/min` },
      ];
    },
  },
];

export const CALCULATOR_CATEGORIES: string[] = CALCULATORS.reduce<string[]>((acc, calc) => {
  if (!acc.includes(calc.category)) acc.push(calc.category);
  return acc;
}, []);

export const calculatorsInCategory = (category: string): CalculatorConfig[] =>
  CALCULATORS.filter((calc) => calc.category === category);

// Source attribution shown in each calculator's description: the exact, verified
// clinical citation for the formula (PubMed / DOI / official guideline where one
// exists). Universal arithmetic formulas (drip rate, drug dose) have no single
// primary source and are labelled as such. These are the formulas' own sources
// and are NOT taken from any third-party calculator suite.
export type CalculatorReference = { source: string; url?: string };

export const CALCULATOR_REFERENCES: Record<string, CalculatorReference> = {
  'fluid-rate': {
    source:
      'Maintenance fluids and dehydration deficit: 2024 AAHA Fluid Therapy Guidelines for Dogs and Cats (Pardo et al., J Am Anim Hosp Assoc 2024;60(4):131-163).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/38885492/',
  },
  cri: {
    source:
      "Constant rate infusion - standard unit-conversion arithmetic (no single primary source); see Macintire & Tefend, Constant-Rate Infusions: Practical Use, Clinician's Brief 2004.",
    url: 'https://www.cliniciansbrief.com/article/constant-rate-infusions-practical-use',
  },
  'shock-bolus': {
    source:
      'Shock-dose crystalloid resuscitation (standard practice): Silverstein & Hopper, Small Animal Critical Care Medicine, 3rd ed., Elsevier 2023.',
    url: 'https://shop.elsevier.com/books/small-animal-critical-care-medicine/silverstein/978-0-323-76469-8',
  },
  transfusion: {
    source:
      'Transfusion volume (standard practice): Day & Kohn, BSAVA Manual of Canine and Feline Haematology and Transfusion Medicine, 2nd ed., 2012.',
    url: 'https://www.bsavalibrary.com/content/book/10.22233/9781905319732',
  },
  'drip-rate': {
    source:
      'Standard IV infusion arithmetic: drops/min = rate(mL/hr) x drop factor(gtt/mL) / 60. No single primary source.',
  },
  'free-water-deficit': {
    source:
      'Free water deficit: Adrogué & Madias, Hypernatremia, N Engl J Med 2000;342(20):1493-1499.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10816188/',
  },
  'drug-dose': {
    source: 'Universal weight-based dosing (dose mg = mg/kg x kg). No single primary source.',
  },
  'body-surface-area': {
    source:
      "Body surface area dose-normalisation (K = 10.1 dog, 10.0 cat): Withrow & MacEwen's Small Animal Clinical Oncology, 6th ed., 2019; constants critiqued in Price & Frazier, J Vet Intern Med 1998;12(4):267-271.",
    url: 'https://doi.org/10.1111/j.1939-1676.1998.tb02121.x',
  },
  concentration: {
    source:
      'Percent (w/v) to mg/mL (1% = 10 mg/mL): standard pharmacology arithmetic (no single primary source); definition in StatPearls, Pharmacy Calculations.',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK560924/',
  },
  'corrected-sodium': {
    source:
      'Sodium correction for hyperglycemia (1.6 mEq/L per 100 mg/dL glucose): Katz, N Engl J Med 1973;289(16):843-844.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/4763428/',
  },
  'corrected-calcium': {
    source:
      'Albumin-adjusted calcium (canine). Note: adjustment is NOT recommended in dogs (worsens discordance vs ionized calcium) - Schenck & Chew, Am J Vet Res 2005;66(8):1330-1336.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16173474/',
  },
  'anion-gap': {
    source:
      'Anion gap = (Na + K) - (Cl + HCO3); foundational reference Oh & Carroll, The Anion Gap, N Engl J Med 1977;297(15):814-817 (a standard identity with lab-dependent variants).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/895822/',
  },
  osmolality: {
    source:
      'Calculated osmolality = 2(Na + K) + glucose/18 + BUN/2.8: standard clinical chemistry (no single primary source for this variant; cf. Dorwart & Chalmers, Clin Chem 1975;21(2):190-194).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1112025/',
  },
  energy: {
    source:
      'Resting energy requirement RER = 70 x BW(kg)^0.75 (allometric): NRC, Nutrient Requirements of Dogs and Cats, 2006; WSAVA Global Nutrition Toolkit.',
    url: 'https://doi.org/10.17226/10668',
  },
  'iris-stage': {
    source: 'IRIS Staging of CKD (modified 2023), International Renal Interest Society.',
    url: 'https://www.iris-kidney.com/iris-guidelines-1',
  },
  'blood-pressure': {
    source:
      'ACVIM Consensus Statement on systemic hypertension in dogs and cats (Acierno et al., J Vet Intern Med 2018;32(6):1803-1822).',
    url: 'https://doi.org/10.1111/jvim.15331',
  },
  gestation: {
    source:
      'Canine gestation length: Concannon et al., Am J Vet Res 1983;44(10):1819-1821 (65 +/- 1 days from LH peak; ~63 days from ovulation).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/6685444/',
  },
  'oxygen-flow': {
    source:
      'Oxygen flow per kg: 2020 AAHA Anesthesia and Monitoring Guidelines (Grubb et al., J Am Anim Hosp Assoc 2020;56(2):59-82).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/32078360/',
  },
};
