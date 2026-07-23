import React from 'react';
import {LegalScreen} from '../components/LegalScreen';
import {PRIVACY_POLICY_SECTIONS} from '../data/privacyPolicyData';
import {PRIVACY_META} from '../data/legalMeta';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {LegalStackParamList} from '@/navigation/types';

type PrivacyScreenProps = NativeStackScreenProps<
  LegalStackParamList,
  'PrivacyPolicy'
>;

export const PrivacyPolicyScreen: React.FC<PrivacyScreenProps> = props => (
  <LegalScreen
    {...props}
    title="Privacy Policy"
    docType="privacy"
    sections={PRIVACY_POLICY_SECTIONS}
    meta={PRIVACY_META}
    navChips={['What we collect', 'How it is used', 'Your rights']}
  />
);

export default PrivacyPolicyScreen;
