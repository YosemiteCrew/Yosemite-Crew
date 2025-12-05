import React from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {LegalScreen} from '../components/LegalScreen';
import {PRIVACY_POLICY_SECTIONS} from '../data/privacyPolicyData';

if (__DEV__) {
  try {
    console.debug('PrivacyPolicyScreen: PRIVACY_POLICY_SECTIONS typeof', typeof PRIVACY_POLICY_SECTIONS, 'isArray', Array.isArray(PRIVACY_POLICY_SECTIONS), 'len', Array.isArray(PRIVACY_POLICY_SECTIONS) ? PRIVACY_POLICY_SECTIONS.length : 'N/A');
  } catch (err) {
    // consume
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _err = err;
  }
}
import type {HomeStackParamList} from '@/navigation/types';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';

type LegalStackParamList = HomeStackParamList & AuthStackParamList;
type PrivacyScreenProps = NativeStackScreenProps<LegalStackParamList, 'PrivacyPolicy'>;

export const PrivacyPolicyScreen: React.FC<PrivacyScreenProps> = (props) => (
  <LegalScreen
    {...props}
    title="Privacy Policy"
    sections={PRIVACY_POLICY_SECTIONS}
  />
);

export default PrivacyPolicyScreen;
