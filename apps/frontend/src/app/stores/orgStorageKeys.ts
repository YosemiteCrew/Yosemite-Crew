/**
 * localStorage key for the org the user last worked in. orgStore keeps it outside its
 * persisted blob on purpose (see the comment there), and the authenticated e2e specs
 * set it to pin their fixture org, so both import it from here.
 */
export const LAST_ACTIVE_ORG_ID_KEY = 'yc_last_active_org_id';
