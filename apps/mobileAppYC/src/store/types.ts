export interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeState {
  isDark: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  weight?: number;
  image?: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PetState {
  pets: Pet[];
  selectedPet: Pet | null;
  isLoading: boolean;
  error: string | null;
}

export interface RootState {
  auth: AuthState;
  theme: ThemeState;
  pets: PetState;
}