import countries from "@/app/utils/countryList.json";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {isEmail} from 'validator'

export const validatePhone = (phone: string) => {
  const number = parsePhoneNumberFromString(phone);
  return number?.isValid() || false;
};

export const getCountryCode = (country: string | undefined) => {
  if (!country) {
    return null;
  }
  const temp = countries.filter((c) => c.flag + " " + c.name === country);
  if (temp.length > 0) return temp[0];
  return null;
};

export const isValidEmail = (email: string) => {
  const cleaned = email.trim();
  return isEmail(cleaned);
}