export interface LinkedBusiness {
  id: string;
  companionId: string;
  businessId?: string;
  businessName: string;
  name?: string;
  category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
  type?: 'HOSPITAL' | 'BOARDER' | 'BREEDER' | 'GROOMER';
  address?: string;
  phone?: string;
  email?: string;
  distance?: number;
  rating?: number;
  photo?: any;
  inviteStatus?: 'pending' | 'accepted' | 'declined';
  state?: 'active' | 'pending';
  pmsBusinessCode?: string;
  linkId?: string;
  parentName?: string;
  parentEmail?: string;
  isPMSRecord?: boolean;
  placeId?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedBusinessesState {
  linkedBusinesses: LinkedBusiness[];
  loading: boolean;
  error: null | string;
  selectedCategory?: 'hospital' | 'boarder' | 'breeder' | 'groomer';
}

export interface SearchBusinessParams {
  query: string;
  location?: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface BusinessSearchResult {
  id: string;
  name: string;
  address: string;
  photo?: any;
  phone?: string;
  email?: string;
  isPMSRecord: boolean;
  businessId?: string;
  rating?: number;
  distance?: number;
  lat?: number;
  lng?: number;
}
