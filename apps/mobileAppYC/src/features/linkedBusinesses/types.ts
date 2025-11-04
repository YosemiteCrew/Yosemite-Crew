export interface LinkedBusiness {
  id: string;
  companionId: string;
  businessId: string;
  businessName: string;
  category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
  address?: string;
  distance?: number;
  rating?: number;
  photo?: any;
  inviteStatus?: 'pending' | 'accepted' | 'declined';
  pmsBusinessCode?: string;
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
  isPMSRecord: boolean;
  businessId?: string;
  rating?: number;
  distance?: number;
}
