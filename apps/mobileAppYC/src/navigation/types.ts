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

export type ExpenseStackParamList = {
  ExpensesMain: undefined;
  ExpensesEmpty: undefined;
  AddExpense: undefined;
  EditExpense: { expenseId: string };
  ExpensePreview: { expenseId: string };
  ExpensesList: { mode: 'inApp' | 'external' };
};

// Tab Navigator
export type TabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  Appointments: undefined;
  Documents: NavigatorScreenParams<DocumentStackParamList>;
  Tasks: undefined;
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
