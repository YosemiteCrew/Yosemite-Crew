import React, { useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@/hooks';
import { Images } from '@/assets/images';
import AERLayout from '@/features/adverseEventReporting/components/AERLayout';
import LegalContentRenderer from '@/features/legal/components/LegalContentRenderer';
import type { AdverseEventStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AdverseEventStackParamList, 'Landing'>;

const generalInfoSections = [
  {
    id: 'general-info-label',
    title:'',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'Caring for your companion means not only choosing the right treatments and products but also keeping track of how they respond. While most veterinary medicines, supplements, and health products are safe and effective when used as directed, sometimes pets may experience unexpected side effects or unusual reactions.\n\nThis is known as an adverse event. Reporting these events is vital as it helps protect your companion, other animals, and ensures that manufacturers and veterinarians can monitor product safety closely.',
          },
        ],
      },
    ],
  },
  {
    id: 'what-is-adverse',
    title: 'What is an adverse event?',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'An adverse event can be:',
          },
        ],
      },
      {
        type: 'ordered-list' as const,
        items: [
          {
            marker: '•',
            segments: [{ text: 'Side effects (vomiting, diarrhoea, loss of appetite, skin reactions, lethargy, seizures, etc.)' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Unexpected reactions (allergic responses, changes in behaviour, swelling, breathing difficulties)' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Product issues (defective packaging, wrong dosage markings, unusual smell/appearance)' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Lack of effectiveness (when the medicine or product doesn\'t work as expected, even when used correctly)' }],
          },
        ],
      },
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'If you\'re ever unsure, it\'s always better to report the event.',
          },
        ],
      },
    ],
  },
  {
    id: 'why-report',
    title: 'Why reporting matters?',
    align: 'left' as const,
    blocks: [
      {
        type: 'ordered-list' as const,
        items: [
          {
            marker: '•',
            segments: [{ text: 'Protects your companion: Helps your veterinarian adjust treatment safely.' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Improves safety for all pets: Reports are analysed by pharmaceutical companies, vets, and regulators to identify risks.' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Strengthens trust: Ensures accountability and ongoing product improvements.' }],
          },
        ],
      },
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'Your report could prevent harm to other pets in the future.',
          },
        ],
      },
    ],
  },
  {
    id: 'how-to-report',
    title: 'How to report in our app?',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'We\'ve made the process simple and guided, step by step:',
          },
        ],
      },
      {
        type: 'ordered-list' as const,
        items: [
          {
            marker: '1.',
            segments: [{ text: 'Identify yourself: Pet parent or guardian (Co-Parent).' }],
          },
          {
            marker: '2.',
            segments: [{ text: 'Enter your details: Basic contact information.' }],
          },
          {
            marker: '3.',
            segments: [{ text: 'Hospital information: Where your pet is being treated (optional if at home).' }],
          },
          {
            marker: '4.',
            segments: [{ text: 'Companion details: Name, species, age, weight, health history, allergies.' }],
          },
          {
            marker: '5.',
            segments: [{ text: 'Product details: Product name, brand, dosage, administration method, number of times used.' }],
          },
          {
            marker: '6.',
            segments: [{ text: 'Describe the event: What you noticed before and after giving the product. Add images if possible.' }],
          },
          {
            marker: '7.',
            segments: [{ text: 'Submit securely: Reports can be sent directly to:' }],
          },
        ],
      },
      {
        type: 'ordered-list' as const,
        items: [
          {
            marker: '       •',
            segments: [{ text: 'The manufacturer (Pharma company)' }],
          },
          {
            marker: '       •',
            segments: [{ text: 'Your veterinarian' }],
          },
          {
            marker: '       •',
            segments: [{ text: 'Or escalated to a regulatory authority (e.g., FDA/EMA, depending on your region)' }],
          },
        ],
      },
    ],
  },
  {
    id: 'follow-up',
    title: 'You can also choose whether you\'d like to be contacted for follow-up?',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'This allows us to collect additional information if needed for the regulatory submission.',
          },
        ],
      },
    ],
  },
  {
    id: 'privacy-safety',
    title: 'Your privacy & safety',
    align: 'left' as const,
    blocks: [
      {
        type: 'ordered-list' as const,
        items: [
          {
            marker: '•',
            segments: [{ text: 'All information you provide is handled confidentially and securely.' }],
          },
          {
            marker: '•',
            segments: [{ text: 'Your data will only be shared with veterinary professionals, manufacturers, or regulators for safety investigations.' }],
          },
          {
            marker: '•',
            segments: [{ text: 'You remain in control: We\'ll always ask before contacting you.' }],
          },
        ],
      },
    ],
  },
  {
    id: 'emergency',
    title: 'What to do immediately if your companion is in danger?',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'If your pet shows severe symptoms (difficulty breathing, seizures, collapse), please contact your veterinarian or an emergency clinic right away. Reporting is important, but immediate care comes first.',
          },
        ],
      },
    ],
  },
  {
    id: 'together',
    title: 'Together for safer companion health',
    align: 'left' as const,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          {
            text: 'By submitting a report, you\'re contributing to a larger effort that protects animals everywhere. Every report matters, whether it\'s a mild skin reaction or a serious issue.\n\nYour vigilance helps improve veterinary medicine for all companions.',
          },
        ],
      },
    ],
  },
];

export const LandingScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleStartReporting = () => {
    navigation.navigate('Step1');
  };

  return (
    <AERLayout
      stepLabel="General information"
      onBack={() => navigation.goBack()}
      bottomButton={{ title: 'Start', onPress: handleStartReporting }}
    >
      <Image source={Images.adverse1} style={styles.heroImage} />
      <View style={styles.contentWrapper}>
        <LegalContentRenderer sections={generalInfoSections} />
      </View>
    </AERLayout>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    heroImage: {
      width: '100%',
      height: 250,
      resizeMode: 'contain',
      marginTop: -theme.spacing[6],
    },
    contentWrapper: {
      marginBottom: theme.spacing[6],
    },
  });
