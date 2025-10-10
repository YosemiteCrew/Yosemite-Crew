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

// Home Stack Navigator
export type HomeStackParamList = {
  Home: undefined;
  Account: undefined;
};

// Tab Navigator
export type TabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  Appointments: undefined;
  Documents: undefined;
  Tasks: undefined;
};

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;

// Pet Stack Navigator
export type PetStackParamList = {
  PetList: undefined;
  PetDetails: {petId: string};
  AddPet: undefined;
};

export type PetStackScreenProps<T extends keyof PetStackParamList> =
  NativeStackScreenProps<PetStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
