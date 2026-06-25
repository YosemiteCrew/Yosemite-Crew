import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import AdmZip from "adm-zip";
import forge from "node-forge";
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

type PassField = { key: string; label: string; value: string };

type AppleIds = { passTypeId: string; teamId: string };

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

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

const buildBackFields = (passport: PetPassportDTO): PassField[] => {
  const fields: PassField[] = [];
  pushField(
    fields,
    "dob",
    "Date of birth",
    dateOnly(passport.identity.dateOfBirth),
  );
  pushField(fields, "colour", "Colour", passport.identity.colour);
  pushField(fields, "microchip", "Microchip", passport.microchip?.number);
  pushField(
    fields,
    "passportNumber",
    "Passport number",
    passport.passportNumber,
  );
  if (passport.rabies) {
    const validUntil = dateOnly(passport.rabies.validUntil);
    const suffix = validUntil ? ` (valid to ${validUntil})` : "";
    pushField(
      fields,
      "rabies",
      "Rabies vaccination",
      `${passport.rabies.vaccineName}${suffix}`,
    );
  }
  pushField(fields, "issuer", "Issued by", passport.issuance?.issuingVetName);
  fields.push({
    key: "disclaimer",
    label: "Notice",
    value:
      "Digital record issued by the pet's veterinary practice. Not a legal substitute for an official government pet passport or health certificate for travel.",
  });
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
  pushField(secondaryFields, "species", "Species", species);
  pushField(secondaryFields, "breed", "Breed", identity.breed);

  const auxiliaryFields: PassField[] = [];
  pushField(auxiliaryFields, "sex", "Sex", identity.sex);
  pushField(auxiliaryFields, "dob", "Born", dateOnly(identity.dateOfBirth));

  return {
    formatVersion: 1,
    passTypeIdentifier: ids.passTypeId,
    teamIdentifier: ids.teamId,
    organizationName: "Yosemite Crew",
    description: "Digital Pet Passport",
    serialNumber: identity.id,
    logoText: "Pet Passport",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(34, 47, 91)",
    labelColor: "rgb(176, 190, 230)",
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

const sha1Hex = (buf: Buffer): string =>
  createHash("sha1").update(buf).digest("hex");

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

const packageApplePass = (passport: PetPassportDTO): Buffer => {
  const config = readAppleConfig();
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(
      JSON.stringify(buildApplePassJson(passport, config)),
    ),
    "icon.png": solidPng(29, 34, 47, 91),
    "icon@2x.png": solidPng(58, 34, 47, 91),
  };
  const manifest = buildManifest(files);
  const signature = signManifest(manifest, config);

  const zip = new AdmZip();
  for (const [name, buf] of Object.entries(files)) zip.addFile(name, buf);
  zip.addFile("manifest.json", manifest);
  zip.addFile("signature", signature);
  return zip.toBuffer();
};

export const WalletPassService = {
  // Produces a signed .pkpass for the passport. Rejects with
  // WalletNotConfiguredError (501) when no Pass Type ID certificate is
  // provisioned. Signing is CPU-bound and synchronous, so it is wrapped in a
  // promise to keep an async-friendly contract for callers.
  buildApplePass(passport: PetPassportDTO): Promise<Buffer> {
    return new Promise<Buffer>((resolve) =>
      resolve(packageApplePass(passport)),
    );
  },
};
