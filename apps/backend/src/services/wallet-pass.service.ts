import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import AdmZip from "adm-zip";
import forge from "node-forge";
import jwt from "jsonwebtoken";
import type { PetPassportDTO } from "@yosemite-crew/types";

// Thrown when the Apple Wallet signing material is not present in the
// environment. 501 (Not Implemented) so the route degrades gracefully on
// deployments that have not been provisioned with a Pass Type ID certificate.
export class WalletNotConfiguredError extends Error {
  constructor(
    message = "Apple Wallet is not configured.",
    public readonly statusCode = 501,
  ) {
    super(message);
    this.name = "WalletNotConfiguredError";
  }
}

const SPECIES_LABEL: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  horse: "Horse",
  other: "Animal",
};

// Brand styling shared by both wallets (design-system --color-primary-500).
const WALLET_BRAND_HEX = "#007CF5";
const WALLET_BRAND_RGB = "rgb(0, 124, 245)";
const BRAND_R = 0;
const BRAND_G = 124;
const BRAND_B = 245;

// The Yosemite heart logo (1024px), committed at
// apps/mobileAppYC/src/assets/images/yosemite-logo-1024.png and served raw from
// the public repo. Used as the default so wallet passes carry the brand logo
// even when PUBLIC_WALLET_LOGO_URL is not configured.
const DEFAULT_WALLET_LOGO_URL =
  "https://raw.githubusercontent.com/YosemiteCrew/Yosemite-Crew/main/apps/mobileAppYC/src/assets/images/yosemite-logo-1024.png";

// Brand imagery. Google fetches these public HTTPS URLs itself; the Apple pass
// fetches the logo at build time and bundles it. The logo defaults to the
// committed brand asset; the hero image is opt-in via env.
const walletImageUrl = (
  key: "PUBLIC_WALLET_LOGO_URL" | "PUBLIC_WALLET_HERO_URL",
): string | undefined => {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  return key === "PUBLIC_WALLET_LOGO_URL" ? DEFAULT_WALLET_LOGO_URL : undefined;
};

const fetchImage = async (url?: string): Promise<Buffer | null> => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};

type PassField = { key: string; label: string; value: string };

type AppleIds = { passTypeId: string; teamId: string };

const stripTrailingSlash = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === "/") end -= 1;
  return value.slice(0, end);
};

// The QR on the pass points at the public, verifiable passport view so a
// border officer or boarding facility can confirm the pass against the issuer.
const verifyUrl = (passport: PetPassportDTO): string => {
  const base = stripTrailingSlash(
    process.env.PUBLIC_PASSPORT_BASE_URL ??
      process.env.PUBLIC_CARD_BASE_URL ??
      "",
  );
  return `${base}/passport/${passport.identity.id}`;
};

const dateOnly = (iso?: string): string | undefined => iso?.slice(0, 10);

const pushField = (
  fields: PassField[],
  key: string,
  label: string,
  value?: string,
): void => {
  if (value) fields.push({ key, label, value });
};

// Shared passport-line builders, reused by both the Apple and Google passes so
// the two stay consistent and each pass builder stays small.
const isNonEmpty = (part: string | undefined): part is string => Boolean(part);

const microchipLine = (passport: PetPassportDTO): string | undefined => {
  const chip = passport.microchip;
  if (!chip?.number) return undefined;
  const implanted = dateOnly(chip.implantedAt);
  return [chip.number, chip.location, implanted && `implanted ${implanted}`]
    .filter(isNonEmpty)
    .join(" · ");
};

const rabiesLine = (passport: PetPassportDTO): string | undefined => {
  const rabies = passport.rabies;
  if (!rabies) return undefined;
  const given = dateOnly(rabies.dateAdministered);
  const validUntil = dateOnly(rabies.validUntil);
  return [
    rabies.vaccineName,
    given && `given ${given}`,
    validUntil && `valid to ${validUntil}`,
  ]
    .filter(isNonEmpty)
    .join(" · ");
};

// The soonest upcoming vaccination due date (ISO). Used to surface the pass
// near that date (Apple `relevantDate`) and show a "next due" line. Past dates
// are ignored.
const soonestNextDueIso = (passport: PetPassportDTO): string | undefined => {
  const now = Date.now();
  const upcoming = passport.vaccinations
    .map((vaccination) => vaccination.nextDueDate)
    .filter(isNonEmpty)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() >= now)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0]?.toISOString();
};

const nextDueLine = (passport: PetPassportDTO): string | undefined =>
  dateOnly(soonestNextDueIso(passport));

const issuerLine = (passport: PetPassportDTO): string | undefined => {
  const issuance = passport.issuance;
  if (!issuance) return undefined;
  return [
    issuance.issuingVetName,
    issuance.issuingPractice,
    issuance.issuingAuthority,
    issuance.issuingCountry,
    dateOnly(issuance.issueDate),
  ]
    .filter(isNonEmpty)
    .join(" · ");
};

const descriptionLine = (passport: PetPassportDTO): string => {
  const species = SPECIES_LABEL[passport.identity.species] ?? "Animal";
  return [species, passport.identity.breed, passport.identity.sex]
    .filter(isNonEmpty)
    .join(" · ");
};

