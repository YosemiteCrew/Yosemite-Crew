import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import countries from "../../../utils/countryList.json";
import { Organisation } from "@yosemite-crew/types";
import { UserProfile } from "@/app/types/profile";

import "./GoogleSearchDropDown.css";

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
}: Readonly<GoogleSearchDropDownProps>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressNextOpenRef = useRef(false);
  const shouldFetchRef = useRef(false);
  const lastQueriedRef = useRef<string>("");
  const [predictions, setPredictions] = useState<any>([]);
  const fetchDetails = true;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    lastQueriedRef.current = (value ?? "").trim();
    setOpen(false);
  }, []);

  useEffect(() => {
    const q = (value ?? "").trim();
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
        const res = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key":
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
            },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
        const json = await res.json();
        const list: Array<{
          kind: "place" | "query";
          description: string;
          placeId?: string;
          mainText?: string;
          secondaryText?: string;
          types?: string[];
          distanceMeters?: number;
        }> = (json?.suggestions ?? []).map((s: any) => {
          if (s.placePrediction) {
            const p = s.placePrediction;
            return {
              kind: "place" as const,
              description:
                p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
              placeId: p.placeId,
              mainText: p.structuredFormat?.mainText?.text,
              secondaryText: p.structuredFormat?.secondaryText?.text,
              types: p.types,
              distanceMeters: p.distanceMeters,
            };
          } else if (s.queryPrediction) {
            const qp = s.queryPrediction;
            return {
              kind: "query" as const,
              description:
                qp.text?.text ?? qp.structuredFormat?.mainText?.text ?? "",
              mainText: qp.structuredFormat?.mainText?.text,
              secondaryText: qp.structuredFormat?.secondaryText?.text,
            };
          }
          return { kind: "query", description: "" };
        });
        console.log(list);
        lastQueriedRef.current = q;
        setPredictions(list);
        if (!suppressNextOpenRef.current && isFocused) setOpen(list.length > 0);
      } catch (err) {
        console.error(err);
        setPredictions([]);
        setOpen(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [value, readonly, isFocused]);

  const selectPrediction = async (item: (typeof predictions)[number]) => {
    suppressNextOpenRef.current = true;
    shouldFetchRef.current = false;
    const pickedText = item.mainText ?? item.description ?? "";
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
    let details: any = undefined;
    if (fetchDetails && item.kind === "place" && item.placeId) {
      try {
        const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(item.placeId)}`;
        const fieldMask =
          "id,displayName,formattedAddress,location,types,internationalPhoneNumber,nationalPhoneNumber,websiteUri,addressComponents";
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
            "X-Goog-FieldMask": fieldMask,
          },
        });
        if (res.ok) {
          details = await res.json();
        }
      } catch (e) {
        console.error(e);
      }
    }
    autofillFromPlace(details);
    console.log(details);
    setOpen(false);
    setPredictions([]);
    inputRef.current?.focus();
    setTimeout(() => {
      suppressNextOpenRef.current = false;
    }, 0);
  };

  const normalizePhoneNumber = (number: string) => {
    if (!number) return "";
    let cleaned = number.replaceAll(/\D+/g, "");
    cleaned = cleaned.replace(/^0+/, "");
    return cleaned;
  };

  const getAddr = (
    comps: NonNullable<PlaceDetails["addressComponents"]>,
    type: string,
    pref: "longText" | "shortText" = "longText"
  ) => comps.find((c) => c.types?.includes(type))?.[pref] ?? "";

  const autofillFromPlace = (details: PlaceDetails) => {
    const comps = details.addressComponents ?? [];
    const name = details.displayName?.text || "";
    const website = details.websiteUri || "";
    const phone = details.nationalPhoneNumber || "";

    const address = details.formattedAddress || "";
    const countryCode = getAddr(comps, "country", "shortText");
    const country = countries.find((c) => c.code === countryCode);
    const combinedCountry = country
      ? `${country.flag ?? ""} ${country.name ?? ""}`.trim()
      : "";
    const city =
      getAddr(comps, "locality") ||
      getAddr(comps, "postal_town") ||
      getAddr(comps, "administrative_area_level_2"); // fallback
    const state =
      getAddr(comps, "administrative_area_level_1", "shortText") ||
      getAddr(comps, "administrative_area_level_1");
    const postalCode = getAddr(comps, "postal_code");
    const latitude = details.location?.latitude ?? null;
    const longitude = details.location?.longitude ?? null;
    if (onlyAddress) {
      setFormData?.((prev: UserProfile) => ({
        ...prev,
        personalDetails: {
          ...prev.personalDetails,
          address: {
            ...prev.personalDetails?.address,
            addressLine: address,
            city: city,
            state: state,
            postalCode: postalCode,
            latitude: Number(latitude),
            longitude: Number(longitude),
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
          country: combinedCountry,
          addressLine: address,
          city: city,
          state: state,
          postalCode: postalCode,
          latitude: Number(latitude),
          longitude: Number(longitude),
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
    <div className="w-100 search-container" ref={dropdownRef}>
      <div
        className={`SignInput floating-input ${isFocused || value ? "focused" : ""}`}
      >
        <input
          type={intype}
          name={inname}
          id={inname}
          value={value ?? ""}
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
          className={error ? "is-invalid" : ""}
        />
        <label htmlFor={inname}>{inlabel}</label>
      </div>
      {open && (
        <div
          className="search-dropdown"
          onPointerDown={(e) => e.preventDefault()}
        >
          {predictions?.map((pred: any) => (
            <button
              className="search-dropdown-item"
              key={pred.placeId}
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
              {pred.mainText ?? pred.description ?? ""}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="Errors">
          <Icon icon="mdi:error" width="16" height="16" />
          {error}
        </div>
      )}
    </div>
  );
};

export default GoogleSearchDropDown;
