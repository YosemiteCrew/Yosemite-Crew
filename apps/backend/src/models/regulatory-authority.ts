import { Schema, model } from "mongoose";

const RegulatoryAuthoritySchema = new Schema(
  {
    country: String,
    iso2: String,
    iso3: String,

    authorityName: String,
    phone: String,
    email: String,
    website: String,
    notes: String,

    sourceUrl: String,
  },
  { timestamps: false },
);

export const RegulatoryAuthorityModel = model(
  "RegulatoryAuthority",
  RegulatoryAuthoritySchema,
);
