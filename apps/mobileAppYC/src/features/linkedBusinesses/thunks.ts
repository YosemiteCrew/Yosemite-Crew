import {createAsyncThunk} from '@reduxjs/toolkit';
import type {LinkedBusiness, SearchBusinessParams, BusinessSearchResult} from './types';
import {fetchBusinessesBySearch, fetchBusinessPlaceDetails} from '@/shared/services/maps/googlePlaces';
import {Images} from '@/assets/images';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory cache for search results to prevent duplicate API calls
const searchCache = new Map<string, {results: BusinessSearchResult[]; timestamp: number}>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache validity

// In-memory cache for business details to prevent duplicate detail fetches
const detailsCache = new Map<string, {details: any; timestamp: number}>();
const DETAILS_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache validity

const getCacheKey = (query: string, location?: {latitude: number; longitude: number} | null): string => {
  if (!location) {
    return `search:${query.toLowerCase()}`;
  }
  return `search:${query.toLowerCase()}:${location.latitude},${location.longitude}`;
};

const isCacheValid = (timestamp: number, duration: number): boolean => {
  return Date.now() - timestamp < duration;
};

// Mock PMS businesses for matching with Google Places results
const pmsBusiness = {
  'biz_sfamc': {
    id: 'biz_sfamc',
    name: 'San Francisco Animal Medical Center',
    rating: 4.1,
    distance: 2.5,
  },
  'biz_pawpet': {
    id: 'biz_pawpet',
    name: 'Paw Pet Health Clinic',
    rating: 4.4,
    distance: 4.2,
  },
  'biz_tender_groom': {
    id: 'biz_tender_groom',
    name: 'Tender Loving Care Pet Grooming',
    rating: 4.2,
    distance: 3.6,
  },
  'biz_oakvet': {
    id: 'biz_oakvet',
    name: 'OakVet Animal Specialty Hospital',
    rating: 4.5,
    distance: 2.8,
  },
  'biz_bay_corgis': {
    id: 'biz_bay_corgis',
    name: 'Bay Area Corgis',
    rating: 4.3,
    distance: 8.1,
  },
};

// Helper to check if a place matches our PMS records
const checkIfPMSBusiness = (placeName: string): {id: string; rating: number; distance: number} | null => {
  const name = placeName.toLowerCase();
  for (const [key, business] of Object.entries(pmsBusiness)) {
    if (name.includes(business.name.toLowerCase()) || business.name.toLowerCase().includes(name)) {
      return {id: key, rating: business.rating, distance: business.distance};
    }
  }
  return null;
};

// Search businesses by Google Places query
export const searchBusinessesByLocation = createAsyncThunk(
  'linkedBusinesses/searchByLocation',
  async (params: SearchBusinessParams) => {
    try {
      // Check cache first to prevent duplicate API calls
      const cacheKey = getCacheKey(params.query, params.location);
      const cachedResult = searchCache.get(cacheKey);

      if (cachedResult && isCacheValid(cachedResult.timestamp, CACHE_DURATION_MS)) {
        console.log('[BusinessSearch] Using cached results for query:', params.query);
        return cachedResult.results;
      }

      // Fetch businesses from Google Places Text Search API (ONE API CALL ONLY)
      // This uses the dedicated business search endpoint, separate from address suggestions
      const businesses = await fetchBusinessesBySearch({
        query: params.query,
        location: params.location,
      });

      // Transform business results with PMS matching
      // DO NOT call fetchPlaceDetails here - it wastes API quota (1+N calls instead of 1)
      // Details (phone, email, photo) will be fetched only when user selects a business
      const results: BusinessSearchResult[] = businesses.map(business => {
        // Check if this place is in our PMS records
        const pmsMatch = checkIfPMSBusiness(business.name);

        return {
          id: business.id,
          name: business.name,
          address: business.address,
          photo: undefined, // Photos will be fetched only on selection
          phone: undefined, // Phone will be fetched only on selection
          email: undefined, // Email will be fetched only on selection
          isPMSRecord: pmsMatch !== null,
          businessId: pmsMatch?.id,
          rating: pmsMatch?.rating,
          distance: pmsMatch?.distance,
        };
      });

      // Store in cache
      searchCache.set(cacheKey, {results, timestamp: Date.now()});

      console.log('[BusinessSearch] Fetched', results.length, 'business results using Text Search API');
      return results;
    } catch (error: any) {
      console.error('[BusinessSearch] Google Places API error:', error);

      // Check if it's a quota exceeded error
      const isQuotaError = error?.message?.includes('RESOURCE_EXHAUSTED') ||
                          error?.message?.includes('Quota exceeded');

      if (isQuotaError) {
        console.warn('[BusinessSearch] Google Places quota exceeded, using mock results');
      }

      // Fallback to mock results if Google Places fails
      return [
        {
          id: 'mock_1',
          name: 'San Francisco Animal Medical Center',
          address: '2343 Fillmore St, San Francisco, CA 94115',
          phone: '+1 (415) 555-0123',
          email: 'https://www.sfamc.com',
          photo: Images.sampleHospital1,
          isPMSRecord: true,
          businessId: 'biz_sfamc',
          rating: 4.1,
          distance: 2.5,
        },
        {
          id: 'mock_2',
          name: 'Paw Pet Health Clinic',
          address: 'SFAM Building 30 square D Road San Francisco',
          phone: '+1 (415) 555-0456',
          email: 'https://www.pawpet.com',
          photo: Images.sampleHospital2,
          isPMSRecord: true,
          businessId: 'biz_pawpet',
          rating: 4.4,
          distance: 4.2,
        },
      ] as BusinessSearchResult[];
    }
  },
);

