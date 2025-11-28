import {createAsyncThunk} from '@reduxjs/toolkit';
import type {LinkedBusiness, SearchBusinessParams, BusinessSearchResult} from './types';
import {fetchBusinessesBySearch, fetchBusinessPlaceDetails} from '@/shared/services/maps/googlePlaces';
import linkedBusinessesService from './services/linkedBusinessesService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {Images} from '@/assets/images';

type BusinessCategory = 'hospital' | 'boarder' | 'breeder' | 'groomer';
type BusinessTypeMap = Record<BusinessCategory, 'HOSPITAL' | 'BOARDER' | 'BREEDER' | 'GROOMER'>;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ensureAccessToken = async (): Promise<string> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return accessToken;
};

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

// Fetch linked businesses for a companion
export const fetchLinkedBusinesses = createAsyncThunk<
  LinkedBusiness[],
  {companionId: string; category: BusinessCategory},
  {rejectValue: string}
>(
  'linkedBusinesses/fetchLinked',
  async ({companionId, category}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      // Convert lowercase category to uppercase type for API
      const typeMap: BusinessTypeMap = {
        hospital: 'HOSPITAL',
        boarder: 'BOARDER',
        breeder: 'BREEDER',
        groomer: 'GROOMER',
      };

      const response = await linkedBusinessesService.fetchLinkedBusinesses(
        companionId,
        typeMap[category],
        accessToken,
      );

      // API returns {links: [...]} or just [{...}]
      // Handle both response formats
      const organisations = Array.isArray(response) ? response : (response?.links || []);
      const parentLevelEmail = Array.isArray(response) ? undefined : (response as any)?.email;
      const parentLevelPhone = Array.isArray(response) ? undefined : (response as any)?.phoneNumber;
      const parentLevelName = Array.isArray(response) ? undefined : (response as any)?.parentName;

      // Transform API response to LinkedBusiness format
      const linkedBusinesses = organisations.map((link: any) => {
        // Handle nested organisationId object from API response
        const org = link.organisationId || link;
        const inviteStatus = link.status === 'PENDING' ? 'pending' : 'accepted';
        const state = link.status === 'PENDING' ? 'pending' : 'active';

        // For pending invites, organisationName is at root level, not nested
        const businessName = link.organisationName || org.name;

        // Build full address from nested address object
        const fullAddress = org.address
          ? [
              org.address.addressLine,
              org.address.city,
              org.address.state,
              org.address.postalCode,
              org.address.country,
            ]
              .filter(Boolean)
              .join(', ')
          : org.addressLine;

        const linkedBusiness = {
          id: link._id || org.id || `${businessName}-${Date.now()}`,
          companionId,
          businessId: org._id || org.id,
          businessName,
          name: businessName,
          category,
          type: link.organisationType,
          address: fullAddress,
          phone: org.phoneNo || org.phone || (state === 'pending' ? parentLevelPhone : undefined),
          email: org.email || (state === 'pending' ? parentLevelEmail : undefined),
          distance: org.distance,
          rating: org.rating,
          photo: org.imageURL || org.photo,
          placeId: org.googlePlacesId,
          state,
          inviteStatus: inviteStatus as 'pending' | 'accepted' | 'declined',
          linkId: link._id,
          parentName: link.linkedByParentId?.name || (state === 'pending' ? parentLevelName : undefined),
          parentEmail: link.linkedByParentId?.email || (state === 'pending' ? parentLevelEmail : undefined),
          createdAt: link.createdAt || new Date().toISOString(),
          updatedAt: link.updatedAt || new Date().toISOString(),
        } as LinkedBusiness;

        console.log('[LinkedBusinesses] Transformed business:', {
          businessName: linkedBusiness.businessName,
          placeId: linkedBusiness.placeId,
          photo: linkedBusiness.photo,
        });

        return linkedBusiness;
      });

      console.log('[LinkedBusinesses] Fetched', linkedBusinesses.length, 'linked businesses for companion:', companionId);
      return linkedBusinesses;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch linked businesses';
      console.error('[LinkedBusinesses] fetchLinkedBusinesses error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

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

      // Don't fetch place details here - only fetch on user selection
      // This reduces API calls from 10+ per search to just 1
      const results: BusinessSearchResult[] = businesses.map(business => ({
        id: business.id,
        name: business.name,
        address: business.address,
        photo: undefined,
        phone: undefined,
        email: undefined,
        isPMSRecord: false,
        businessId: undefined,
        rating: undefined,
        distance: undefined,
        // Coordinates will be fetched only when user selects the business
        lat: undefined,
        lng: undefined,
      }));

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

      // Fallback to empty array if Google Places fails
      return [] as BusinessSearchResult[];
    }
  },
);