const DISCLAIMER =
  "Digital record issued by the pet's veterinary practice. Not a legal substitute for an official government pet passport or health certificate for travel.";

const buildBackFields = (passport: PetPassportDTO): PassField[] => {
  const fields: PassField[] = [];
  pushField(
    fields,
    "passportNumber",
    "Passport number",
    passport.passportNumber,
  );
  pushField(fields, "microchip", "Microchip", microchipLine(passport));
  pushField(
    fields,
    "dob",
    "Date of birth",
    dateOnly(passport.identity.dateOfBirth),
  );
  pushField(fields, "colour", "Colour", passport.identity.colour);
  pushField(fields, "rabies", "Rabies vaccination", rabiesLine(passport));
  pushField(fields, "nextDue", "Next vaccination due", nextDueLine(passport));
  pushField(fields, "issuer", "Issued by", issuerLine(passport));
  fields.push({ key: "disclaimer", label: "Notice", value: DISCLAIMER });
  return fields;
};

// Pure: the Apple `pass.json` structure for a passport. Exported so the field
// mapping can be unit-tested without any signing material.
export const buildApplePassJson = (
  passport: PetPassportDTO,
  ids: AppleIds,
): Record<string, unknown> => {
  const { identity } = passport;
  const species = SPECIES_LABEL[identity.species] ?? "Animal";

  const secondaryFields: PassField[] = [];
  pushField(
    secondaryFields,
    "passportNumber",
    "Passport No.",
    passport.passportNumber,
  );
  pushField(secondaryFields, "species", "Species", species);

  const auxiliaryFields: PassField[] = [];
  pushField(auxiliaryFields, "breed", "Breed", identity.breed);
  pushField(auxiliaryFields, "sex", "Sex", identity.sex);

  return {
    formatVersion: 1,
    passTypeIdentifier: ids.passTypeId,
    teamIdentifier: ids.teamId,
    organizationName: "Yosemite Crew",
    description: "Digital Pet Passport",
    serialNumber: identity.id,
    logoText: "Pet Passport",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: WALLET_BRAND_RGB,
    labelColor: "rgb(214, 234, 255)",
    relevantDate: soonestNextDueIso(passport),
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: verifyUrl(passport),
        messageEncoding: "iso-8859-1",
      },
    ],
    generic: {
      primaryFields: [{ key: "name", label: "Name", value: identity.name }],
      secondaryFields,
      auxiliaryFields,
      backFields: buildBackFields(passport),
    },
  };
};

// --- Minimal PNG encoder (solid colour) -------------------------------------
// Apple requires an icon.png in every pass. Generating a solid-colour brand
// square here avoids shipping a binary asset; replace with the real brand icon
// by dropping icon.png / icon@2x.png into the bundle when one is available.
const crc32 = (buf: Buffer): number => {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c >>> 0) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([length, typeData, crc]);
};

const solidPng = (size: number, r: number, g: number, b: number): Buffer => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

// --- Signing ----------------------------------------------------------------
type AppleSigningConfig = AppleIds & {
  p12Base64: string;
  p12Password: string;
  wwdr?: forge.pki.Certificate;
};

const readAppleConfig = (): AppleSigningConfig => {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const p12Base64 = process.env.APPLE_PASS_P12_BASE64;
  if (!passTypeId || !teamId || !p12Base64) {
    throw new WalletNotConfiguredError();
  }
  const wwdrBase64 = process.env.APPLE_WWDR_BASE64;
  const wwdr = wwdrBase64
    ? forge.pki.certificateFromAsn1(
        forge.asn1.fromDer(forge.util.decode64(wwdrBase64)),
      )
    : undefined;
  return {
    passTypeId,
    teamId,
    p12Base64,
    p12Password: process.env.APPLE_PASS_P12_PASSWORD ?? "",
    wwdr,
  };
};

const extractCertAndKey = (
  p12Base64: string,
  password: string,
): { cert: forge.pki.Certificate; key: forge.pki.PrivateKey } => {
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;

  const shrouded = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[
    forge.pki.oids.keyBag
  ]?.[0]?.key;
  const key = shrouded ?? plain;

  if (!cert || !key) {
    throw new WalletNotConfiguredError(
      "Apple Wallet certificate is invalid or missing its private key.",
      500,
    );
  }
  return { cert, key };
};

// Apple's PassKit manifest format mandates SHA-1 file digests. This is a
// non-sensitive integrity manifest (not password/credential hashing), and the
// pass will not validate on-device with any other algorithm.
const sha1Hex = (buf: Buffer): string =>
  createHash("sha1").update(buf).digest("hex"); // NOSONAR: PassKit requires SHA-1

const buildManifest = (files: Record<string, Buffer>): Buffer => {
  const manifest: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files))
    manifest[name] = sha1Hex(buf);
  return Buffer.from(JSON.stringify(manifest));
};

