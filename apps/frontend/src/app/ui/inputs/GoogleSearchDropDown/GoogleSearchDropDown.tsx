import React, { useEffect, useId, useRef, useState } from 'react';
import countries from '@/app/lib/data/countryList';
import { Organisation } from '@yosemite-crew/types';
import { UserProfile } from '@/app/features/users/types/profile';
import { IoIosWarning } from 'react-icons/io';
import { logger } from '@/app/lib/logger';

type GoogleSearchDropDownProps = {
  intype: string;
  inname?: string;
  value: string;
  inlabel: string;
  readonly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  setFormData?: any;
  onlyAddress?: boolean;
  onAddressSelect?: (address: {
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  }) => void;
};

type PlaceDetails = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  location?: {
    latitude: number | null;
    longitude: number | null;
  };
};

type Prediction = {
  kind: 'place' | 'query';
  description: string;
  placeId?: string;
  mainText?: string;
  secondaryText?: string;
  types?: string[];
  distanceMeters?: number;
};

const normalizeGooglePhoneNumber = (number: string) => {
  if (!number) return '';
  let cleaned = number.replaceAll(/\D+/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned;
};

const getAddrComponent = (
  comps: NonNullable<PlaceDetails['addressComponents']>,
  type: string,
  pref: 'longText' | 'shortText' = 'longText'
) => comps.find((c) => c.types?.includes(type))?.[pref] ?? '';

const getPredictionPrimaryText = (prediction: Prediction) =>
  prediction.mainText?.trim() || prediction.description?.trim() || 'Unknown location';

const getPredictionSecondaryText = (prediction: Prediction) => {
  const secondary = prediction.secondaryText?.trim();
  const primary = prediction.mainText?.trim() || '';
  if (secondary) {
    return secondary === primary ? '' : secondary;
  }
  const description = prediction.description?.trim() || '';
  if (!description || description === primary) return '';
  if (primary && description.startsWith(primary)) {
    return description.slice(primary.length).replace(/^,\s*/, '');
  }
  return description;
};

const requestGooglePredictions = async (q: string): Promise<Prediction[]> => {
  const body: any = {
    input: q,
  };
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
  const json = await res.json();
  return (json?.suggestions ?? []).map((s: any) => {
    if (s.placePrediction) {
      const p = s.placePrediction;
      return {
        kind: 'place' as const,
        description: p.text?.text ?? p.structuredFormat?.mainText?.text ?? '',
        placeId: p.placeId,
        mainText: p.structuredFormat?.mainText?.text,
        secondaryText: p.structuredFormat?.secondaryText?.text,
        types: p.types,
        distanceMeters: p.distanceMeters,
      };
    } else if (s.queryPrediction) {
      const qp = s.queryPrediction;
      return {
        kind: 'query' as const,
        description: qp.text?.text ?? qp.structuredFormat?.mainText?.text ?? '',
        mainText: qp.structuredFormat?.mainText?.text,
        secondaryText: qp.structuredFormat?.secondaryText?.text,
      };
    }
    return { kind: 'query', description: '' };
  });
};

const derivePlaceAutofill = (details: PlaceDetails | undefined, fullPredictionText?: string) => {
  const comps = details?.addressComponents ?? [];
  const name = details?.displayName?.text || '';
  const website = details?.websiteUri || '';
  const phone = details?.nationalPhoneNumber || '';

  const countryCode = getAddrComponent(comps, 'country', 'shortText');
  const country = countries.find((c) => c.code === countryCode);
  const city =
    getAddrComponent(comps, 'locality') ||
    getAddrComponent(comps, 'postal_town') ||
    getAddrComponent(comps, 'administrative_area_level_2');
  const state =
    getAddrComponent(comps, 'administrative_area_level_1') ||
    getAddrComponent(comps, 'administrative_area_level_1', 'shortText');
  const postalCode = getAddrComponent(comps, 'postal_code');

  // Derive addressLine from the full prediction text by finding where the
  // city/state/country tail begins and cutting there. State is matched using
  // its long form ("Maharashtra") since shortText ("MH") rarely appears in the
  // prediction string. We find the earliest comma-segment that starts with any
  // of these markers and cut the string at that comma.
  //
  // e.g. "LODHA CROWN, near Majiwada Flyover, ..., EEH, Thane West, Thane, Maharashtra, India"
  //   segments: ["LODHA CROWN","near Majiwada Flyover",...,"EEH","Thane West","Thane","Maharashtra","India"]
  //   city="Thane" first match at segment "Thane West" (startsWith "Thane") → cut before it
  const locationMarkers = [city, state, postalCode, country?.name].filter(Boolean) as string[];

  let addressLine = fullPredictionText ?? details?.formattedAddress ?? '';
  if (locationMarkers.length > 0) {
    const segments = addressLine.split(',');
    let cutSegment = -1;
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i].trim();
      const isLocationSeg = locationMarkers.some(
        (m) =>
          seg.toLowerCase() === m.toLowerCase() || seg.toLowerCase().startsWith(m.toLowerCase())
      );
      if (isLocationSeg) {
        cutSegment = i;
        break;
      }
    }
    if (cutSegment > 0) {
      addressLine = segments.slice(0, cutSegment).join(',').trim();
    }
  }
  addressLine = addressLine.replace(/,\s*$/, '').trim();
  const latitude = details?.location?.latitude ?? null;
  const longitude = details?.location?.longitude ?? null;
  const normalizedAddress = {
    addressLine,
    city,
    state,
    postalCode,
    country: country?.name ?? '',
    latitude: latitude == null ? undefined : Number(latitude),
    longitude: longitude == null ? undefined : Number(longitude),
  };
  return { name, website, phone, normalizedAddress };
};

