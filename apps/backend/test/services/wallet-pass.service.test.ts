import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import forge from "node-forge";
import jwt from "jsonwebtoken";
import type { PetPassportDTO } from "@yosemite-crew/types";
import {
  buildApplePassJson,
  buildGooglePayload,
  WalletPassService,
  WalletNotConfiguredError,
} from "../../src/services/wallet-pass.service";

const PASSPORT: PetPassportDTO = {
  identity: {
    id: "p1",
    name: "Doggy",
    species: "dog",
    breed: "Rottweiler",
    sex: "male",
    dateOfBirth: "2024-01-10T00:00:00.000Z",
    colour: "black",
    photoUrl: "x",
  },
  microchip: {
    number: "985141000123456",
    implantedAt: "2024-02-01T00:00:00.000Z",
    location: "left neck",
  },
  passportNumber: "GB-YC-1",
  rabies: {
    id: "v1",
    patientId: "p1",
    vaccineType: "RABIES",
    vaccineName: "Nobivac Rabies",
    dateAdministered: "2024-04-01T00:00:00.000Z",
    validUntil: "2027-03-14T00:00:00.000Z",
    createdAt: "2024-04-02T00:00:00.000Z",
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
  issuance: {
    passportNumber: "GB-YC-1",
    issuingVetName: "Dr A",
    issueDate: "2024-06-24T00:00:00.000Z",
  },
};

const MINIMAL: PetPassportDTO = {
  identity: {
    id: "p2",
    name: "Solo",
    species: "ferret" as never,
    breed: "Standard",
    sex: "female",
  },
  vaccinations: [],
  parasiteTreatments: [],
  rabiesTitrations: [],
};

const IDS = {
  passTypeId: "pass.com.yosemitecrew.petpassport",
  teamId: "9TZWPYQ45S",
};

// A throwaway self-signed identity so the full sign/package path can run with
// no real Apple certificate present.
let p12Base64 = "";
let certDerBase64 = "";
let certObj: forge.pki.Certificate;
let saPrivateKeyPem = "";

beforeAll(() => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  certObj = cert;
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(2020, 0, 1);
  cert.validity.notAfter = new Date(2040, 0, 1);
  const attrs = [{ name: "commonName", value: "Pass Type ID: pass.test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "secret", {
    algorithm: "3des",
  });
  p12Base64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
  certDerBase64 = forge.util.encode64(
    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
  );
  saPrivateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
}, 30000);

const ENV_KEYS = [
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_P12_BASE64",
  "APPLE_PASS_P12_PASSWORD",
  "APPLE_WWDR_BASE64",
  "PUBLIC_PASSPORT_BASE_URL",
  "PUBLIC_CARD_BASE_URL",
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SA_EMAIL",
  "GOOGLE_WALLET_SA_PRIVATE_KEY",
] as const;

const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const configure = (extra: Record<string, string> = {}): void => {
  process.env.APPLE_PASS_TYPE_ID = IDS.passTypeId;
  process.env.APPLE_TEAM_ID = IDS.teamId;
  process.env.APPLE_PASS_P12_BASE64 = p12Base64;
  process.env.APPLE_PASS_P12_PASSWORD = "secret";
  Object.assign(process.env, extra);
};

describe("buildApplePassJson", () => {
  it("maps identity, ids, barcode and back fields", () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.example.com/";
    const pass = buildApplePassJson(PASSPORT, IDS) as Record<string, unknown>;

    expect(pass.formatVersion).toBe(1);
    expect(pass.passTypeIdentifier).toBe(IDS.passTypeId);
    expect(pass.teamIdentifier).toBe(IDS.teamId);
    expect(pass.serialNumber).toBe("p1");

    const generic = pass.generic as Record<
      string,
      Array<{ key: string; value: string }>
    >;
    expect(generic.primaryFields[0]).toMatchObject({
      key: "name",
      value: "Doggy",
    });
    expect(generic.secondaryFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "species", value: "Dog" }),
        expect.objectContaining({ key: "breed", value: "Rottweiler" }),
      ]),
    );

    const back = generic.backFields;
    expect(back).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "microchip", value: "985141000123456" }),
        expect.objectContaining({ key: "passportNumber", value: "GB-YC-1" }),
        expect.objectContaining({
          key: "rabies",
          value: "Nobivac Rabies (valid to 2027-03-14)",
        }),
        expect.objectContaining({ key: "issuer", value: "Dr A" }),
        expect.objectContaining({ key: "disclaimer" }),
      ]),
    );

    const barcode = (pass.barcodes as Array<{ message: string }>)[0];
    expect(barcode.message).toBe("https://app.example.com/passport/p1");
  });

  it("falls back to Animal species, omits absent fields, keeps the disclaimer", () => {
    const pass = buildApplePassJson(MINIMAL, IDS) as Record<string, unknown>;
    const generic = pass.generic as Record<string, Array<{ key: string }>>;
    expect(generic.secondaryFields).toEqual([
      expect.objectContaining({ key: "species", value: "Animal" }),
      expect.objectContaining({ key: "breed" }),
    ]);
    const keys = generic.backFields.map((f) => f.key);
    expect(keys).not.toContain("microchip");
    expect(keys).not.toContain("rabies");
    expect(keys).toContain("disclaimer");
  });

  it("uses the card base url as a fallback for the verify link", () => {
    process.env.PUBLIC_CARD_BASE_URL = "https://card.example.com";
    const pass = buildApplePassJson(PASSPORT, IDS) as Record<string, unknown>;
    const barcode = (pass.barcodes as Array<{ message: string }>)[0];
    expect(barcode.message).toBe("https://card.example.com/passport/p1");
  });
});

