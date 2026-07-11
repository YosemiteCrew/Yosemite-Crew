// ============================================================================
// DEV-ONLY mock session harness  —  MUST be disabled before shipping.
//
// Seeds an authenticated session + a couple of companions into the store so the
// authenticated screens (Home, tabs, etc.) can be rendered on a simulator
// without a live backend, for design verification of the warm-bone rebuild.
//
// Gated so it can NEVER affect a release build or the jest suite: it is only
// active when __DEV__ is true, we are not under jest, and ENABLE is true.
// Flip ENABLE to false (or delete this file + revert AuthContext) when done.
// ============================================================================
import type {AppDispatch} from '@/app/store';
import type {User} from '@/features/auth/types';
import type {Companion} from '@/features/companion/types';
import {setAuthenticated} from '@/features/auth/authSlice';
import {setSelectedCompanion} from '@/features/companion/companionSlice';
import {fetchCompanions} from '@/features/companion/thunks';
import {fetchParentAccess} from '@/features/coParent';
import type {ParentCompanionAccess} from '@/features/coParent';
import type {ParentRole} from '@/features/coParent/types';

const ENABLE = false;

export const DEV_MOCK_SESSION =
  ENABLE &&
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  typeof process !== 'undefined' &&
  process.env?.JEST_WORKER_ID === undefined;

export const MOCK_USER: User = {
  id: 'dev-user-1',
  parentId: 'dev-parent-1',
  email: 'lena.fischer@mail.ch',
  firstName: 'Lena',
  lastName: 'Fischer',
  phone: '+41 79 214 88 30',
  currency: 'EUR',
  profileCompleted: true,
};

const baseCompanion = {
  userId: MOCK_USER.id,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  speciesCode: null,
  breed: null,
  breedCode: null,
  dateOfBirth: null,
  currentWeight: null,
  color: null,
  allergies: null,
  neuteredStatus: 'neutered' as const,
  ageWhenNeutered: null,
  bloodGroup: null,
  microchipNumber: null,
  passportNumber: null,
  insuredStatus: 'not-insured' as const,
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: null,
  origin: 'breeder' as const,
  profileImage: null,
};

export const MOCK_COMPANIONS: Companion[] = [
  {
    ...baseCompanion,
    id: 'dev-poppy',
    name: 'Poppy',
    category: 'dog',
    gender: 'female',
  },
  {
    ...baseCompanion,
    id: 'dev-miso',
    name: 'Miso',
    category: 'cat',
    gender: 'male',
  },
];

// Primary-parent access so the co-parent permission guards on the authenticated
// screens don't show "restricted" empty states for the mock session.
const MOCK_ACCESS: ParentCompanionAccess = {
  parentId: MOCK_USER.parentId ?? MOCK_USER.id,
  role: 'PRIMARY' as unknown as ParentRole,
  status: 'active',
  permissions: {
    assignAsPrimaryParent: true,
    emergencyBasedPermissions: true,
    appointments: true,
    companionProfile: true,
    documents: true,
    expenses: true,
    tasks: true,
    chatWithVet: true,
  },
};

/** Seed the store with a mock authenticated session + companions + access. */
export const seedDevSession = (dispatch: AppDispatch): void => {
  dispatch(setAuthenticated({user: MOCK_USER, provider: 'amplify'}));
  dispatch(
    fetchParentAccess.fulfilled([MOCK_ACCESS], 'dev-access', {
      parentId: MOCK_USER.parentId ?? MOCK_USER.id,
    }),
  );
  dispatch(
    fetchCompanions.fulfilled(
      MOCK_COMPANIONS,
      'dev-seed',
      MOCK_USER.parentId ?? MOCK_USER.id,
    ),
  );
  dispatch(setSelectedCompanion(MOCK_COMPANIONS[0].id));
};
