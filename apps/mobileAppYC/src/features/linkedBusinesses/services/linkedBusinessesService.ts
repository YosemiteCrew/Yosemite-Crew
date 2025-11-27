import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

const BASE_URL = '/v1';
const FHIR_BASE_URL = '/fhir/v1';

type OrganisationType = 'HOSPITAL' | 'BOARDER' | 'BREEDER' | 'GROOMER';

export interface FetchLinkedBusinessesResponse {
  companionId: string;
  organisations: LinkedOrganisation[];
  parentName?: string;
  email?: string;
  companionName?: string;
  phoneNumber?: string;
}

export interface LinkedOrganisation {
  id: string;
  name: string;
  type: OrganisationType;
  email?: string;
  phone?: string;
  address?: string;
  photo?: string;
  distance?: number;
  rating?: number;
  state: 'active' | 'pending';
  linkId?: string;
  parentName?: string;
  parentEmail?: string;
}

export interface CheckBusinessRequest {
  placeId: string;
  lat: number;
  lng: number;
  name?: string;
  addressLine: string;
}

export interface CheckBusinessResponse {
  isPmsOrganisation: boolean;
  organisation?: {
    resourceType: string;
    id: string;
    name: string;
    [key: string]: any;
  };
}

export interface LinkBusinessRequest {
  companionId: string;
  organisationId: string;
  organisationType: OrganisationType;
}

export interface InviteBusinessRequest {
  companionId: string;
  email: string;
  organisationType: OrganisationType;
  name: string;
}

export interface InviteBusinessResponse {
  success: boolean;
  message: string;
}

export interface ApproveDenyRequest {
  linkId: string;
}

type LinkedBusinessesApiResponse = LinkedOrganisation[] | {links: LinkedOrganisation[]};

const linkedBusinessesService = {
  /**
   * Fetch all linked businesses for a companion
   * GET /v1/companion-organisation/{companionId}?type={type}
   */
  async fetchLinkedBusinesses(
    companionId: string,
    type: OrganisationType,
    accessToken: string,
  ): Promise<LinkedBusinessesApiResponse> {
    try {
      const response = await apiClient.get<any>(
        `${BASE_URL}/companion-organisation/${companionId}?type=${type}`,
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      // API returns {links: [...]} wrapper
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to fetch linked businesses:', error);
      throw error;
    }
  },

  /**
   * Check if a business is part of PMS system
   * POST /fhir/v1/organization/check
   * Body: {placeId, lat, lng, name (optional), addressLine}
   */
  async checkBusiness(
    checkRequest: CheckBusinessRequest,
    accessToken: string,
  ): Promise<CheckBusinessResponse> {
    try {
      const response = await apiClient.post<CheckBusinessResponse>(
        `${FHIR_BASE_URL}/organization/check`,
        {
          placeId: checkRequest.placeId,
          // Round coordinates to 6 decimal places to avoid floating-point precision issues
          lat: Math.round(checkRequest.lat * 1000000) / 1000000,
          lng: Math.round(checkRequest.lng * 1000000) / 1000000,
          addressLine: checkRequest.addressLine,
          ...(checkRequest.name && {name: checkRequest.name}),
        },
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to check business:', error);
      throw error;
    }
  },

  /**
   * Link a business to companion (for PMS businesses)
   * POST /v1/companion-organisation/link
   */
  async linkBusiness(
    linkRequest: LinkBusinessRequest,
    accessToken: string,
  ): Promise<LinkedOrganisation> {
    try {
      const response = await apiClient.post<LinkedOrganisation>(
        `${BASE_URL}/companion-organisation/link`,
        {
          companionId: linkRequest.companionId,
          organisationId: linkRequest.organisationId,
          organisationType: linkRequest.organisationType,
        },
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to link business:', error);
      throw error;
    }
  },

  /**
   * Invite a business (for non-PMS businesses)
   * POST /v1/companion-organisation/invite
   */
  async inviteBusiness(
    inviteRequest: InviteBusinessRequest,
    accessToken: string,
  ): Promise<InviteBusinessResponse> {
    try {
      const response = await apiClient.post<InviteBusinessResponse>(
        `${BASE_URL}/companion-organisation/invite`,
        {
          companionId: inviteRequest.companionId,
          email: inviteRequest.email,
          organisationType: inviteRequest.organisationType,
          name: inviteRequest.name,
        },
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to invite business:', error);
      throw error;
    }
  },

  /**
   * Approve a pending invite
   * POST /v1/companion-organisation/{linkId}/approve
   */
  async approveLinkInvite(
    linkId: string,
    accessToken: string,
  ): Promise<LinkedOrganisation> {
    try {
      const response = await apiClient.post<LinkedOrganisation>(
        `${BASE_URL}/companion-organisation/${linkId}/approve`,
        {},
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to approve invite:', error);
      throw error;
    }
  },

  /**
   * Deny a pending invite
   * POST /v1/companion-organisation/{linkId}/deny
   */
  async denyLinkInvite(
    linkId: string,
    accessToken: string,
  ): Promise<LinkedOrganisation> {
    try {
      const response = await apiClient.post<LinkedOrganisation>(
        `${BASE_URL}/companion-organisation/${linkId}/deny`,
        {},
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to deny invite:', error);
      throw error;
    }
  },

  /**
   * Revoke/Delete a linked business connection
   * DELETE /v1/companion-organisation/revoke/{linkId}
   */
  async revokeLinkedBusiness(
    linkId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      const response = await apiClient.delete(
        `${BASE_URL}/companion-organisation/revoke/${linkId}`,
        {
          headers: withAuthHeaders(accessToken),
        },
      );
      return response.data;
    } catch (error) {
      console.error('[LinkedBusinesses] Failed to revoke business:', error);
      throw error;
    }
  },
};

export default linkedBusinessesService;
