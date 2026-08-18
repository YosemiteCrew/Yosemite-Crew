/**
 * Preflight for the Digital Pet Passport wallet credentials.
 *
 * Both signers fail closed with a 501 when their configuration is missing or
 * malformed, and the runtime error says only "not configured" - it cannot tell
 * you that the .p12 password is wrong, the certificate expired, or the Team ID
 * on the certificate disagrees with APPLE_TEAM_ID. Each of those costs a
 * deploy-and-debug cycle to discover.
 *
 * This validates the values the same way `wallet-pass.service.ts` consumes
 * them, so a pass here means the signers will load. Run it wherever the values
 * live, before deploying them:
 *
 *   pnpm --filter backend run check:wallet
 *
 * It prints PASS/FAIL per check and never prints a secret. Exit code is 1 when
 * any required check fails, so CI or a deploy step can gate on it.
 */
import forge from "node-forge";
import jwt from "jsonwebtoken";

type Level = "PASS" | "WARN" | "FAIL";
type Result = { label: string; level: Level; detail: string };

const results: Result[] = [];
const pass = (label: string, detail = "") =>
  results.push({ label, level: "PASS", detail });
/** Surfaces something worth acting on that does not block: exit stays 0. */
const warn = (label: string, detail: string) =>
  results.push({ label, level: "WARN", detail });
const fail = (label: string, detail: string) =>
  results.push({ label, level: "FAIL", detail });

const env = (key: string): string => process.env[key]?.trim() ?? "";

/** Never echo the value: only ever its shape. */
const describeMissing = (key: string): string => `${key} is not set`;

const UID_OID = "0.9.2342.19200300.100.1.1";

type AppleEnv = {
  passTypeId: string;
  teamId: string;
  p12Base64: string;
  p12Password: string;
  wwdrBase64: string;
};

/** Returns the Apple settings, or null once it has reported what is missing. */
const readAppleEnv = (): AppleEnv | null => {
  const env_ = {
    passTypeId: env("APPLE_PASS_TYPE_ID"),
    teamId: env("APPLE_TEAM_ID"),
    p12Base64: env("APPLE_PASS_P12_BASE64"),
    p12Password: env("APPLE_PASS_P12_PASSWORD"),
    wwdrBase64: env("APPLE_WWDR_BASE64"),
  };
  const required: [string, string][] = [
    ["APPLE_PASS_TYPE_ID", env_.passTypeId],
    ["APPLE_TEAM_ID", env_.teamId],
    ["APPLE_PASS_P12_BASE64", env_.p12Base64],
    ["APPLE_WWDR_BASE64", env_.wwdrBase64],
  ];
  let complete = true;
  for (const [key, value] of required) {
    if (!value) {
      fail(key, describeMissing(key));
      complete = false;
    }
  }
  if (!complete) return null;
  pass("APPLE_PASS_TYPE_ID", env_.passTypeId);
  pass("APPLE_TEAM_ID", env_.teamId);
  return env_;
};

/** Opens the archive, or reports why it could not be opened. */
const openPassCertificate = (
  p12Base64: string,
  p12Password: string,
): forge.pki.Certificate | null => {
  let der: string;
  try {
    der = Buffer.from(p12Base64, "base64").toString("binary");
    if (der.length === 0) throw new Error("empty");
  } catch {
    fail("APPLE_PASS_P12_BASE64", "not valid base64");
    return null;
  }
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(der),
      false,
      p12Password,
    );
    pass("APPLE_PASS_P12_BASE64", "decodes as PKCS#12");
  } catch {
    // forge fails identically for a corrupt archive and a wrong password, so
    // name both rather than guessing which one it is.
    fail(
      "APPLE_PASS_P12_BASE64",
      "could not be opened - either the base64 is not a .p12 or APPLE_PASS_P12_PASSWORD is wrong",
    );
    return null;
  }
  pass("APPLE_PASS_P12_PASSWORD", "opens the archive");

  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  const cert = bags?.[0]?.cert;
  if (!cert) {
    fail("APPLE_PASS_P12_BASE64", "archive contains no certificate");
    return null;
  }
  return cert;
};

const checkCertificateValidity = (cert: forge.pki.Certificate): void => {
  const now = new Date();
  const day = (d: Date) => d.toISOString().slice(0, 10);
  if (cert.validity.notAfter < now) {
    fail(
      "Pass certificate validity",
      `expired on ${day(cert.validity.notAfter)}`,
    );
    return;
  }
  if (cert.validity.notBefore > now) {
    fail(
      "Pass certificate validity",
      `not valid until ${day(cert.validity.notBefore)}`,
    );
    return;
  }
  const days = Math.floor(
    (cert.validity.notAfter.getTime() - now.getTime()) / 86_400_000,
  );
  const detail = `valid, expires ${day(cert.validity.notAfter)} (${days} days)`;
  // Still valid, so this must not fail the run - it only needs to be seen.
  if (days <= 30) warn("Pass certificate validity", `${detail} - renew soon`);
  else pass("Pass certificate validity", detail);
};

/**
 * Apple encodes the pass type in UID and the team in OU. A mismatch is the
 * classic cause of a pass that builds but will not open on a device.
 *
 * node-forge does not map UID to a short name, so it must be read by OID -
 * `getField("UID")` returns null and the comparison would silently never run.
 */
