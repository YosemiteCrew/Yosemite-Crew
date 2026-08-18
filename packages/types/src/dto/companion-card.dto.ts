import type { CompanionCardAudience } from '../companion-card';

export interface IssueShareTokenRequestDTO {
  audience: CompanionCardAudience;
  // Optional caller override; the service clamps this to the per-audience cap.
  ttlSeconds?: number;
  // Opt-in (default false) to surface the owner phone on a PUBLIC card.
  showOwnerPhone?: boolean;
}

// Safe representation of a share token row. NEVER includes the raw token or its
// hash - only non-secret state. All DateTimes are ISO strings per DTO convention.
export interface ShareTokenResponseDTO {
  id: string;
  audience: CompanionCardAudience;
  showOwnerPhone: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
}

// Returned exactly once when a token is issued: the raw token and the QR payload
// (the public URL) are present here and nowhere else; they are never persisted.
export interface IssueShareTokenResultDTO {
  token: string;
  qrPayload: string;
  share: ShareTokenResponseDTO;
}
