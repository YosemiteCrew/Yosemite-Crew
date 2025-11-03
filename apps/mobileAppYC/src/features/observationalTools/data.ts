import {Images} from '@/assets/images';
import type {
  ObservationalToolDefinition,
  ObservationalToolDefinitionMap,
  ObservationalToolOption,
  ObservationalToolProviderMap,
} from './types';

const DEFAULT_EMPTY_STATE = {
  title: 'Not just yet!',
  message:
    "Right now, your medical team isn't handing out the observation tool — guess they're too busy managing your furry sidekick!",
  image: Images.otNoProviders,
} as const;

type ToolId = ObservationalToolDefinition['id'];
type ImageKey = keyof typeof Images;

interface OptionSpec {
  title: string;
  imageKey?: ImageKey;
}

interface StepSpec {
  title: string;
  optionIds: string[];
}

interface ToolSpec {
  name: string;
  shortName: string;
  species: ObservationalToolDefinition['species'];
  heroImage: ImageKey;
  overviewTitle: string;
  overviewParagraphs: string[];
  subtitle: string;
  footer: string;
  stepIds: string[];
}

const OPTION_SEEDS: Array<[string, string, ImageKey?]> = [
  ['ears-forward', 'Ears facing forward', 'felineEarForward'],
  ['ears-apart', 'Ears slightly pulled apart', 'felineEarApart'],
  ['ears-outwards', 'Ears rotated outwards', 'felineEarOutwards'],
  ['eyes-opened', 'Eyes opened', 'felineOrbitalOpened'],
  ['eyes-partially-closed', 'Eyes partially closed', 'felineOrbitalPartial'],
  ['eyes-squinted', 'Squinted eyes', 'felineOrbitalSquint'],
  ['muzzle-relaxed', 'Relaxed (round shape)', 'felineMuzzleRelaxed'],
  ['muzzle-mild', 'Mild tense muzzle', 'felineMuzzleMild'],
  ['muzzle-tense', 'Tense (elliptical shape)', 'felineMuzzleTense'],
  ['whisker-loose', 'Loose (relaxed) and curved', 'felineWhiskerLoose'],
  ['whisker-slightly-curved', 'Slightly curved or straight (closer together)', 'felineWhiskerStraight'],
  ['whisker-forward', 'Straight and moving forward (rostrally, away from the face)', 'felineWhiskerForward'],
  ['head-above-shoulder', 'Head above the shoulder line', 'felineHeadAbove'],
  ['head-aligned', 'Head aligned with the shoulder line', 'felineHeadAligned'],
  ['head-below', 'Head below the shoulder line or tilted down (chin toward the chest)', 'felineHeadBelow'],
  ['rest-comfortable', 'Comfortable, happy, relaxed'],
  ['rest-restless', 'Slightly restless, easily distracted'],
  ['rest-uncomfortable', 'Looks uncomfortable, may whimper, worried facial expression'],
  ['rest-guarding', 'Unsettled, crying/groaning, guarding wound, reluctant to move'],
  ['rest-severe', 'Constant crying, screaming, unresponsive, difficult to distract'],
  ['interest-curious', 'Curious, eager to interact'],
  ['interest-distracted', 'Easily distracted'],
  ['interest-reluctant', 'Reluctant, not eager but will look around'],
  ['interest-unwilling', 'May ignore surroundings, unwilling to move'],
  ['interest-unresponsive', 'Unresponsive to surroundings'],
  ['palpation-none', 'No reaction'],
  ['palpation-look', 'Looks around or flinches'],
  ['palpation-flinch', 'Flinches/whimpers/pulls away'],
  ['palpation-strong', 'Strong cry, growl, bite threat, dramatic pulling away'],
  ['palpation-intense', 'Cries even at non-painful touch, may react aggressively'],
  ['wound-none', 'Not bothering wound or surgery site'],
  ['wound-occasional', 'Occasionally licks or rubs site'],
  ['wound-frequent', 'Frequently licks, whimpers when unattended'],
  ['wound-chewing', 'Chewing/biting wound, guarding body part'],
  ['wound-constant', 'Constant chewing/biting, unwilling to move'],
  ['tension-relaxed', 'Relaxed, normal movement'],
  ['tension-mild', 'Mild tension'],
  ['tension-moderate', 'Mild to moderate tension, hesitant to move'],
  ['tension-severe', 'Moderate to severe tension, rigid to touch'],
  ['tension-immobile', 'Completely rigid, avoids any movement'],
  ['ear-not-present', 'Not present', 'equineEarNotPresent'],
  ['ear-moderate', 'Moderately present', 'equineEarModerate'],
  ['ear-obvious', 'Obviously present', 'equineEarObvious'],
  ['orbital-not-present', 'Orbital tightening not present', 'equineOrbitalNotPresent'],
  ['orbital-moderate', 'Orbital tightening moderately present', 'equineOrbitalModerate'],
  ['orbital-obvious', 'Orbital tightening obviously present', 'equineOrbitalObvious'],
  ['eye-not-present', 'Not present', 'equineEyeNotPresent'],
  ['eye-moderate', 'Moderately present', 'equineEyeModerate'],
  ['eye-obvious', 'Obviously present', 'equineEyeObvious'],
  ['chewing-not-present', 'Not present', 'equineChewingNotPresent'],
  ['chewing-moderate', 'Moderately present', 'equineChewingModerate'],
  ['chewing-obvious', 'Obviously present', 'equineChewingObvious'],
  ['mouth-not-present', 'Not present', 'equineMouthNotPresent'],
  ['mouth-moderate', 'Moderately present', 'equineMouthModerate'],
  ['mouth-obvious', 'Obviously present', 'equineMouthObvious'],
  ['nostril-not-present', 'Not present', 'equineNostrilNotPresent'],
  ['nostril-moderate', 'Moderately present', 'equineNostrilModerate'],
  ['nostril-obvious', 'Obviously present', 'equineNostrilObvious'],
];