const GoogleSearchDropDown = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  onBlur: _onBlur,
  readonly,
  error,
  setFormData,
  onlyAddress = false,
  onAddressSelect,
}: Readonly<GoogleSearchDropDownProps>) => {
  const uid = useId();
  const isFocusedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextOpenRef = useRef(false);
  const shouldFetchRef = useRef(false);
  const lastQueriedRef = useRef<string | null>(null);
  lastQueriedRef.current ??= (value ?? '').trim();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const fetchDetails = true;
  const canShowPredictions = !readonly && (value ?? '').trim().length >= 2;
  const isDropdownOpen = open && canShowPredictions;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchPredictions = async (q: string) => {
    if (readonly || q.length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    if (q === lastQueriedRef.current) {
      return;
    }
    try {
      const list = await requestGooglePredictions(q);
      logger.debug('Google places autocomplete results', list);
      lastQueriedRef.current = q;
      setPredictions(list);
      if (!suppressNextOpenRef.current && isFocusedRef.current) setOpen(list.length > 0);
    } catch (err) {
      logger.error('Google places autocomplete failed', err);
      setPredictions([]);
      setOpen(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const q = event.target.value.trim();
    if (!shouldFetchRef.current) return;
    debounceRef.current = setTimeout(() => {
      void fetchPredictions(q);
    }, 400);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  const selectPrediction = async (item: (typeof predictions)[number]) => {
    suppressNextOpenRef.current = true;
    shouldFetchRef.current = false;
    const pickedText = item.mainText ?? item.description ?? '';
    if (onChange && inputRef.current) {
      const target = inputRef.current;
      const event = {
        target: {
          value: pickedText,
          name: target.name,
          id: target.id,
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
    lastQueriedRef.current = pickedText;
    // Full prediction text: "LODHA CROWN, near Majiwada Flyover, ..., Thane, Maharashtra, India"
    const fullPredictionText =
      item.mainText && item.secondaryText
        ? `${item.mainText}, ${item.secondaryText}`
        : (item.description ?? pickedText);
    let details: any = undefined;
    if (fetchDetails && item.kind === 'place' && item.placeId) {
      try {
        const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(item.placeId)}`;
        const fieldMask =
          'id,displayName,formattedAddress,location,types,internationalPhoneNumber,nationalPhoneNumber,websiteUri,addressComponents';
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
            'X-Goog-FieldMask': fieldMask,
          },
        });
        if (res.ok) {
          details = await res.json();
        }
      } catch (e) {
        logger.error('Google place details fetch failed', e);
      }
    }
    autofillFromPlace(details, fullPredictionText);
    logger.debug('Google place details', details);
    setOpen(false);
    setPredictions([]);
    inputRef.current?.focus();
    setTimeout(() => {
      suppressNextOpenRef.current = false;
    }, 0);
  };

  const autofillFromPlace = (details: PlaceDetails | undefined, fullPredictionText?: string) => {
    const { name, website, phone, normalizedAddress } = derivePlaceAutofill(
      details,
      fullPredictionText
    );
    if (onAddressSelect) {
      onAddressSelect(normalizedAddress);
      return;
    }
    if (onlyAddress) {
      setFormData?.((prev: UserProfile) => ({
        ...prev,
        personalDetails: {
          ...prev.personalDetails,
          address: {
            ...prev.personalDetails?.address,
            ...normalizedAddress,
          },
        },
      }));
    } else {
      setFormData?.((prev: Organisation) => ({
        ...prev,
        name,
        phoneNo: normalizeGooglePhoneNumber(phone),
        website,
        googlePlacesId: details?.id,
        address: {
          ...normalizedAddress,
        },
      }));
    }
  };

  const onFocus = () => {
    isFocusedRef.current = true;
    shouldFetchRef.current = true;
    if (predictions.length) setOpen(true);
  };

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <label
        htmlFor={uid}
        className="mb-1.5 block truncate text-[12.5px] font-semibold text-[var(--ink-soft)]"
      >
        {inlabel}
      </label>
      <div className={`relative`}>
        <input
          type={intype}
          name={inname}
          id={uid}
          aria-label={inlabel}
          value={value ?? ''}
          onChange={handleInputChange}
          autoComplete="off"
          readOnly={readonly}
          required
          onFocus={() => {
            if (suppressNextOpenRef.current) return;
            onFocus();
          }}
          ref={inputRef}
          onBlur={() => {
            if (suppressNextOpenRef.current) return;
            isFocusedRef.current = false;
            setOpen(false);
          }}
          className={`
            h-[44px] w-full border-[1.5px] bg-[var(--field-bg)] px-[14px]
            text-[14px] text-[var(--ink-body)] outline-none transition-colors
            placeholder:text-[var(--ink-faint)]
            disabled:cursor-not-allowed disabled:opacity-60
            focus:border-[var(--blue)]! focus:shadow-[0_0_0_3px_var(--glow-b10)]
            ${(() => {
              if (isDropdownOpen) return 'border-[var(--blue)]! rounded-t-[12px]!';
              if (error) return 'border-[var(--danger)]! rounded-[12px]!';
              return 'border-[var(--hairline)]! rounded-[12px]!';
            })()}
          `}
        />
      </div>
      {isDropdownOpen && (
        <div
          className="border-[var(--blue)] max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-[12px] border-l border-r border-b bg-neutral-0 flex flex-col items-center w-full px-[12px] py-[10px]"
          onPointerDown={(e) => e.preventDefault()}
        >
          {predictions?.map((pred, index: number) => (
            <button
              className="flex w-full flex-col items-start gap-1 rounded-2xl! px-[1.25rem] py-[0.75rem] text-left hover:bg-card-hover"
              key={pred.placeId ?? `${pred.kind}-${pred.description}-${index}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectPrediction(pred);
                inputRef.current?.focus();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectPrediction(pred);
                inputRef.current?.focus();
              }}
            >
              <span className="w-full text-left text-body-4-emphasis text-text-primary">
                {getPredictionPrimaryText(pred)}
              </span>
              {getPredictionSecondaryText(pred) ? (
                <span className="w-full text-left text-caption-1 text-text-secondary">
                  {getPredictionSecondaryText(pred)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-caption-2 text-text-error">
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default GoogleSearchDropDown;
