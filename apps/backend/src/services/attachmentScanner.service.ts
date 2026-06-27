// src/services/attachmentScanner.service.ts
import crypto from "node:crypto";
import logger from "src/utils/logger";

/**
 * Content-based malware check for chat attachments. Complements the upload-type
 * policy (stream-upload-policy.ts): the type policy blocks executable/script file
 * *types*; this catches a known-malicious file that slips through under a benign
 * extension (e.g. a weaponised PDF).
 *
 * It uses VirusTotal's file-REPUTATION lookup: only the file's SHA-256 hash is
 * sent to VirusTotal, never the file bytes — so no patient data leaves the
 * server. This catches files already known to VirusTotal; it is not a substitute
 * for a full sandbox detonation of novel samples.
 *
 * Fail-open by design: if scanning is unconfigured or VirusTotal is unreachable,
 * the attachment is allowed (and logged) rather than breaking chat — the upload
 * type/size policy remains the always-on first line of defence.
 */

export type ScanResult = { clean: boolean; threat?: string };

// Attachments are already capped at 25 MB by the upload policy; guard anyway.
const MAX_SCAN_BYTES = 30 * 1024 * 1024;

// Only fetch attachment bytes from the Stream CDN. The URL arrives in a webhook
// payload (attacker-influenceable), so without this allowlist a crafted message
// could point the scan request at an internal host (SSRF). Override for a
// self-hosted/custom CDN via STREAM_ATTACHMENT_ALLOWED_HOSTS.
const DEFAULT_ALLOWED_HOSTS = ["stream-io-cdn.com", "stream-io-api.com"];

const allowedHosts = (): string[] => {
  const fromEnv = process.env.STREAM_ATTACHMENT_ALLOWED_HOSTS;
  if (!fromEnv) return DEFAULT_ALLOWED_HOSTS;
  return fromEnv
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
};

export const scanAttachmentUrl = async (url: string): Promise<ScanResult> => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    logger.warn("Attachment scan skipped: VIRUSTOTAL_API_KEY not configured");
    return { clean: true };
  }

  // SSRF guard: parse and host-allowlist the URL before issuing any request, so a
  // crafted webhook attachment URL cannot point the fetch at an internal host.
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { clean: true };
  }
  const host = target.hostname.toLowerCase();
  const hostAllowed = allowedHosts().some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  if (target.protocol !== "https:" || !hostAllowed) {
    logger.warn("Attachment scan skipped: URL host is not an allowed CDN");
    return { clean: true };
  }

  try {
    const fileRes = await fetch(target);
    if (!fileRes.ok) {
      logger.warn(`Attachment scan: download failed (${fileRes.status})`);
      return { clean: true };
    }
    const bytes = Buffer.from(await fileRes.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_SCAN_BYTES) {
      return { clean: true };
    }

    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const vtRes = await fetch(
      `https://www.virustotal.com/api/v3/files/${sha256}`,
      { headers: { "x-apikey": apiKey } },
    );

    // 404 = VirusTotal has never seen this file → nothing known against it.
    if (vtRes.status === 404) return { clean: true };
    if (!vtRes.ok) {
      logger.warn(
        `Attachment scan: VirusTotal lookup failed (${vtRes.status})`,
      );
      return { clean: true };
    }

    const body = (await vtRes.json()) as {
      data?: {
        attributes?: {
          last_analysis_stats?: { malicious?: number; suspicious?: number };
        };
      };
    };
    const stats = body?.data?.attributes?.last_analysis_stats ?? {};
    const hits = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
    if (hits > 0) {
      return {
        clean: false,
        threat: `flagged by ${hits} VirusTotal engine(s)`,
      };
    }
    return { clean: true };
  } catch (err) {
    logger.error("Attachment scan failed", err);
    return { clean: true };
  }
};