const OPTION_LIBRARY = OPTION_SEEDS.reduce<Record<string, OptionSpec>>((acc, [id, title, imageKey]) => {
  acc[id] = imageKey ? {title, imageKey} : {title};
  return acc;
}, {});

const STEP_SEEDS: Array<[string, string, string[]]> = [
  ['fgs-ear-position', 'Ear Position', ['ears-forward', 'ears-apart', 'ears-outwards']],
  ['fgs-orbital-tightening', 'Orbital Tightening', ['eyes-opened', 'eyes-partially-closed', 'eyes-squinted']],
  ['fgs-muzzle-tension', 'Muzzle Tension', ['muzzle-relaxed', 'muzzle-mild', 'muzzle-tense']],
  ['fgs-whisker-change', 'Whisker Change', ['whisker-loose', 'whisker-slightly-curved', 'whisker-forward']],
  ['fgs-head-position', 'Head Position', ['head-above-shoulder', 'head-aligned', 'head-below']],
  [
    'caps-behaviour-rest',
    'Behaviour at Rest',
    ['rest-comfortable', 'rest-restless', 'rest-uncomfortable', 'rest-guarding', 'rest-severe'],
  ],
  [
    'caps-interest-surroundings',
    'Interest in Surroundings/People',
    ['interest-curious', 'interest-distracted', 'interest-reluctant', 'interest-unwilling', 'interest-unresponsive'],
  ],
  [
    'caps-response-palpation',
    'Response to Palpation',
    ['palpation-none', 'palpation-look', 'palpation-flinch', 'palpation-strong', 'palpation-intense'],
  ],
  [
    'caps-wound-interaction',
    'Wound/Site Interaction',
    ['wound-none', 'wound-occasional', 'wound-frequent', 'wound-chewing', 'wound-constant'],
  ],
  [
    'caps-body-tension',
    'Body Tension/Movement',
    ['tension-relaxed', 'tension-mild', 'tension-moderate', 'tension-severe', 'tension-immobile'],
  ],
  ['egs-ear-position', 'Stiffly backwards ear', ['ear-not-present', 'ear-moderate', 'ear-obvious']],
  ['egs-orbital-tightening', 'Orbital tightening', ['orbital-not-present', 'orbital-moderate', 'orbital-obvious']],
  ['egs-eye-tension', 'Tension above the eye area', ['eye-not-present', 'eye-moderate', 'eye-obvious']],
  ['egs-chewing-muscle', 'Prominently strained chewing muscles', ['chewing-not-present', 'chewing-moderate', 'chewing-obvious']],
  ['egs-mouth-strain', 'Mouth strained and pronounced chin', ['mouth-not-present', 'mouth-moderate', 'mouth-obvious']],
  ['egs-nostril-profile', 'Strained nostrils and flattening of the profile', ['nostril-not-present', 'nostril-moderate', 'nostril-obvious']],
];

const STEP_LIBRARY = STEP_SEEDS.reduce<Record<string, StepSpec>>((acc, [id, title, optionIds]) => {
  acc[id] = {title, optionIds};
  return acc;
}, {});

