import React, { useEffect, useRef, useState } from 'react';
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

const GoogleSearchDropDown = ({
  intype,
  inname,
  inlabel,
  value,
  onChange,
  onBlur,
  readonly,
  error,
  setFormData,
  onlyAddress = false,
  onAddressSelect,
}: Readonly<GoogleSearchDropDownProps>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextOpenRef = useRef(false);
  const shouldFetchRef = useRef(false);
  const lastQueriedRef = useRef<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const fetchDetails = true;

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

  useEffect(() => {
    lastQueriedRef.current = (value ?? '').trim();
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount to initialize lastQueriedRef
  }, []);

  useEffect(() => {
    const q = (value ?? '').trim();
    if (readonly || q.length < 2) {
      setOpen(false);
      setPredictions([]);
      return;
    }
    if (!shouldFetchRef.current) {
      return;
    }
    if (q === lastQueriedRef.current) {
      return;
    }
    const handle = setTimeout(async () => {
      try {
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
        const list: Prediction[] = (json?.suggestions ?? []).map((s: any) => {
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
        logger.debug('Google places autocomplete results', list);
        lastQueriedRef.current = q;
        setPredictions(list);
        if (!suppressNextOpenRef.current && isFocused) setOpen(list.length > 0);
      } catch (err) {
        logger.error('Google places autocomplete failed', err);
        setPredictions([]);
        setOpen(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [value, readonly, isFocused]);

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

  const normalizePhoneNumber = (number: string) => {
    if (!number) return '';
    let cleaned = number.replaceAll(/\D+/g, '');
    cleaned = cleaned.replace(/^0+/, '');
    return cleaned;
  };

  const getAddr = (
    comps: NonNullable<PlaceDetails['addressComponents']>,
    type: string,
    pref: 'longText' | 'shortText' = 'longText'
  ) => comps.find((c) => c.types?.includes(type))?.[pref] ?? '';

  const autofillFromPlace = (details: PlaceDetails, fullPredictionText?: string) => {
    const comps = details.addressComponents ?? [];
    const name = details.displayName?.text || '';
    const website = details.websiteUri || '';
    const phone = details.nationalPhoneNumber || '';

    const countryCode = getAddr(comps, 'country', 'shortText');
    const country = countries.find((c) => c.code === countryCode);
    const city =
      getAddr(comps, 'locality') ||
      getAddr(comps, 'postal_town') ||
      getAddr(comps, 'administrative_area_level_2');
    const state =
      getAddr(comps, 'administrative_area_level_1') ||
      getAddr(comps, 'administrative_area_level_1', 'shortText');
    const postalCode = getAddr(comps, 'postal_code');

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

    let addressLine = fullPredictionText ?? details.formattedAddress ?? '';
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
    const latitude = details.location?.latitude ?? null;
    const longitude = details.location?.longitude ?? null;
    const normalizedAddress = {
      addressLine,
      city,
      state,
      postalCode,
      country: country?.name ?? '',
      latitude: latitude == null ? undefined : Number(latitude),
      longitude: longitude == null ? undefined : Number(longitude),
    };
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
        phoneNo: normalizePhoneNumber(phone),
        website,
        googlePlacesId: details.id,
        address: {
          ...normalizedAddress,
        },
      }));
    }
  };

  const onFocus = () => {
    setIsFocused(true);
    shouldFetchRef.current = true;
    if (predictions.length) setOpen(true);
  };

  return (
    <div className="w-full relative" ref={dropdownRef}>
      <div className={`relative`}>
        <input
          type={intype}
          name={inname}
          id={inname}
          value={value ?? ''}
          onChange={onChange}
          autoComplete="off"
          readOnly={readonly}
          required
          placeholder=" "
          onFocus={() => {
            if (suppressNextOpenRef.current) return;
            onFocus();
          }}
          ref={inputRef}
          onBlur={() => {
            if (suppressNextOpenRef.current) return;
            setIsFocused(false);
            setOpen(false);
          }}
          className={`
            peer w-full min-h-12 bg-transparent px-6 py-2.5
            text-body-4 text-text-primary
            outline-none border
            ${error && 'border-input-border-error'}
            focus:border-input-border-active!
            ${open ? 'border-input-border-active! rounded-t-2xl!' : 'border-input-border-default! rounded-2xl!'}
          `}
        />
        <label
          htmlFor={inname}
          className={`
            pointer-events-none absolute left-6
            top-1/2 -translate-y-1/2
            text-body-4 text-input-text-placeholder
            transition-all duration-200
            peer-focus:-top-[11px] peer-focus:translate-y-0
            peer-focus:text-sm!
            peer-focus:text-input-text-placeholder-active
            peer-focus:bg-(--whitebg)
            peer-focus:px-1 peer-not-placeholder-shown:px-1
            peer-not-placeholder-shown:-top-[11px] peer-not-placeholder-shown:translate-y-0
            peer-not-placeholder-shown:text-sm!
            peer-not-placeholder-shown:bg-(--whitebg)
          `}
        >
          {inlabel}
        </label>
      </div>
      {open && (
        <div
          className="border-input-border-active max-h-[200px] overflow-y-auto scrollbar-hidden z-99 absolute top-[100%] left-0 rounded-b-2xl border-l border-r border-b bg-white flex flex-col items-center w-full px-[12px] py-[10px]"
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
        <div
          className={`
            mt-1.5 flex items-center gap-1 px-4
            text-caption-2 text-text-error
          `}
        >
          <IoIosWarning className="text-text-error" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default GoogleSearchDropDown;
