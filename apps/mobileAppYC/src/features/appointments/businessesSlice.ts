import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import type {BusinessesState, VetBusiness, VetService, SlotWindow} from './types';
import {appointmentApi} from './services/appointmentsService';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {fetchBusinessDetails, fetchGooglePlacesImage} from '@/features/linkedBusinesses';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

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
      lat: params?.lat ?? DEFAULT_NEARBY.lat,
      lng: params?.lng ?? DEFAULT_NEARBY.lng,
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
      businesses: mergedBusinesses,
      services: mergedServices,
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

const toDateFromTime = (time: string | null | undefined, date: string): Date | null => {
  if (!time) return null;
  const [yyyy, mm, dd] = date.split('-').map(Number);
  const [hh, min] = time.split(':').map(Number);
  if ([yyyy, mm, dd, hh, min].some(n => Number.isNaN(n))) {
    const fallback = new Date(`${date}T${time}`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const utcMillis = Date.UTC(yyyy, (mm ?? 1) - 1, dd ?? 1, hh ?? 0, min ?? 0);
  return new Date(utcMillis);
};

const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const toLocalTimeString = (d: Date | null) =>
  d
    ? d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: deviceTimeZone,
      })
    : null;

const normalizeSlotsToLocal = (windows: SlotWindow[] | undefined, date: string): SlotWindow[] => {
  if (!windows?.length) {
    return [];
  }
  return windows.map(window => {
    const startDate = toDateFromTime(window.startTime ?? (window as any)?.start, date);
    const endDate = toDateFromTime(window.endTime ?? (window as any)?.end ?? window.startTime, date);
    const startLocal = toLocalTimeString(startDate) ?? window.startTime;
    const endLocal = toLocalTimeString(endDate) ?? window.endTime ?? window.startTime;
    return {
      ...window,
      startTime: startLocal ?? '',
      endTime: endLocal ?? '',
      startTimeLocal: startLocal ?? undefined,
      endTimeLocal: endLocal ?? undefined,
      startTimeUtc: startDate?.toISOString(),
      endTimeUtc: endDate?.toISOString(),
    };
  });
};

const businessesSlice = createSlice({
  name: 'businesses',
  initialState,
  reducers: {
    resetBusinessesState: () => initialState,
  },
  extraReducers: builder => {
    builder
      .addCase(fetchBusinesses.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBusinesses.fulfilled, (state, action) => {
        state.loading = false;
        // Replace (not append) to avoid stale data and preserve empty responses
        state.businesses = dedupeById(action.payload.businesses);
        state.services = dedupeById(action.payload.services);
      })
      .addCase(fetchBusinesses.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? 'Failed to fetch businesses';
      })
      .addCase(fetchBusinessDetails.fulfilled, (state, action) => {
        const {placeId, photoUrl, phoneNumber, website} = action.payload;
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
        const normalizedWindows = normalizeSlotsToLocal(windows, date);
        const idx = state.availability.findIndex(
          av => av.businessId === businessId && av.serviceId === serviceId,
        );
        if (idx >= 0) {
          state.availability[idx] = {
            ...state.availability[idx],
            slotsByDate: {
              ...state.availability[idx].slotsByDate,
              [date]: normalizedWindows,
            },
          };
        } else {
          state.availability.push({
            businessId,
            serviceId,
            slotsByDate: {[date]: normalizedWindows},
          });
        }
      });
  },
});

export const {resetBusinessesState} = businessesSlice.actions;
export default businessesSlice.reducer;