const checkCertificateIdentity = (
  cert: forge.pki.Certificate,
  passTypeId: string,
  teamId: string,
): void => {
  const uid = cert.subject.getField({ type: UID_OID })?.value;
  const ou = cert.subject.getField("OU")?.value;
  if (uid && uid !== passTypeId) {
    fail(
      "Pass type ID match",
      `certificate is for "${uid}" but APPLE_PASS_TYPE_ID is "${passTypeId}"`,
    );
  } else if (uid) {
    pass("Pass type ID match", "certificate UID matches APPLE_PASS_TYPE_ID");
  }
  if (ou && ou !== teamId) {
    fail(
      "Team ID match",
      `certificate OU is "${ou}" but APPLE_TEAM_ID is "${teamId}"`,
    );
  } else if (ou) {
    pass("Team ID match", "certificate OU matches APPLE_TEAM_ID");
  }
};

const checkSigningChain = (
  cert: forge.pki.Certificate,
  wwdrBase64: string,
): void => {
  try {
    const wwdr = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(Buffer.from(wwdrBase64, "base64").toString("binary")),
    );
    pass("APPLE_WWDR_BASE64", "decodes as an X.509 certificate");
    // The WWDR intermediate must have issued the pass certificate, or the chain
    // is incomplete and devices reject the pass.
    if (wwdr.subject.hash === cert.issuer.hash) {
      pass("Signing chain", "WWDR certificate issued the pass certificate");
    } else {
      fail(
        "Signing chain",
        "the WWDR certificate did not issue this pass certificate - likely the wrong WWDR generation (G4 is current)",
      );
    }
  } catch {
    fail("APPLE_WWDR_BASE64", "not a valid base64-encoded X.509 certificate");
  }
};

const checkApple = (): void => {
  const settings = readAppleEnv();
  if (!settings) return;
  const cert = openPassCertificate(settings.p12Base64, settings.p12Password);
  if (!cert) return;
  checkCertificateValidity(cert);
  checkCertificateIdentity(cert, settings.passTypeId, settings.teamId);
  checkSigningChain(cert, settings.wwdrBase64);
};

const checkGoogle = (): void => {
  const issuerId = env("GOOGLE_WALLET_ISSUER_ID");
  const saEmail = env("GOOGLE_WALLET_SA_EMAIL");
  const privateKey = env("GOOGLE_WALLET_SA_PRIVATE_KEY").replaceAll(
    String.raw`\n`,
    "\n",
  );

  if (!issuerId)
    fail("GOOGLE_WALLET_ISSUER_ID", describeMissing("GOOGLE_WALLET_ISSUER_ID"));
  else if (!/^\d+$/.test(issuerId))
    fail("GOOGLE_WALLET_ISSUER_ID", "should be all digits");
  else pass("GOOGLE_WALLET_ISSUER_ID", issuerId);

  if (!saEmail)
    fail("GOOGLE_WALLET_SA_EMAIL", describeMissing("GOOGLE_WALLET_SA_EMAIL"));
  else if (
    !saEmail.includes("@") ||
    !saEmail.endsWith(".iam.gserviceaccount.com")
  )
    fail(
      "GOOGLE_WALLET_SA_EMAIL",
      "does not look like a service account (expected ...iam.gserviceaccount.com)",
    );
  else pass("GOOGLE_WALLET_SA_EMAIL", saEmail);

  if (!privateKey) {
    fail(
      "GOOGLE_WALLET_SA_PRIVATE_KEY",
      describeMissing("GOOGLE_WALLET_SA_PRIVATE_KEY"),
    );
    return;
  }
  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    fail(
      "GOOGLE_WALLET_SA_PRIVATE_KEY",
      "is not a PEM private key - copy the private_key field from the service-account JSON",
    );
    return;
  }
  // Signing a throwaway token is the only way to know the key actually works;
  // a PEM can be well-formed and still be the wrong type for RS256.
  try {
    jwt.sign({ preflight: true }, privateKey, {
      algorithm: "RS256",
      expiresIn: 60,
    });
    pass("GOOGLE_WALLET_SA_PRIVATE_KEY", "signs an RS256 token");
  } catch {
    fail(
      "GOOGLE_WALLET_SA_PRIVATE_KEY",
      "could not sign with RS256 - the key is malformed or not an RSA key",
    );
  }
};

const main = (): void => {
  checkApple();
  checkGoogle();

  const width = Math.max(...results.map((r) => r.label.length));
  for (const { label, level, detail } of results) {
    console.log(`${level}  ${label.padEnd(width)}  ${detail}`);
  }

  const failed = results.filter((r) => r.level === "FAIL");
  const warned = results.filter((r) => r.level === "WARN");
  console.log("");
  if (failed.length === 0) {
    console.log(
      "Wallet configuration looks complete. Both signers should load.",
    );
    if (warned.length > 0) {
      console.log(
        `${warned.length} warning(s) above do not block, but need attention.`,
      );
    }
    return;
  }
  console.log(
    `${failed.length} check(s) failed. Wallet endpoints will return 501 until these are fixed.`,
  );
  process.exitCode = 1;
};

main();