// Search businesses by QR code (PMSBusinessCode)
export const searchBusinessByQRCode = createAsyncThunk(
  'linkedBusinesses/searchByQRCode',
  async (pmsBusinessCode: string) => {
    await delay(800);
    // Mock API call to get business details from QR code
    const mockBusinessMap: Record<string, any> = {
      'PMS_SFAMC_001': {
        id: 'biz_sfamc',
        name: 'San Francisco Animal Medical Center',
        address: '2343 Fillmore St, San Francisco, CA 94115',
        photo: Images.sampleHospital1,
        isPMSRecord: true,
        businessId: 'biz_sfamc',
        rating: 4.1,
        distance: 2.5,
        category: 'hospital',
      },
      'PMS_PAWPET_001': {
        id: 'biz_pawpet',
        name: 'Paw Pet Health Clinic',
        address: 'SFAM Building 30 square D Road San Francisco',
        photo: Images.sampleHospital2,
        isPMSRecord: true,
        businessId: 'biz_pawpet',
        rating: 4.4,
        distance: 4.2,
        category: 'hospital',
      },
      'PMS_TENDERCARE_001': {
        id: 'biz_tender_groom',
        name: 'Tender Loving Care Pet Grooming',
        address: 'San Francisco, CA',
        photo: Images.sampleHospital3,
        isPMSRecord: true,
        businessId: 'biz_tender_groom',
        rating: 4.2,
        distance: 3.6,
        category: 'groomer',
      },
    };

    const business = mockBusinessMap[pmsBusinessCode];
    if (!business) {
      throw new Error('Business not found for this QR code');
    }
    return business;
  },
);

// Add linked business to companion
export const addLinkedBusiness = createAsyncThunk(
  'linkedBusinesses/add',
  async (params: {
    companionId: string;
    businessId: string;
    businessName: string;
    category: 'hospital' | 'boarder' | 'breeder' | 'groomer';
    pmsBusinessCode?: string;
    address?: string;
    phone?: string;
    email?: string;
    distance?: number;
    rating?: number;
    photo?: any;
  }) => {
    await delay(600);
    const linkedBusiness: LinkedBusiness = {
      id: `linked_${Date.now()}`,
      companionId: params.companionId,
      businessId: params.businessId,
      businessName: params.businessName,
      category: params.category,
      address: params.address,
      phone: params.phone,
      email: params.email,
      distance: params.distance,
      rating: params.rating,
      photo: params.photo,
      pmsBusinessCode: params.pmsBusinessCode,
      inviteStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return linkedBusiness;
  },
);

// Delete linked business - with proper AsyncStorage persistence
export const deleteLinkedBusiness = createAsyncThunk<
  string,
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/delete',
  async (linkedBusinessId: string, {getState, rejectWithValue}) => {
    try {
      await delay(600);

      // Get current state to retrieve all linked businesses
      const state = getState() as any;
      const allLinkedBusinesses = state.linkedBusinesses.linkedBusinesses || [];

      console.log('[LinkedBusinesses] Attempting to delete business:', linkedBusinessId);
      console.log('[LinkedBusinesses] Current businesses count:', allLinkedBusinesses.length);

      // Validate that the business exists
      const businessExists = allLinkedBusinesses.find((b: LinkedBusiness) => b.id === linkedBusinessId);
      if (!businessExists) {
        console.warn('[LinkedBusinesses] Business not found:', linkedBusinessId);
        return rejectWithValue('Business not found');
      }

      // After deletion, the Redux reducer will filter it out
      // But we need to persist to AsyncStorage via redux-persist
      // The persistence is now handled automatically since we added linkedBusinesses to whitelist
      console.log('[LinkedBusinesses] Successfully deleted business:', linkedBusinessId);
      return linkedBusinessId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete business';
      console.error('[LinkedBusinesses] Delete error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Accept business invite
export const acceptBusinessInvite = createAsyncThunk(
  'linkedBusinesses/acceptInvite',
  async (linkedBusinessId: string) => {
    await delay(600);
    return linkedBusinessId;
  },
);

// Decline business invite
export const declineBusinessInvite = createAsyncThunk(
  'linkedBusinesses/declineInvite',
  async (linkedBusinessId: string) => {
    await delay(600);
    return linkedBusinessId;
  },
);

// Fetch detailed business information from Google Places
// IMPORTANT: This should ONLY be called when user explicitly selects and confirms a business
// Using cache to prevent duplicate detail fetches
export const fetchBusinessDetails = createAsyncThunk(
  'linkedBusinesses/fetchDetails',
  async (placeId: string) => {
    try {
      // Check cache first
      const cachedDetails = detailsCache.get(placeId);
      if (cachedDetails && isCacheValid(cachedDetails.timestamp, DETAILS_CACHE_DURATION_MS)) {
        console.log('[BusinessDetails] Using cached details for placeId:', placeId);
        return cachedDetails.details;
      }

      const details = await fetchBusinessPlaceDetails(placeId);
      const result = {
        placeId,
        photoUrl: details.photoUrl,
        phoneNumber: details.phoneNumber,
        website: details.website,
      };

      // Store in cache
      detailsCache.set(placeId, {details: result, timestamp: Date.now()});

      return result;
    } catch (error: any) {
      console.error('[BusinessDetails] Failed to fetch details:', error);
      // Return partial data on error - the component will use fallback values
      return {
        placeId,
        photoUrl: undefined,
        phoneNumber: undefined,
        website: undefined,
      };
    }
  },
);
