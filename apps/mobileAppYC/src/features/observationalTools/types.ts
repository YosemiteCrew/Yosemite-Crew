import type {ImageSourcePropType} from 'react-native';
import type {CompanionCategory} from '@/features/companion/types';

export interface ObservationalToolOption {
  id: string;
  title: string;
  subtitle?: string;
  image?: ImageSourcePropType;
}

export interface ObservationalToolStep {
  id: string;
  title: string;
  subtitle: string;
  required?: boolean;
  helperText?: string;
  heroImage?: ImageSourcePropType;
  footerNote?: string;
  options: ObservationalToolOption[];
  allowMultiple?: boolean;
}

export interface ObservationalToolDefinition {
  id: string;
  name: string;
  shortName: string;
  species: CompanionCategory;
  heroImage: ImageSourcePropType;
  overviewTitle: string;
  overviewParagraphs: string[];
  overviewAttribution?: string;
  emptyState: {
    title: string;
    message: string;
    image: ImageSourcePropType;
  };
  steps: ObservationalToolStep[];
}

export interface ObservationalToolProviderPricing {
  businessId: string;
  employeeId?: string;
  evaluationFee: number;
  appointmentFee: number;
}

export type ObservationalToolDefinitionMap = Record<
  string,
  ObservationalToolDefinition
>;

export type ObservationalToolProviderMap = Record<
  string,
  ObservationalToolProviderPricing[]
>;

export type ObservationalToolResponses = Record<string, any>;

export interface ObservationalToolBookingContext {
  toolId: string;
  provider?: ObservationalToolProviderPricing;
  responses: ObservationalToolResponses;
  submissionId?: string;
}