const signManifest = (manifest: Buffer, config: AppleSigningConfig): Buffer => {
  const { cert, key } = extractCertAndKey(config.p12Base64, config.p12Password);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(cert);
  if (config.wwdr) p7.addCertificate(config.wwdr);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toString() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, "binary");
};

const packageApplePass = async (passport: PetPassportDTO): Promise<Buffer> => {
  const config = readAppleConfig();
  const logo = await fetchImage(walletImageUrl("PUBLIC_WALLET_LOGO_URL"));
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(
      JSON.stringify(buildApplePassJson(passport, config)),
    ),
    "icon.png": logo ?? solidPng(29, BRAND_R, BRAND_G, BRAND_B),
    "icon@2x.png": logo ?? solidPng(58, BRAND_R, BRAND_G, BRAND_B),
  };
  if (logo) {
    files["logo.png"] = logo;
    files["logo@2x.png"] = logo;
  }
  const manifest = buildManifest(files);
  const signature = signManifest(manifest, config);

  const zip = new AdmZip();
  for (const [name, buf] of Object.entries(files)) zip.addFile(name, buf);
  zip.addFile("manifest.json", manifest);
  zip.addFile("signature", signature);
  return zip.toBuffer();
};

// --- Google Wallet ----------------------------------------------------------
// Google object/class ids must be `<issuerId>.<suffix>` where the suffix is
// limited to alphanumerics, '.', '_' and '-'.
const sanitizeId = (value: string): string =>
  value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");

type GoogleTextModule = { id: string; header: string; body: string };

const buildGoogleTextModules = (
  passport: PetPassportDTO,
): GoogleTextModule[] => {
  const modules: GoogleTextModule[] = [];
  const add = (id: string, header: string, body?: string): void => {
    if (body) modules.push({ id, header, body });
  };
  add("passportNumber", "Passport No.", passport.passportNumber);
  add("microchip", "Microchip", microchipLine(passport));
  add("dob", "Date of birth", dateOnly(passport.identity.dateOfBirth));
  add("colour", "Colour", passport.identity.colour);
  add("rabies", "Rabies vaccination", rabiesLine(passport));
  add("nextDue", "Next vaccination due", nextDueLine(passport));
  add("issuer", "Issued by", issuerLine(passport));
  return modules;
};

// Pure: the genericClasses/genericObjects payload embedded in the save JWT.
// Exported for unit testing without any signing material.
export const buildGooglePayload = (
  passport: PetPassportDTO,
  issuerId: string,
): Record<string, unknown> => {
  const classId = `${issuerId}.petpassport`;
  const objectId = `${issuerId}.${sanitizeId(passport.identity.id)}`;
  const logoUri = walletImageUrl("PUBLIC_WALLET_LOGO_URL");
  const heroUri = walletImageUrl("PUBLIC_WALLET_HERO_URL");
  const localized = (value: string) => ({
    defaultValue: { language: "en", value },
  });

  const genericObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    cardTitle: localized("Digital Pet Passport"),
    header: localized(passport.identity.name),
    subheader: localized(descriptionLine(passport)),
    hexBackgroundColor: WALLET_BRAND_HEX,
    textModulesData: buildGoogleTextModules(passport),
    barcode: {
      type: "QR_CODE",
      value: verifyUrl(passport),
      alternateText: passport.passportNumber ?? "Verify",
    },
  };
  if (logoUri) {
    genericObject.logo = {
      sourceUri: { uri: logoUri },
      contentDescription: localized("Yosemite Crew"),
    };
  }
  if (heroUri) genericObject.heroImage = { sourceUri: { uri: heroUri } };

  return { genericClasses: [{ id: classId }], genericObjects: [genericObject] };
};

type GoogleConfig = { issuerId: string; saEmail: string; privateKey: string };

const readGoogleConfig = (): GoogleConfig => {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  // Private keys stored in env keep literal "\n"; restore real newlines.
  const privateKey = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY?.replaceAll(
    String.raw`\n`,
    "\n",
  );
  if (!issuerId || !saEmail || !privateKey) {
    throw new WalletNotConfiguredError("Google Wallet is not configured.");
  }
  return { issuerId, saEmail, privateKey };
};

export const WalletPassService = {
  // Produces a signed .pkpass for the passport. Rejects with
  // WalletNotConfiguredError (501) when no Pass Type ID certificate is
  // provisioned.
  buildApplePass(passport: PetPassportDTO): Promise<Buffer> {
    return packageApplePass(passport);
  },

  // Returns an "Add to Google Wallet" save URL: a JWT (RS256, signed with the
  // service-account key) carrying the pass payload. Throws
  // WalletNotConfiguredError (501) when the issuer/service account is unset.
  buildGoogleSaveUrl(passport: PetPassportDTO): string {
    const { issuerId, saEmail, privateKey } = readGoogleConfig();
    const claims = {
      iss: saEmail,
      aud: "google",
      typ: "savetowallet",
      origins: [] as string[],
      payload: buildGooglePayload(passport, issuerId),
    };
    const token = jwt.sign(claims, privateKey, { algorithm: "RS256" });
    return `https://pay.google.com/gp/v/save/${token}`;
  },
};
