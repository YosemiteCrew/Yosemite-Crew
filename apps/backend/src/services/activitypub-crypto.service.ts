import crypto from "node:crypto";

function masterSecret(): string {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw)
    throw new Error("ENCRYPTION_KEY env var is required for AP key storage");
  return raw;
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.scryptSync(masterSecret(), salt, 32);
}

export function generateRsaKeyPair(): {
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

export function encryptPrivateKey(pem: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptPrivateKey(stored: string): string {
  const [saltHex, ivHex, authTagHex, dataHex] = stored.split(":");
  if (!saltHex || !ivHex || !authTagHex || !dataHex)
    throw new Error("Invalid encrypted private key format");
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
