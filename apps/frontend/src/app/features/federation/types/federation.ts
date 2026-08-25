export type APFollowerState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
export type APFollowingState = 'PENDING' | 'ACCEPTED' | 'REJECTED';
export type APReferralState = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type APReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type LicenseTokenStatus = 'none' | 'valid' | 'invalid';

export interface APActorSettings {
  uri: string;
  preferredUsername: string;
  publicKeyId: string;
  inboxUri: string;
  outboxUri: string;
  followersUri: string;
  followingUri: string;
  sharedInboxUri: string | null;
  summary: string | null;
  iconUrl: string | null;
  createdAt: string;
  licenseTokenStatus: LicenseTokenStatus;
  isVerified: boolean;
  directoryListed: boolean;
}

export interface APDirectoryClinic {
  actorUri: string;
  orgName: string;
  instanceHost: string;
  handle: string;
}

export interface APDirectory {
  clinics: APDirectoryClinic[];
  /** True when the authority could not be reached, as opposed to being empty. */
  unavailable?: boolean;
}

export interface APFollower {
  id: string;
  remoteActorUri: string;
  remoteInboxUri: string;
  state: APFollowerState;
  approvedAt: string | null;
  createdAt: string;
}

export interface APFollowing {
  id: string;
  remoteActorUri: string;
  state: APFollowingState;
  createdAt: string;
}

export interface APReferral {
  id: string;
  activityUri: string;
  fromActorUri: string;
  toActorUri: string;
  fromOrgId: string | null;
  toOrgId: string | null;
  patientSummary: {
    species: string;
    breed?: string;
    age?: string;
    chiefComplaint: string;
    currentMedications?: string[];
    allergies?: string[];
  };
  clinicalContext: string | null;
  urgency: APReferralUrgency;
  state: APReferralState;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export interface SendReferralPayload {
  toActorUri: string;
  patientSummary: {
    species: string;
    breed?: string;
    age?: string;
    chiefComplaint: string;
    currentMedications?: string[];
    allergies?: string[];
  };
  urgency?: APReferralUrgency;
  clinicalContext?: string;
}
