import crypto from "crypto";

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw)
    throw new Error("ENCRYPTION_KEY env var is required for AP key storage");
  return crypto.createHash("sha256").update(raw).digest();
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
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(pem, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPrivateKey(stored: string): string {
  const [ivHex, dataHex] = stored.split(":");
  if (!ivHex || !dataHex)
    throw new Error("Invalid encrypted private key format");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey(), iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
