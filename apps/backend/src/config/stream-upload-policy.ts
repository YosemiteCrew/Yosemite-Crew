// src/config/stream-upload-policy.ts
import { StreamChat } from "stream-chat";
import logger from "src/utils/logger";

/**
 * File extensions that can carry executable or browser-active content. These are
 * blocked from chat uploads at the Stream APP level via updateAppSettings, so the
 * policy is enforced by Stream's servers for EVERY client — a user holding a valid
 * Stream token cannot bypass it by calling the upload API directly. The web
 * composer applies the same list for UX, but this is the authoritative control.
 */
export const BLOCKED_UPLOAD_EXTENSIONS = [
  // Windows executables / installers
  "exe",
  "com",
  "dll",
  "scr",
  "pif",
  "cpl",
  "msi",
  "msp",
  "mst",
  "bat",
  "cmd",
  "jar",
  // macOS / Linux executables, libraries & packages
  "app",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "elf",
  "so",
  "dylib",
  // Scripts
  "sh",
  "bash",
  "zsh",
  "ps1",
  "psm1",
  "psd1",
  "vbs",
  "vbe",
  "js",
  "mjs",
  "cjs",
  "jse",
  "wsf",
  "wsh",
  "hta",
  "reg",
  "py",
  "pyc",
  "rb",
  "pl",
  "php",
  "phtml",
  "asp",
  "aspx",
  "jsp",
  "cgi",
  "ahk",
  "scpt",
  // Markup / active content a browser may execute when opened from the CDN
  "html",
  "htm",
  "xhtml",
  "shtml",
  "svg",
  "svgz",
  "swf",
  "mht",
  "mhtml",
  // Shortcuts / misc dangerous launchers
  "lnk",
  "url",
  "scf",
  "inf",
  "gadget",
  "msc",
  "jnlp",
];

export const BLOCKED_UPLOAD_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-dosexec",
  "application/x-executable",
  "application/vnd.microsoft.portable-executable",
  "application/x-msi",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-csh",
  "application/java-archive",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/x-httpd-php",
  "application/x-php",
  "text/x-php",
  "application/x-perl",
  "application/x-python",
  "application/x-ruby",
  "application/x-shockwave-flash",
];

// 25 MB — generous for clinical documents/images, well under Stream's hard cap.
export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Apply the chat upload policy to the Stream application. Idempotent and
 * best-effort: a failure is logged but never blocks server startup, since the
 * app can still run (uploads simply fall back to Stream's default policy).
 */
export const configureStreamUploadPolicy = async (): Promise<void> => {
  const key = process.env.STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!key || !secret) {
    logger.warn("Skipping Stream upload policy: credentials missing");
    return;
  }

  const uploadConfig = {
    blocked_file_extensions: BLOCKED_UPLOAD_EXTENSIONS,
    blocked_mime_types: BLOCKED_UPLOAD_MIME_TYPES,
    size_limit: MAX_UPLOAD_SIZE_BYTES,
  };

  // Opt-in: when a public webhook URL is set, route Stream events to the
  // attachment malware scanner. Left unset by default so an existing webhook
  // configuration is never clobbered.
  const webhookUrl = process.env.STREAM_WEBHOOK_URL;

  try {
    const client = StreamChat.getInstance(key, secret);
    await client.updateAppSettings({
      file_upload_config: uploadConfig,
      image_upload_config: uploadConfig,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    });
    logger.info(
      webhookUrl
        ? "Stream chat upload policy + malware-scan webhook configured"
        : "Stream chat upload policy applied: malware-prone types blocked",
    );
  } catch (err) {
    logger.error("Failed to apply Stream chat upload policy", err);
  }
};
