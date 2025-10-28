import {
  selectAuthStatus,
  selectAuthUser,
  selectIsAuthenticated,
  selectAuthIsRefreshing,
  selectAuthState,
} from '@/features/auth/selectors';
import type {RootState} from '@/app/store';
import type {AuthState, User} from '@/features/auth/types';
import type {ExpensesState} from '@/features/expenses';
import type {TasksState} from '@/features/tasks';
import type {AppointmentsState} from '@/features/appointments/types';
import type {BusinessesState} from '@/features/appointments/types';

const createMockExpensesState = (): ExpensesState => ({
  items: [],
  loading: false,
  error: null,
  summaries: {},
  hydratedCompanions: {},
});

const createMockTasksState = (): TasksState => ({
  items: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
});

const createMockAppointmentsState = (): AppointmentsState => ({
  items: [],
  invoices: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
});

const createMockBusinessesState = (): BusinessesState => ({
  businesses: [],
  employees: [],
  availability: [],
  loading: false,
  error: null,
});

const createMockState = (authState: Partial<AuthState>): RootState => ({
  auth: {
    status: 'idle',
    initialized: false,
    user: null,
    provider: null,
    sessionExpiry: null,
    lastRefresh: null,
    isRefreshing: false,
    error: null,
    ...authState,
  },
  theme: {
    theme: 'light',
    isDark: false,
  },
  companion: {
    companions: [],
    selectedCompanionId: null,
    loading: false,
    error: null,
  },
  documents: {
    documents: [],
    loading: false,
    error: null,
    uploadProgress: 0,
  },
  expenses: createMockExpensesState(),
  tasks: createMockTasksState(),
  appointments: createMockAppointmentsState(),
  businesses: createMockBusinessesState(),
  _persist: {
    version: 2,
    rehydrated: true,
  },
} as RootState);

describe('auth selectors', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  describe('selectAuthStatus', () => {
    it('should select idle status', () => {
      const state = createMockState({status: 'idle'});
      expect(selectAuthStatus(state)).toBe('idle');
    });

    it('should select authenticated status', () => {
      const state = createMockState({status: 'authenticated'});
      expect(selectAuthStatus(state)).toBe('authenticated');
    });

    it('should select unauthenticated status', () => {
      const state = createMockState({status: 'unauthenticated'});
      expect(selectAuthStatus(state)).toBe('unauthenticated');
    });

    it('should select initializing status', () => {
      const state = createMockState({status: 'initializing'});
      expect(selectAuthStatus(state)).toBe('initializing');
    });
  });

  describe('selectAuthUser', () => {
    it('should select user when authenticated', () => {
      const state = createMockState({
        status: 'authenticated',
        user: mockUser,
      });

      expect(selectAuthUser(state)).toEqual(mockUser);
    });

    it('should return null when unauthenticated', () => {
      const state = createMockState({
        status: 'unauthenticated',
        user: null,
      });

      expect(selectAuthUser(state)).toBeNull();
    });

    it('should return null for idle state', () => {
      const state = createMockState({status: 'idle'});
      expect(selectAuthUser(state)).toBeNull();
    });
  });

  describe('selectIsAuthenticated', () => {
    it('should return true when authenticated', () => {
      const state = createMockState({
        status: 'authenticated',
        user: mockUser,
      });

      expect(selectIsAuthenticated(state)).toBe(true);
    });

    it('should return false when unauthenticated', () => {
      const state = createMockState({
        status: 'unauthenticated',
      });

      expect(selectIsAuthenticated(state)).toBe(false);
    });

    it('should return false when initializing', () => {
      const state = createMockState({
        status: 'initializing',
      });

      expect(selectIsAuthenticated(state)).toBe(false);
    });

    it('should return false for idle state', () => {
      const state = createMockState({status: 'idle'});
      expect(selectIsAuthenticated(state)).toBe(false);
    });
  });

  describe('selectAuthState', () => {
    it('should select entire auth state', () => {
      const authState: AuthState = {
        status: 'authenticated',
        initialized: true,
        user: mockUser,
        provider: 'amplify',
        sessionExpiry: null,
        lastRefresh: null,
        isRefreshing: false,
        error: null,
      };
      const state = createMockState(authState);

      expect(selectAuthState(state)).toEqual(authState);
    });
  });

  describe('selectAuthIsRefreshing', () => {
    it('should return true when refreshing', () => {
      const state = createMockState({isRefreshing: true});
      expect(selectAuthIsRefreshing(state)).toBe(true);
    });

    it('should return false when not refreshing', () => {
      const state = createMockState({isRefreshing: false});
      expect(selectAuthIsRefreshing(state)).toBe(false);
    });
  });
});
