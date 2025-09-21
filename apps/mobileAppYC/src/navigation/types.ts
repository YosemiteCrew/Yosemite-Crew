// src/navigation/types.ts - Updated navigation types
import {NavigatorScreenParams} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

// Root Stack Navigator - Add Onboarding
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<TabParamList>;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

// Auth Stack Navigator
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

// Tab Navigator
export type TabParamList = {
  Home: undefined;
  Pets: NavigatorScreenParams<PetStackParamList>;
  Profile: undefined;
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