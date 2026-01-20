import countries from "@/app/utils/countryList.json";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { isEmail } from "validator";

export const validatePhone = (phone: string) => {
  const number = parsePhoneNumberFromString(phone);
  return number?.isValid() || false;
};

export const getCountryCode = (country: string | undefined) => {
  if (!country) {
    return null;
  }
  const temp = countries.filter((c) => c.name === country);
  if (temp.length > 0) return temp[0];
  return null;
};

export const isValidEmail = (email: string) => {
  const cleaned = email.trim();
  return isEmail(cleaned);
};

export const toTitleCase = (value = "") => {
  if (typeof value !== "string" || !value.length) return "";
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
};

export const toTitle = (str = "") => {
  const s = String(str)
    .trim()
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .toLowerCase();

  return s.charAt(0).toUpperCase() + s.slice(1);
};
