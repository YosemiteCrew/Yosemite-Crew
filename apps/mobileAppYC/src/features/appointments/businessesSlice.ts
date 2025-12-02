import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import type {BusinessesState, VetBusiness, VetService, SlotWindow} from './types';
import {appointmentApi} from './services/appointmentsService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const SAMPLE_ORG: VetBusiness = {
  id: '6929bdac95f3c615e6198371',
  name: 'Happy Paws Veterinary Center',
  category: 'hospital',
  address: '742 Evergreen Terrace, Springfield, IL, 62704, USA',
  distanceMeters: 2792,
  rating: 0,
  photo: 'https://cdn.example.com/orgs/happypaws/logo.png',
  phone: '+1-555-010-7788',
  openHours: undefined,
};

const SAMPLE_SERVICE: VetService = {
  id: '6929c3ce96b79db0be005c15',
  businessId: SAMPLE_ORG.id,
  specialty: 'Cardiology',
  specialityId: '6929bf2d95f3c615e6198379',
  name: 'General Health Checkup',
  basePrice: 49.99,
};

const ensureAccessTokenOptional = async (): Promise<string | null> => {
  try {
    const tokens = await getFreshStoredTokens();
    const accessToken = tokens?.accessToken ?? null;
    if (!accessToken) {
      return null;
    }
    if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
      return null;
    }
    return accessToken;
  } catch {
    return null;
  }
};

const DEFAULT_NEARBY = {lat: 23, lng: 34.909, page: 1};
const DEFAULT_SEARCH = {
  serviceName: '',
  lat: 39.7834,
  lng: -89.625,
};

type FetchBusinessesArgs = {
  lat?: number;
  lng?: number;
  page?: number;
  serviceName?: string;
};

export const fetchBusinesses = createAsyncThunk<
  {businesses: VetBusiness[]; services: VetService[]; meta?: any},
  FetchBusinessesArgs | undefined
>('businesses/fetch', async (params, {rejectWithValue}) => {
  try {
    const accessToken = await ensureAccessTokenOptional();
    const nearby = await appointmentApi.fetchNearbyBusinesses({
      // lat: params?.lat ?? DEFAULT_NEARBY.lat,
      // lng: params?.lng ?? DEFAULT_NEARBY.lng,
       lat: 35.9054685,
  lng: -86.38299789999999,
      page: params?.page ?? DEFAULT_NEARBY.page,
      accessToken: accessToken ?? undefined,
    });

    let search = {businesses: [] as VetBusiness[], services: [] as VetService[]};
    if (params?.serviceName) {
      search = await appointmentApi.searchBusinessesByService({
        serviceName: params.serviceName,
        lat: params.lat ?? DEFAULT_SEARCH.lat,
        lng: params.lng ?? DEFAULT_SEARCH.lng,
        accessToken: accessToken ?? undefined,
      });
    }

    const mergedBusinesses = [...nearby.businesses, ...search.businesses];
    const mergedServices = [...nearby.services, ...search.services];

    return {
      businesses: mergedBusinesses.length ? mergedBusinesses : [SAMPLE_ORG],
      services: mergedServices.length ? mergedServices : [SAMPLE_SERVICE],
      meta: nearby.meta,
    };
  } catch (error) {
    return rejectWithValue(toErrorMessage(error, 'Failed to fetch businesses'));
  }
});

export const fetchServiceSlots = createAsyncThunk(
  'businesses/fetchServiceSlots',
  async (
    {
      businessId,
      serviceId,
      date,
    }: {businessId: string; serviceId: string; date: string},
    {rejectWithValue},
  ) => {
    try {
      const accessToken = await ensureAccessTokenOptional();
      const {date: resolvedDate, windows} = await appointmentApi.fetchBookableSlots({
        serviceId,
        organisationId: businessId,
        date,
        accessToken: accessToken ?? undefined,
      });
      return {businessId, serviceId, date: resolvedDate, windows};
    } catch (error) {
      return rejectWithValue(toErrorMessage(error, 'Failed to fetch availability'));
    }
  },
);

const initialState: BusinessesState = {
  businesses: [],
  employees: [],
  services: [],
  availability: [],
  loading: false,
  error: null,
};

const dedupeById = <T extends {id: string}>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach(item => {
    map.set(item.id, {...(map.get(item.id) ?? {} as T), ...item});
  });
  return Array.from(map.values());
};

const isDummyPhoto = (photo?: string | null) =>
  typeof photo === 'string' &&
  (photo.includes('example.com') || photo.includes('placeholder'));

const businessesSlice = createSlice({
  name: 'businesses',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBusinesses.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBusinesses.fulfilled, (state, action) => {
        state.loading = false;
        const incomingBusinesses = action.payload.businesses.length
          ? action.payload.businesses
          : [SAMPLE_ORG];
        const incomingServices = action.payload.services.length
          ? action.payload.services
          : [SAMPLE_SERVICE];
        // Replace (not append) to avoid stale or duplicate mock data
        state.businesses = dedupeById(incomingBusinesses);
        state.services = dedupeById(incomingServices);
      })
      .addCase(fetchBusinesses.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Failed to fetch businesses';
      })
      .addCase(fetchBusinessDetails.fulfilled, (state, action) => {
        const {placeId, photoUrl, phoneNumber, website} = action.payload as any;
        if (!placeId) return;
        const biz = state.businesses.find(b => b.googlePlacesId === placeId);
        if (biz) {
          if (photoUrl && (!biz.photo || isDummyPhoto(biz.photo as string))) {
            biz.photo = photoUrl;
          }
          biz.phone = biz.phone || phoneNumber || biz.phone;
          biz.website = biz.website || website || biz.website;
        }
      })
      .addCase(fetchGooglePlacesImage.fulfilled, (state, action) => {
        const {photoUrl} = action.payload;
        if (!photoUrl) return;
        state.businesses = state.businesses.map(b => {
          const shouldReplace = !b.photo || isDummyPhoto(b.photo as string);
          return shouldReplace ? {...b, photo: photoUrl} : b;
        });
      })
      .addCase(fetchServiceSlots.fulfilled, (state, action) => {
        const {businessId, serviceId, date, windows} = action.payload as {
          businessId: string;
          serviceId: string;
          date: string;
          windows: SlotWindow[];
        };
        const idx = state.availability.findIndex(
          av => av.businessId === businessId && av.serviceId === serviceId,
        );
        if (idx >= 0) {
          state.availability[idx] = {
            ...state.availability[idx],
            slotsByDate: {
              ...state.availability[idx].slotsByDate,
              [date]: windows,
            },
          };
        } else {
          state.availability.push({
            businessId,
            serviceId,
            slotsByDate: {[date]: windows},
          });
        }
      });
  },
});

export default businessesSlice.reducer;