const TOOL_SEEDS: Array<[ToolId, ToolSpec]> = [
  [
    'feline-grimace-scale',
    {
      name: 'Feline Grimace Scale',
      shortName: 'Feline Grimace Scale',
      species: 'cat',
      heroImage: 'otFelineHero',
      overviewTitle: 'What is Feline Grimace Scale?',
      overviewParagraphs: [
        'Improving feline health and welfare',
        'Pain is often difficult to recognize in cats due to their unique behavior. Veterinary health professionals do not always receive education on the subject making pain recognition a daily challenge in feline medicine.',
        'The Feline Grimace Scale (FGS) (© Université de Montréal 2019) is a valid, fast, reliable and easy-to-use tool that can help with pain assessment. Based on the scores of the Feline Grimace Scale, it is possible to know if the administration of analgesics (i.e. pain killers) is required helping veterinarians with clinical decisions in pain management.',
      ],
      subtitle:
        'Observe the cat awake and undisturbed from a distance for 30 seconds and then score each FGS action unit.',
      footer: 'Feline Grimace Scale © Université de Montréal',
      stepIds: [
        'fgs-ear-position',
        'fgs-orbital-tightening',
        'fgs-muzzle-tension',
        'fgs-whisker-change',
        'fgs-head-position',
      ],
    },
  ],
  [
    'canine-acute-pain-scale',
    {
      name: 'Canine Acute Pain Scale',
      shortName: 'Canine acute pain scale',
      species: 'dog',
      heroImage: 'otCanineHero',
      overviewTitle: 'What is Canine acute pain scale?',
      overviewParagraphs: [
        'The Canine Acute Pain Scale is a veterinary tool used to evaluate short-term pain in dogs by observing their behavior, body posture, facial expressions, and reactions to touch. It assigns scores based on how comfortable or restless a dog appears at rest, their interest in surroundings, their response to palpation of a wound or surgical site, and the degree of body tension. Each category is rated on a scale, typically from 0 (no pain) to 4 (severe pain), and the scores are combined to determine the overall pain level.',
        'By using a structured approach rather than relying only on subjective observation, the Canine Acute Pain Scale improves accuracy in pain assessment, guides analgesic decisions, and ultimately enhances the animal’s comfort and recovery.',
      ],
      subtitle: "Observe your dog's behaviour and relations. Check all that apply for each pain score level.",
      footer: 'Canine acute pain scale © Colorado State University',
      stepIds: [
        'caps-behaviour-rest',
        'caps-interest-surroundings',
        'caps-response-palpation',
        'caps-wound-interaction',
        'caps-body-tension',
      ],
    },
  ],
  [
    'equine-grimace-scale',
    {
      name: 'Equine Grimace Scale',
      shortName: 'Equine Grimace Scale',
      species: 'horse',
      heroImage: 'otEquineHero',
      overviewTitle: 'What is Equine Grimace Scale?',
      overviewParagraphs: [
        'The Equine Grimace Scale (EGS) is a pain assessment tool developed to recognize and score facial expressions in horses that indicate discomfort or pain. It focuses on subtle changes in facial features such as ear position, orbital tightening (squinting of the eyes), tension above the eyes, nostril shape, and mouth strain. Each feature is scored to create an overall pain score that helps caregivers and veterinarians identify whether a horse is experiencing mild, moderate, or severe pain.',
        'It is widely used in both clinical practice and research to improve pain detection, ensure timely treatment, and enhance animal welfare.',
      ],
      subtitle: "Pay attention to your horse's behavior and interactions. For each pain score level, check all that apply.",
      footer:
        'The Equine Grimace Scale (HGS) is based on research by Dalla Costa, E., Minero, M., Lebelt, D., Stucke, D., Canali, E., & Leach, M.C. (2014). Development of the Horse Grimace Scale (HGS) as a Pain Assessment Tool in Horses. PLOS ONE, 9(3): e92281.',
      stepIds: [
        'egs-ear-position',
        'egs-orbital-tightening',
        'egs-eye-tension',
        'egs-chewing-muscle',
        'egs-mouth-strain',
        'egs-nostril-profile',
      ],
    },
  ],
];


const createOptions = (optionIds: string[]): ObservationalToolOption[] =>
  optionIds.map(id => {
    const spec = OPTION_LIBRARY[id];
    return spec.imageKey
      ? {id, title: spec.title, image: Images[spec.imageKey]}
      : {id, title: spec.title};
  });

const createDefinition = (id: ToolId, spec: ToolSpec): ObservationalToolDefinition => ({
  id,
  name: spec.name,
  shortName: spec.shortName,
  species: spec.species,
  heroImage: Images[spec.heroImage],
  overviewTitle: spec.overviewTitle,
  overviewParagraphs: [...spec.overviewParagraphs],
  emptyState: DEFAULT_EMPTY_STATE,
  steps: spec.stepIds.map(stepId => {
    const step = STEP_LIBRARY[stepId];
    return {
      id: stepId,
      title: step.title,
      subtitle: spec.subtitle,
      options: createOptions(step.optionIds),
      footerNote: spec.footer,
    };
  }),
});

export const observationalToolDefinitions: ObservationalToolDefinitionMap = TOOL_SEEDS.reduce(
  (acc, [toolId, spec]) => {
    acc[toolId] = createDefinition(toolId, spec);
    return acc;
  },
  {} as ObservationalToolDefinitionMap,
);

export const observationalToolProviders: ObservationalToolProviderMap = {
  'feline-grimace-scale': [
    {businessId: 'biz_sfamc', employeeId: 'emp_brown', evaluationFee: 20, appointmentFee: 100},
    {businessId: 'biz_pawpet', employeeId: 'emp_olivia', evaluationFee: 20, appointmentFee: 80},
  ],
  'canine-acute-pain-scale': [
    {businessId: 'biz_sfamc', employeeId: 'emp_emily', evaluationFee: 20, appointmentFee: 100},
    {businessId: 'biz_pawpet', employeeId: 'emp_olivia', evaluationFee: 25, appointmentFee: 85},
  ],
  'equine-grimace-scale': [
    {businessId: 'biz_sfamc', employeeId: 'emp_brown', evaluationFee: 30, appointmentFee: 120},
    {businessId: 'biz_pawpet', employeeId: 'emp_olivia', evaluationFee: 28, appointmentFee: 95},
  ],
};