describe("WalletPassService.buildApplePass", () => {
  it("throws WalletNotConfiguredError (501) when no certificate is set", async () => {
    await expect(
      WalletPassService.buildApplePass(PASSPORT),
    ).rejects.toMatchObject({
      name: "WalletNotConfiguredError",
      statusCode: 501,
    });
    await expect(
      WalletPassService.buildApplePass(PASSPORT),
    ).rejects.toBeInstanceOf(WalletNotConfiguredError);
  });

  it("produces a signed .pkpass bundle with a matching manifest", async () => {
    configure();
    const buffer = await WalletPassService.buildApplePass(PASSPORT);

    const zip = new AdmZip(buffer);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toEqual(
      expect.arrayContaining([
        "pass.json",
        "manifest.json",
        "signature",
        "icon.png",
        "icon@2x.png",
      ]),
    );

    const passJson = zip.getEntry("pass.json")!.getData();
    expect(JSON.parse(passJson.toString()).serialNumber).toBe("p1");

    const manifest = JSON.parse(
      zip.getEntry("manifest.json")!.getData().toString(),
    );
    const expectedHash = createHash("sha1").update(passJson).digest("hex");
    expect(manifest["pass.json"]).toBe(expectedHash);

    expect(zip.getEntry("signature")!.getData().length).toBeGreaterThan(0);
    // icon.png is a valid PNG (magic header)
    expect(zip.getEntry("icon.png")!.getData().subarray(0, 4)).toEqual(
      Buffer.from([137, 80, 78, 71]),
    );
  });

  it("embeds the WWDR intermediate certificate when provided", async () => {
    configure({ APPLE_WWDR_BASE64: certDerBase64 });
    const buffer = await WalletPassService.buildApplePass(PASSPORT);
    expect(
      new AdmZip(buffer).getEntry("signature")!.getData().length,
    ).toBeGreaterThan(0);
  });

  it("rejects a certificate bundle that carries no private key", async () => {
    const certOnly = forge.pkcs12.toPkcs12Asn1(
      null as never,
      [certObj],
      "secret",
    );
    configure({
      APPLE_PASS_P12_BASE64: forge.util.encode64(
        forge.asn1.toDer(certOnly).getBytes(),
      ),
    });
    await expect(
      WalletPassService.buildApplePass(PASSPORT),
    ).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

const ISSUER = "3388000000023162791";
const SA_EMAIL = "sa@project.iam.gserviceaccount.com";

type GooglePayloadShape = {
  genericClasses: Array<{ id: string }>;
  genericObjects: Array<{
    id: string;
    classId: string;
    header: { defaultValue: { value: string } };
    barcode: { type: string; value: string };
    textModulesData: Array<{ id: string }>;
  }>;
};

describe("buildGooglePayload", () => {
  it("maps the pass into a generic class/object with a QR to the verify url", () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.example.com";
    const payload = buildGooglePayload(
      PASSPORT,
      ISSUER,
    ) as unknown as GooglePayloadShape;

    expect(payload.genericClasses[0].id).toBe(`${ISSUER}.petpassport`);
    const obj = payload.genericObjects[0];
    expect(obj.id).toBe(`${ISSUER}.p1`);
    expect(obj.classId).toBe(`${ISSUER}.petpassport`);
    expect(obj.header.defaultValue.value).toBe("Doggy");
    expect(obj.barcode).toEqual({
      type: "QR_CODE",
      value: "https://app.example.com/passport/p1",
    });
    const moduleIds = obj.textModulesData.map((m) => m.id);
    expect(moduleIds).toEqual(
      expect.arrayContaining(["microchip", "passport", "rabies", "issuer"]),
    );
  });

  it("sanitises a non-conforming companion id into the object id", () => {
    const payload = buildGooglePayload(
      { ...MINIMAL, identity: { ...MINIMAL.identity, id: "abc/12 3" } },
      ISSUER,
    ) as unknown as GooglePayloadShape;
    expect(payload.genericObjects[0].id).toBe(`${ISSUER}.abc-12-3`);
  });
});

describe("WalletPassService.buildGoogleSaveUrl", () => {
  const SAVE_PREFIX = "https://pay.google.com/gp/v/save/";
  const configureGoogle = (): void => {
    process.env.GOOGLE_WALLET_ISSUER_ID = ISSUER;
    process.env.GOOGLE_WALLET_SA_EMAIL = SA_EMAIL;
    // stored the way a JSON key lands in env: real newlines escaped to "\n"
    process.env.GOOGLE_WALLET_SA_PRIVATE_KEY = saPrivateKeyPem.replaceAll(
      "\n",
      "\\n",
    );
  };

  it("throws WalletNotConfiguredError (501) when unset", () => {
    expect(() => WalletPassService.buildGoogleSaveUrl(PASSPORT)).toThrow(
      WalletNotConfiguredError,
    );
  });

  it("signs a save JWT verifiable against the service-account key", () => {
    configureGoogle();
    const url = WalletPassService.buildGoogleSaveUrl(PASSPORT);
    expect(url.startsWith(SAVE_PREFIX)).toBe(true);

    const token = url.slice(SAVE_PREFIX.length);
    const decoded = jwt.decode(token) as unknown as {
      iss: string;
      aud: string;
      typ: string;
      payload: { genericObjects: Array<{ id: string }> };
    };
    expect(decoded.iss).toBe(SA_EMAIL);
    expect(decoded.aud).toBe("google");
    expect(decoded.typ).toBe("savetowallet");
    expect(decoded.payload.genericObjects[0].id).toBe(`${ISSUER}.p1`);

    const publicKeyPem = forge.pki.publicKeyToPem(
      certObj.publicKey as forge.pki.rsa.PublicKey,
    );
    expect(() =>
      jwt.verify(token, publicKeyPem, { algorithms: ["RS256"] }),
    ).not.toThrow();
  });
});
