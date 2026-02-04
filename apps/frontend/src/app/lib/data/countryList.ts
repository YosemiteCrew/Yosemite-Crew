import rawCountries from "./countryList.json";

export type Country = {
  name: string;
  flag?: string;
  code?: string;
  dial_code?: string;
};

const countries = rawCountries as Country[];

export default countries;