// Check if a business is in PMS system and get organization details
export const checkOrganisation = createAsyncThunk<
  {isPmsOrganisation: boolean; organisationId?: string; organisation?: any; phone?: string; website?: string},
  {
    placeId: string;
    lat: number;
    lng: number;
    name?: string;
    addressLine: string;
  },
  {rejectValue: string}
>(
  'linkedBusinesses/checkOrganisation',
  async (params, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      const result = await linkedBusinessesService.checkBusiness(
        {
          placeId: params.placeId,
          lat: params.lat,
          lng: params.lng,
          name: params.name,
          addressLine: params.addressLine,
        },
        accessToken,
      );

      console.log('[LinkedBusinesses] Organization check result:', result);

      // Extract organisationId from FHIR organisation object if available
      const organisationId = result.organisation?.id;

      // Extract phone and website from telecom array
      let phone: string | undefined;
      let website: string | undefined;

      if (result.organisation?.telecom && Array.isArray(result.organisation.telecom)) {
        for (const telecom of result.organisation.telecom) {
          if (telecom.system === 'phone' && telecom.value) {
            phone = telecom.value;
          } else if (telecom.system === 'url' && telecom.value) {
            website = telecom.value;
          }
        }
      }

      console.log('[LinkedBusinesses] Extracted phone:', phone, 'website:', website);

      return {
        isPmsOrganisation: result.isPmsOrganisation,
        organisationId,
        organisation: result.organisation,
        phone,
        website,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check organization';
      console.error('[LinkedBusinesses] checkOrganisation error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Fetch place details to get coordinates (lazy loading on user selection)
export const fetchPlaceCoordinates = createAsyncThunk<
  {latitude: number; longitude: number},
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/fetchPlaceCoordinates',
  async (placeId, {rejectWithValue}) => {
    try {
      const cacheKey = `coords:${placeId}`;
      const cached = detailsCache.get(cacheKey);

      if (cached && isCacheValid(cached.timestamp, DETAILS_CACHE_DURATION_MS)) {
        return cached.details;
      }

      const details = await fetchBusinessPlaceDetails(placeId);
      const coords = {latitude: details.latitude, longitude: details.longitude};

      detailsCache.set(cacheKey, {details: coords, timestamp: Date.now()});
      return coords;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch coordinates';
      console.error('[LinkedBusinesses] fetchPlaceCoordinates error:', errorMessage);
      return rejectWithValue(errorMessage);
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

// Link a business (PMS record) to companion
export const linkBusiness = createAsyncThunk<
  LinkedBusiness,
  {
    companionId: string;
    organisationId: string;
    category: BusinessCategory;
  },
  {rejectValue: string}
>(
  'linkedBusinesses/link',
  async ({companionId, organisationId, category}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      const typeMap: BusinessTypeMap = {
        hospital: 'HOSPITAL',
        boarder: 'BOARDER',
        breeder: 'BREEDER',
        groomer: 'GROOMER',
      };

      const linkedOrg = await linkedBusinessesService.linkBusiness(
        {
          companionId,
          organisationId,
          organisationType: typeMap[category],
        },
        accessToken,
      );

      // Use linkId as fallback for id if id is not provided by API
      const businessId = linkedOrg.id || linkedOrg.linkId || organisationId;

      const linkedBusiness: LinkedBusiness = {
        id: businessId,
        companionId,
        businessId: businessId,
        businessName: linkedOrg.name,
        name: linkedOrg.name,
        category,
        type: linkedOrg.type,
        address: linkedOrg.address,
        phone: linkedOrg.phone,
        email: linkedOrg.email,
        distance: linkedOrg.distance,
        rating: linkedOrg.rating,
        photo: linkedOrg.photo,
        state: linkedOrg.state,
        inviteStatus: 'accepted',
        linkId: linkedOrg.linkId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('[LinkedBusinesses] Business linked successfully:', businessId);
      return linkedBusiness;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to link business';
      console.error('[LinkedBusinesses] linkBusiness error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Add a linked business (for direct addition of business details)
export const addLinkedBusiness = createAsyncThunk<
  LinkedBusiness,
  {
    companionId: string;
    businessId: string;
    businessName: string;
    category: BusinessCategory;
    address: string;
    phone?: string;
    email?: string;
    distance?: number;
    rating?: number;
    photo?: string;
  },
  {rejectValue: string}
>(
  'linkedBusinesses/add',
  async (params) => {
    const typeMap: BusinessTypeMap = {
      hospital: 'HOSPITAL',
      boarder: 'BOARDER',
      breeder: 'BREEDER',
      groomer: 'GROOMER',
    };

    const now = new Date().toISOString();

    // Create a local linked business object (not calling backend)
    // This is used when adding a business directly without PMS check
    const linkedBusiness: LinkedBusiness = {
      id: params.businessId,
      companionId: params.companionId,
      businessId: params.businessId,
      businessName: params.businessName,
      name: params.businessName,
      category: params.category,
      type: typeMap[params.category],
      address: params.address,
      phone: params.phone,
      email: params.email,
      distance: params.distance,
      rating: params.rating,
      photo: params.photo,
      inviteStatus: 'accepted',
      state: 'active',
      createdAt: now,
      updatedAt: now,
    };

    console.log('[LinkedBusinesses] Added linked business:', linkedBusiness);
    return linkedBusiness;
  },
);

// Invite a business (non-PMS) to connect with companion
export const inviteBusiness = createAsyncThunk<
  {success: boolean; businessEmail: string; businessName: string},
  {
    companionId: string;
    email: string;
    businessName: string;
    category: BusinessCategory;
  },
  {rejectValue: string}
>(
  'linkedBusinesses/invite',
  async ({companionId, email, businessName, category}, {rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      const typeMap: BusinessTypeMap = {
        hospital: 'HOSPITAL',
        boarder: 'BOARDER',
        breeder: 'BREEDER',
        groomer: 'GROOMER',
      };

      const response = await linkedBusinessesService.inviteBusiness(
        {
          companionId,
          email,
          organisationType: typeMap[category],
          name: businessName,
        },
        accessToken,
      );

      console.log('[LinkedBusinesses] Business invited successfully:', email);
      return {
        success: response.success,
        businessEmail: email,
        businessName,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite business';
      console.error('[LinkedBusinesses] inviteBusiness error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Delete/Revoke linked business connection
export const deleteLinkedBusiness = createAsyncThunk<
  string,
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/delete',
  async (linkId: string, {getState, rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      // Get current state to retrieve the business
      const state = getState() as any;
      const allLinkedBusinesses = state.linkedBusinesses.linkedBusinesses || [];

      console.log('[LinkedBusinesses] Attempting to delete business:', linkId);
      console.log('[LinkedBusinesses] Current businesses count:', allLinkedBusinesses.length);

      // Validate that the business exists
      const businessExists = allLinkedBusinesses.find((b: LinkedBusiness) => b.id === linkId || b.linkId === linkId);
      if (!businessExists) {
        console.warn('[LinkedBusinesses] Business not found:', linkId);
        return rejectWithValue('Business not found');
      }

      // Use linkId from the business if available, otherwise use the passed ID
      const idToRevoke = businessExists.linkId || businessExists.id;

      await linkedBusinessesService.revokeLinkedBusiness(idToRevoke, accessToken);

      console.log('[LinkedBusinesses] Successfully deleted business:', linkId);
      return linkId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete business';
      console.error('[LinkedBusinesses] Delete error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Approve a pending business invite
export const acceptBusinessInvite = createAsyncThunk<
  LinkedBusiness,
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/acceptInvite',
  async (linkId: string, {getState, rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      const state = getState() as any;
      const allLinkedBusinesses = state.linkedBusinesses.linkedBusinesses || [];

      // Find the business to get companion details
      const business = allLinkedBusinesses.find((b: LinkedBusiness) => b.linkId === linkId || b.id === linkId);
      if (!business) {
        return rejectWithValue('Business not found');
      }

      const linkedOrg = await linkedBusinessesService.approveLinkInvite(linkId, accessToken);

      const updatedBusiness: LinkedBusiness = {
        ...business,
        ...linkedOrg,
        state: 'active',
        inviteStatus: 'accepted',
        updatedAt: new Date().toISOString(),
      };

      console.log('[LinkedBusinesses] Invite accepted for:', linkId);
      return updatedBusiness;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invite';
      console.error('[LinkedBusinesses] acceptBusinessInvite error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  },
);

// Decline a pending business invite
export const declineBusinessInvite = createAsyncThunk<
  LinkedBusiness,
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/declineInvite',
  async (linkId: string, {getState, rejectWithValue}) => {
    try {
      const accessToken = await ensureAccessToken();

      const state = getState() as any;
      const allLinkedBusinesses = state.linkedBusinesses.linkedBusinesses || [];

      // Find the business
      const business = allLinkedBusinesses.find((b: LinkedBusiness) => b.linkId === linkId || b.id === linkId);
      if (!business) {
        return rejectWithValue('Business not found');
      }

      const linkedOrg = await linkedBusinessesService.denyLinkInvite(linkId, accessToken);

      const updatedBusiness: LinkedBusiness = {
        ...business,
        ...linkedOrg,
        state: 'active',
        inviteStatus: 'declined',
        updatedAt: new Date().toISOString(),
      };

      console.log('[LinkedBusinesses] Invite declined for:', linkId);
      return updatedBusiness;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decline invite';
      console.error('[LinkedBusinesses] declineBusinessInvite error:', errorMessage);
      return rejectWithValue(errorMessage);
    }
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

// Fetch Google Places business image by Google Places ID
export const fetchGooglePlacesImage = createAsyncThunk<
  {photoUrl: string | null},
  string,
  {rejectValue: string}
>(
  'linkedBusinesses/fetchGooglePlacesImage',
  async (googlePlacesId: string) => {
    try {
      if (!googlePlacesId) {
        return {photoUrl: null};
      }

      const cacheKey = `googleImage:${googlePlacesId}`;
      const cached = detailsCache.get(cacheKey);

      if (cached && isCacheValid(cached.timestamp, DETAILS_CACHE_DURATION_MS)) {
        console.log('[GooglePlacesImage] Using cached image for:', googlePlacesId);
        return cached.details;
      }

      console.log('[GooglePlacesImage] Fetching image for Google Places ID:', googlePlacesId);
      const details = await fetchBusinessPlaceDetails(googlePlacesId);
      const result = {photoUrl: details.photoUrl || null};

      detailsCache.set(cacheKey, {details: result, timestamp: Date.now()});

      console.log('[GooglePlacesImage] Fetched image URL:', result.photoUrl);
      return result;
    } catch (error) {
      console.warn('[GooglePlacesImage] Failed to fetch image:', error);
      // Graceful degradation - return null instead of failing
      return {photoUrl: null};
    }
  },
);
