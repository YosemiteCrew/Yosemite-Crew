import logger from "src/utils/logger";
import { PublicBookingQueue, PublicBookingJobs } from "./public-booking.queue";

export async function registerPublicBookingSchedulers() {
  // Hourly. `PublicBookingRequest` holds names, email addresses, phone numbers
  // and animal details belonging to people with no relationship to the practice,
  // so the retention deadline on each row has to be enforced by something that
  // runs whether or not anyone is using the feature. Hourly keeps the window
  // between "past its deadline" and "deleted" short without polling hard.
  await PublicBookingQueue.upsertJobScheduler(
    "public-booking-purge-repeat",
    { every: 60 * 60 * 1000 },
    { name: PublicBookingJobs.PURGE_EXPIRED_REQUESTS, data: {} },
  );

  logger.info("✅ Public booking schedulers registered");
}
