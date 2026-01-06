// src/navigation/types.ts - Updated navigation types
import {NavigatorScreenParams} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {AuthStackParamList} from './AuthNavigator';
import type {TaskCategory} from '@/features/tasks/types';
import type {ObservationalToolBookingContext} from '@/features/observationalTools/types';
import type {OrganisationDocumentCategory} from '@/features/legal/services/organisationDocumentService';

// Root Stack Navigator - Add Onboarding
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<TabParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;


export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type HomeStackParamList = {
  Home: undefined;
  Account: undefined;
  FAQ: undefined;
  ContactUs: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  AddCompanion: undefined;
  Notifications: undefined;
  ProfileOverview: { companionId: string };
  EditCompanionOverview: { companionId: string };
  EditParentOverview:{ companionId: string };
  ExpensesStack: NavigatorScreenParams<ExpenseStackParamList>;
  LinkedBusinesses: NavigatorScreenParams<LinkedBusinessStackParamList>;
  AdverseEvent: NavigatorScreenParams<AdverseEventStackParamList>;
  CoParents: undefined;
  AddCoParent: undefined;
  EditCoParent: { coParentId: string };
  CoParentProfile: { coParentId: string };
};

export type LinkedBusinessStackParamList = {
  BusinessSearch: {
    companionId: string;
    companionName: string;
    companionBreed?: string;
    companionImage?: string;
    category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
  };
  BusinessAdd: {
    companionId: string;
    companionName: string;
    companionBreed?: string;
    companionImage?: string;
    category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
    businessId: string;
    businessName: string;
    businessAddress: string;
    phone?: string;
    email?: string;
    photo?: any;
    isPMSRecord: boolean;
    rating?: number;
    distance?: number;
    placeId: string;
    organisationId?: string;
    returnTo?: {tab: keyof TabParamList; screen?: string};
  };
  QRScanner: {
    companionId: string;
    companionName: string;
    companionBreed?: string;
    companionImage?: string;
    category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
  };
};

export type CoParentStackParamList = {
  CoParents: undefined;
  AddCoParent: undefined;
  EditCoParent: { coParentId: string };
  CoParentProfile: { coParentId: string };
};

export type DocumentStackParamList = {
  DocumentsMain: undefined;
  AddDocument: undefined;
  EditDocument: { documentId: string };
  DocumentPreview: { documentId: string };
  CategoryDetail: { categoryId: string };
  DocumentSearch: undefined;
};

// Appointment stack
export type AppointmentStackParamList = {
  MyAppointmentsEmpty: undefined;
  MyAppointments: { resetKey?: number } | undefined;
  BrowseBusinesses: { serviceName?: string; autoFocusSearch?: boolean } | undefined;
  BusinessDetails: { businessId: string; returnTo?: {tab: keyof TabParamList; screen?: string} };
  BookingForm: {
    businessId: string;
    serviceId?: string;
    serviceName?: string;
    serviceSpecialty?: string;
    serviceSpecialtyId?: string;
    employeeId?: string;
    appointmentType?: string;
    otContext?: ObservationalToolBookingContext;
  };
  ViewAppointment: { appointmentId: string };
  PaymentInvoice: {
    appointmentId: string;
    companionId?: string;
    invoice?: import('@/features/appointments/types').Invoice | null;
    paymentIntent?: import('@/features/appointments/types').PaymentIntentInfo | null;
  };
  PaymentSuccess: { appointmentId: string; companionId?: string };
  Review: { appointmentId: string };
  Chat: { appointmentId: string };
  ChatChannel: {
    appointmentId: string;
    vetId: string;
    appointmentTime: string;
    doctorName: string;
    petName?: string;
  };
  EditAppointment: { appointmentId: string; mode?: 'reschedule' };
  BusinessesList: { category: 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder' | 'clinic' };
  OrganisationDocument: {
    organisationId: string;
    organisationName?: string | null;
    category: OrganisationDocumentCategory;
  };
  AppointmentForm: {
    appointmentId: string;
    formId: string;
    mode?: 'fill' | 'view';
    allowSign?: boolean;
  };
  FormSigning: {
    appointmentId: string;
    submissionId: string;
    signingUrl?: string | null;
    formTitle?: string | null;
  };
};

export type ExpenseStackParamList = {
  ExpensesMain: undefined;
  ExpensesEmpty: undefined;
  AddExpense: undefined;
  EditExpense: { expenseId: string };
  ExpensePreview: { expenseId: string };
  ExpensesList: { mode: 'inApp' | 'external' };
};

export type TaskStackParamList = {
  TasksMain: undefined;
  TasksList: { category: TaskCategory };
  AddTask: { reuseTaskId?: string } | undefined;
  TaskView: { taskId: string; source?: 'home' | 'tasks' };
  EditTask: { taskId: string; source?: 'home' | 'tasks' };
  ObservationalTool: { taskId: string };
  ObservationalToolPreview: { taskId: string; submissionId?: string | null; toolId?: string | null };
};

export type AdverseEventStackParamList = {
  Landing: undefined;
  Step1: undefined;
  Step2: undefined;
  Step3: undefined;
  Step4: undefined;
  Step5: undefined;
  ThankYou: undefined;
};

// Tab Navigator
export type TabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  Appointments: NavigatorScreenParams<AppointmentStackParamList>;
  Documents: NavigatorScreenParams<DocumentStackParamList>;
  Tasks: NavigatorScreenParams<TaskStackParamList>;
};

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;


declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
