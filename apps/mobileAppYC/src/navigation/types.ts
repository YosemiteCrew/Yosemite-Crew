// src/navigation/types.ts - Updated navigation types
import {NavigatorScreenParams} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {AuthStackParamList} from './AuthNavigator';

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
  AddCompanion: undefined;
  ProfileOverview: { companionId: string };
  EditCompanionOverview: { companionId: string };
  EditParentOverview:{ companionId: string };
  ExpensesStack: NavigatorScreenParams<ExpenseStackParamList>;
};

export type DocumentStackParamList = {
  DocumentsMain: undefined;
  AddDocument: undefined;
  EditDocument: { documentId: string };
  DocumentPreview: { documentId: string };
  CategoryDetail: { categoryId: string };
};

// Appointment stack
export type AppointmentStackParamList = {
  MyAppointmentsEmpty: undefined;
  MyAppointments: { resetKey?: number } | undefined;
  BrowseBusinesses: undefined;
  BusinessDetails: { businessId: string };
  BookingForm: { businessId: string; employeeId?: string; appointmentType?: string };
  ViewAppointment: { appointmentId: string };
  PaymentInvoice: { appointmentId: string; companionId?: string };
  PaymentSuccess: { appointmentId: string; companionId?: string };
  Review: { appointmentId: string };
  Chat: { appointmentId: string };
  EditAppointment: { appointmentId: string; mode?: 'reschedule' };
  BusinessesList: { category: 'hospital' | 'groomer' | 'breeder' | 'pet_center' | 'boarder' };
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
  TasksList: { category: 'health' | 'hygiene' | 'dietary' | 'custom' };
  AddTask: undefined;
  TaskView: { taskId: string; source?: 'home' | 'tasks' };
  EditTask: { taskId: string; source?: 'home' | 'tasks' };
  ObservationalTool: { taskId: string };
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
