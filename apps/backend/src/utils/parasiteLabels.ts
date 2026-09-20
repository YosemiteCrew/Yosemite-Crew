import type { ParasiteId } from "@yosemite-crew/types";

/**
 * Plain-English parasite names for push notification copy.
 *
 * Server-side notification text is English, matching the other templates in
 * `notificationTemplates.ts`. The in-app surfaces translate parasite names
 * through the mobile i18n resources instead, so this map is deliberately not
 * the source of truth for anything rendered inside the app.
 */
export const PARASITE_ALERT_LABELS: Record<ParasiteId, string> = {
  heartworm: "heartworm",
  paralysis_tick: "paralysis tick",
  brown_dog_tick: "brown dog tick",
  blacklegged_tick: "deer tick",
  lone_star_tick: "lone star tick",
  american_dog_tick: "American dog tick",
  castor_bean_tick: "castor bean tick",
  ornate_dog_tick: "ornate dog tick",
  flea: "flea",
  sandfly_leishmania: "sandfly",
  lungworm: "lungworm",
  intestinal_worms: "intestinal worm",
};
