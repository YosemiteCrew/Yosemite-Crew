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

type Result = { label: string; ok: boolean; detail: string };

const results: Result[] = [];
const pass = (label: string, detail = "") =>
  results.push({ label, ok: true, detail });
const fail = (label: string, detail: string) =>
  results.push({ label, ok: false, detail });

const env = (key: string): string => process.env[key]?.trim() ?? "";

/** Never echo the value: only ever its shape. */
const describeMissing = (key: string): string => `${key} is not set`;

const checkApple = (): void => {
  const passTypeId = env("APPLE_PASS_TYPE_ID");
  const teamId = env("APPLE_TEAM_ID");
  const p12Base64 = env("APPLE_PASS_P12_BASE64");
  const p12Password = env("APPLE_PASS_P12_PASSWORD");
  const wwdrBase64 = env("APPLE_WWDR_BASE64");

  for (const [key, value] of [
    ["APPLE_PASS_TYPE_ID", passTypeId],
    ["APPLE_TEAM_ID", teamId],
    ["APPLE_PASS_P12_BASE64", p12Base64],
    ["APPLE_WWDR_BASE64", wwdrBase64],
  ] as const) {
    if (!value) fail(key, describeMissing(key));
  }
  if (!passTypeId || !teamId || !p12Base64 || !wwdrBase64) return;

  pass("APPLE_PASS_TYPE_ID", passTypeId);
  pass("APPLE_TEAM_ID", teamId);

  let p12Der: string;
  try {
    p12Der = Buffer.from(p12Base64, "base64").toString("binary");
    if (p12Der.length === 0) throw new Error("empty");
  } catch {
    fail("APPLE_PASS_P12_BASE64", "not valid base64");
    return;
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(p12Der),
      false,
      p12Password,
    );
    pass("APPLE_PASS_P12_BASE64", "decodes as PKCS#12");
  } catch {
    // forge throws the same way for a corrupt archive and a wrong password, so
    // report both rather than guessing which one it is.
    fail(
      "APPLE_PASS_P12_BASE64",
      "could not be opened - either the base64 is not a .p12 or APPLE_PASS_P12_PASSWORD is wrong",
    );
    return;
  }
  pass("APPLE_PASS_P12_PASSWORD", "opens the archive");

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  const cert = certBags?.[0]?.cert;
  if (!cert) {
    fail("APPLE_PASS_P12_BASE64", "archive contains no certificate");
    return;
  }

  const now = new Date();
  if (cert.validity.notAfter < now) {
    fail(
      "Pass certificate validity",
      `expired on ${cert.validity.notAfter.toISOString().slice(0, 10)}`,
    );
  } else if (cert.validity.notBefore > now) {
    fail(
      "Pass certificate validity",
      `not valid until ${cert.validity.notBefore.toISOString().slice(0, 10)}`,
    );
  } else {
    const days = Math.floor(
      (cert.validity.notAfter.getTime() - now.getTime()) / 86_400_000,
    );
    const detail = `valid, expires ${cert.validity.notAfter.toISOString().slice(0, 10)} (${days} days)`;
    if (days <= 30) fail("Pass certificate validity", `${detail} - renew soon`);
    else pass("Pass certificate validity", detail);
  }

  // Apple encodes the pass type in UID and the team in OU. A mismatch here is
  // the classic cause of a pass that builds but will not open on a device.
  // node-forge does not map UID to a short name, so getField("UID") silently
  // returns null and the comparison below would never run. Look it up by OID.
  const UID_OID = "0.9.2342.19200300.100.1.1";
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

  try {
    const wwdr = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(Buffer.from(wwdrBase64, "base64").toString("binary")),
    );
    pass("APPLE_WWDR_BASE64", "decodes as an X.509 certificate");
    // The WWDR intermediate must be the issuer of the pass certificate, or the
    // chain is incomplete and devices reject the pass.
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
  for (const { label, ok, detail } of results) {
    const mark = ok ? "PASS" : "FAIL";
    console.log(`${mark}  ${label.padEnd(width)}  ${detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length === 0) {
    console.log(
      "Wallet configuration looks complete. Both signers should load.",
    );
    return;
  }
  console.log(
    `${failed.length} check(s) failed. Wallet endpoints will return 501 until these are fixed.`,
  );
  process.exitCode = 1;
};

main();
