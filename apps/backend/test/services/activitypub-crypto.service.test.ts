import {
  encryptPrivateKey,
  decryptPrivateKey,
  generateRsaKeyPair,
} from "src/services/activitypub-crypto.service";

describe("activitypub-crypto.service (AES-256-GCM + scrypt)", () => {
  const OLD_ENV = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "test-master-secret-please-change";
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = OLD_ENV;
  });

  it("round-trips a value", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----";
    const stored = encryptPrivateKey(pem);
    expect(decryptPrivateKey(stored)).toBe(pem);
  });

  it("stores salt:iv:authTag:ciphertext (four parts) with a random per-record salt", () => {
    const a = encryptPrivateKey("secret");
    const b = encryptPrivateKey("secret");
    expect(a.split(":")).toHaveLength(4);
    expect(b.split(":")).toHaveLength(4);
    // Different salt/iv every time → different ciphertext.
    expect(a).not.toBe(b);
    expect(a.split(":")[0]).not.toBe(b.split(":")[0]);
  });

  it("rejects a tampered auth tag", () => {
    const stored = encryptPrivateKey("secret");
    const parts = stored.split(":");
    const tag = Buffer.from(parts[2], "hex");
    tag[0] ^= 0xff;
    parts[2] = tag.toString("hex");
    expect(() => decryptPrivateKey(parts.join(":"))).toThrow();
  });

  it("rejects malformed stored format", () => {
    expect(() => decryptPrivateKey("only:three:parts")).toThrow(
      /Invalid encrypted private key format/,
    );
  });

  it("generates an RSA key pair and round-trips its private key through encryption", () => {
    const { publicKeyPem, privateKeyPem } = generateRsaKeyPair();
    expect(publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(publicKeyPem).toMatch(/-----END PUBLIC KEY-----/);
    expect(privateKeyPem).toMatch(/-----BEGIN PRIVATE KEY-----/);
    expect(privateKeyPem).toMatch(/-----END PRIVATE KEY-----/);
    // A fresh generation yields a distinct key.
    const other = generateRsaKeyPair();
    expect(other.privateKeyPem).not.toBe(privateKeyPem);
    // The generated private key survives encrypt/decrypt intact.
    expect(decryptPrivateKey(encryptPrivateKey(privateKeyPem))).toBe(
      privateKeyPem,
    );
  });

  it("throws when ENCRYPTION_KEY is not set", () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encryptPrivateKey("secret")).toThrow(
        /ENCRYPTION_KEY env var is required/,
      );
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});
