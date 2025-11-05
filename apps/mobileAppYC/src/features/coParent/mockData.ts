import type {CoParent} from './types';

// Mock data for testing
export const MOCK_CO_PARENTS: CoParent[] = [
  {
    id: 'cp_001',
    userId: 'user_001',
    email: 'skyb@gmail.com',
    firstName: 'Sky',
    lastName: 'B',
    phoneNumber: '+1234567890',
    profilePicture: undefined,
    companions: [
      {
        companionId: 'comp_001',
        companionName: 'Kizie',
        breed: 'Golden Retriever',
        profileImage: undefined,
        hasPermission: true,
      },
      {
        companionId: 'comp_002',
        companionName: 'Oscar',
        breed: 'Egyptian Mau',
        profileImage: undefined,
        hasPermission: true,
      },
    ],
    permissions: {
      assignAsPrimaryParent: true,
      emergencyBasedPermissions: true,
      appointments: true,
      companionProfile: false,
      documents: true,
      expenses: true,
      tasks: true,
      chatWithVet: false,
    },
    status: 'accepted',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T15:45:00Z',
  },
];

// Mock data for searchable users (existing users in the system)
export const MOCK_SEARCHABLE_CO_PARENTS: CoParent[] = [
  {
    id: 'user_search_001',
    userId: 'user_001',
    email: 'pikaam@gmail.com',
    firstName: 'Pika',
    lastName: 'Martin',
    phoneNumber: '4130890367',
    profilePicture: undefined,
    companions: [
      {
        companionId: 'comp_oscar',
        companionName: 'Oscar',
        breed: 'Egyptian Mau',
        profileImage: undefined,
        hasPermission: false,
      },
    ],
    permissions: {
      assignAsPrimaryParent: false,
      emergencyBasedPermissions: false,
      appointments: false,
      companionProfile: false,
      documents: false,
      expenses: false,
      tasks: false,
      chatWithVet: false,
    },
    status: 'pending',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-10T08:00:00Z',
  },
  {
    id: 'user_search_002',
    userId: 'user_002',
    email: 'johndeo@gmail.com',
    firstName: 'John',
    lastName: 'Deo',
    phoneNumber: '5551234567',
    profilePicture: undefined,
    companions: [],
    permissions: {
      assignAsPrimaryParent: false,
      emergencyBasedPermissions: false,
      appointments: false,
      companionProfile: false,
      documents: false,
      expenses: false,
      tasks: false,
      chatWithVet: false,
    },
    status: 'pending',
    createdAt: '2024-01-12T12:00:00Z',
    updatedAt: '2024-01-12T12:00:00Z',
  },
];
