import "./taskReminder.worker";
import "./taskRecurrence.worker";
import "./taskSchedule.worker";
import "./appointment.worker";
import "./idexx-reference.worker";
import "./lab-status.worker";
import "./lab-results.worker";
import "./vaccineReminder.worker";
import "./ap-delivery.worker";
import "./ap-inbox.worker";
import "./public-booking.worker";
import "./parasite-risk.worker";
import logger from "src/utils/logger";

logger.info("👷 BullMQ workers running...");
