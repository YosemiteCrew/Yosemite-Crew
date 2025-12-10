import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AdverseEventStackParamList } from './types';

import { LandingScreen } from '@/features/adverseEventReporting/screens/LandingScreen';
import { Step1Screen } from '@/features/adverseEventReporting/screens/Step1Screen';
import { Step2Screen } from '@/features/adverseEventReporting/screens/Step2Screen';
import { Step3Screen } from '@/features/adverseEventReporting/screens/Step3Screen';
import { Step4Screen } from '@/features/adverseEventReporting/screens/Step4Screen';
import { Step5Screen } from '@/features/adverseEventReporting/screens/Step5Screen';
import { ThankYouScreen } from '@/features/adverseEventReporting/screens/ThankYouScreen';
import {AdverseEventReportProvider} from '@/features/adverseEventReporting/state/AdverseEventReportContext';

const Stack = createNativeStackNavigator<AdverseEventStackParamList>();

export const AdverseEventStackNavigator = () => {
  return (
    <AdverseEventReportProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Step1" component={Step1Screen} />
        <Stack.Screen name="Step2" component={Step2Screen} />
        <Stack.Screen name="Step3" component={Step3Screen} />
        <Stack.Screen name="Step4" component={Step4Screen} />
        <Stack.Screen name="Step5" component={Step5Screen} />
        <Stack.Screen name="ThankYou" component={ThankYouScreen} />
      </Stack.Navigator>
    </AdverseEventReportProvider>
  );
};
