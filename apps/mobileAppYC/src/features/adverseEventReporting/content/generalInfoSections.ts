import type {LegalSection, TextSegment, OrderedListItem} from '@/features/legal/data/legalContentTypes';

const p = (text: string) => ({type: 'paragraph' as const, segments: [{text}] satisfies TextSegment[]});
const bullets = (items: string[], marker = '•'): {type: 'ordered-list'; items: OrderedListItem[]} => ({
  type: 'ordered-list',
  items: items.map(text => ({marker, segments: [{text}]})),
});
const ol = (items: string[]) => ({
  type: 'ordered-list' as const,
  items: items.map((text, idx) => ({marker: `${idx + 1}.`, segments: [{text}]})),
});

export const generalInfoSections: LegalSection[] = [
  {
    id: 'general-info-label',
    title: '',
    align: 'left',
    blocks: [
      p(
        'Caring for your companion means not only choosing the right treatments and products but also keeping track of how they respond. While most veterinary medicines, supplements, and health products are safe and effective when used as directed, sometimes pets may experience unexpected side effects or unusual reactions.\n\nThis is known as an adverse event. Reporting these events is vital as it helps protect your companion, other animals, and ensures that manufacturers and veterinarians can monitor product safety closely.',
      ),
    ],
  },
  {
    id: 'what-is-adverse',
    title: 'What is an adverse event?',
    align: 'left',
    blocks: [
      p('An adverse event can be:'),
      bullets([
        'Side effects (vomiting, diarrhoea, loss of appetite, skin reactions, lethargy, seizures, etc.)',
        'Unexpected reactions (allergic responses, changes in behaviour, swelling, breathing difficulties)',
        'Product issues (defective packaging, wrong dosage markings, unusual smell/appearance)',
        "Lack of effectiveness (when the medicine or product doesn't work as expected, even when used correctly)",
      ]),
      p("If you're ever unsure, it's always better to report the event."),
    ],
  },
  {
    id: 'why-report',
    title: 'Why reporting matters?',
    align: 'left',
    blocks: [
      bullets([
        'Protects your companion: Helps your veterinarian adjust treatment safely.',
        'Improves safety for all pets: Reports are analysed by pharmaceutical companies, vets, and regulators to identify risks.',
        'Strengthens trust: Ensures accountability and ongoing product improvements.',
      ]),
      p('Your report could prevent harm to other pets in the future.'),
    ],
  },
  {
    id: 'how-to-report',
    title: 'How to report in our app?',
    align: 'left',
    blocks: [
      p("We've made the process simple and guided, step by step:"),
      ol([
        'Identify yourself: Pet parent or guardian (Co-Parent).',
        'Enter your details: Basic contact information.',
        'Hospital information: Where your pet is being treated (optional if at home).',
        'Companion details: Name, species, age, weight, health history, allergies.',
        'Product details: Product name, brand, dosage, administration method, number of times used.',
        'Describe the event: What you noticed before and after giving the product. Add images if possible.',
        'Submit securely: Reports can be sent directly to:',
      ]),
      bullets([
        'The manufacturer (Pharma company)',
        'Your veterinarian',
        'Or escalated to a regulatory authority (e.g., FDA/EMA, depending on your region)',
      ], '       •'),
    ],
  },
  {
    id: 'follow-up',
    title: "You can also choose whether you'd like to be contacted for follow-up?",
    align: 'left',
    blocks: [
      p('This allows us to collect additional information if needed for the regulatory submission.'),
    ],
  },
  {
    id: 'privacy-safety',
    title: 'Your privacy & safety',
    align: 'left',
    blocks: [
      bullets([
        'All information you provide is handled confidentially and securely.',
        'Your data will only be shared with veterinary professionals, manufacturers, or regulators for safety investigations.',
        "You remain in control: We'll always ask before contacting you.",
      ]),
    ],
  },
  {
    id: 'emergency',
    title: 'What to do immediately if your companion is in danger?',
    align: 'left',
    blocks: [
      p('If your pet shows severe symptoms (difficulty breathing, seizures, collapse), please contact your veterinarian or an emergency clinic right away. Reporting is important, but immediate care comes first.'),
    ],
  },
  {
    id: 'together',
    title: 'Together for safer companion health',
    align: 'left',
    blocks: [
      p("By submitting a report, you're contributing to a larger effort that protects animals everywhere. Every report matters, whether it's a mild skin reaction or a serious issue.\n\nYour vigilance helps improve veterinary medicine for all companions."),
    ],
  },
];

