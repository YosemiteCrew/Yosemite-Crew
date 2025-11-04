import {createAsyncThunk} from '@reduxjs/toolkit';
import type {LinkedBusiness, SearchBusinessParams, BusinessSearchResult} from './types';
import {fetchPlaceSuggestions, fetchPlaceDetails} from '@/shared/services/maps/googlePlaces';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      // Fetch suggestions from Google Places API
      const suggestions = await fetchPlaceSuggestions({
        query: params.query,
        location: params.location,
      });

      // Transform suggestions into business results
      const results: BusinessSearchResult[] = [];

      for (const suggestion of suggestions) {
        try {
          // Fetch detailed information for each place
          const details = await fetchPlaceDetails(suggestion.placeId);

          // Check if this place is in our PMS records
          const pmsMatch = checkIfPMSBusiness(suggestion.primaryText);

          results.push({
            id: suggestion.placeId,
            name: suggestion.primaryText,
            address: details.formattedAddress || suggestion.secondaryText || '',
            photo: details.photo,
            isPMSRecord: pmsMatch !== null,
            businessId: pmsMatch?.id,
            rating: pmsMatch?.rating,
            distance: pmsMatch?.distance,
          });
        } catch (error) {
          console.error(`[BusinessSearch] Failed to fetch details for ${suggestion.placeId}:`, error);
          // Still include the result from the suggestion even if details fetch fails
          const pmsMatch = checkIfPMSBusiness(suggestion.primaryText);
          results.push({
            id: suggestion.placeId,
            name: suggestion.primaryText,
            address: suggestion.secondaryText || '',
            photo: undefined,
            isPMSRecord: pmsMatch !== null,
            businessId: pmsMatch?.id,
            rating: pmsMatch?.rating,
            distance: pmsMatch?.distance,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[BusinessSearch] Google Places API error:', error);
      // Fallback to mock results if Google Places fails
      return [
        {
          id: 'mock_1',
          name: 'San Francisco Animal Medical Center',
          address: '2343 Fillmore St, San Francisco, CA 94115',
          isPMSRecord: true,
          businessId: 'biz_sfamc',
          rating: 4.1,
          distance: 2.5,
        },
        {
          id: 'mock_2',
          name: 'Paw Pet Health Clinic',
          address: 'SFAM Building 30 square D Road San Francisco',
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
  }) => {
    await delay(600);
    const linkedBusiness: LinkedBusiness = {
      id: `linked_${Date.now()}`,
      companionId: params.companionId,
      businessId: params.businessId,
      businessName: params.businessName,
      category: params.category,
      pmsBusinessCode: params.pmsBusinessCode,
      inviteStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return linkedBusiness;
  },
);

// Delete linked business
export const deleteLinkedBusiness = createAsyncThunk(
  'linkedBusinesses/delete',
  async (linkedBusinessId: string) => {
    await delay(600);
    return linkedBusinessId;
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
