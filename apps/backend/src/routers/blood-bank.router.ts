import { Router } from "express";
import { BloodBankController } from "src/controllers/web/blood-bank.controller";
import { requirePermission } from "src/middlewares/rbac";

const bloodBankRouter = Router({ mergeParams: true });
const DONORS = "/pms/organisation/:organisationId/blood-bank/donors";
const DONATIONS = "/pms/organisation/:organisationId/blood-bank/donations";

bloodBankRouter.get(
  DONORS,
  requirePermission("appointments:view:any"),
  BloodBankController.listDonors,
);
bloodBankRouter.post(
  DONORS,
  requirePermission("appointments:edit:any"),
  BloodBankController.registerDonor,
);
bloodBankRouter.get(
  `${DONORS}/:donorId`,
  requirePermission("appointments:view:any"),
  BloodBankController.getDonor,
);
bloodBankRouter.put(
  `${DONORS}/:donorId`,
  requirePermission("appointments:edit:any"),
  BloodBankController.updateDonor,
);
bloodBankRouter.get(
  DONATIONS,
  requirePermission("appointments:view:any"),
  BloodBankController.listDonations,
);
bloodBankRouter.post(
  DONATIONS,
  requirePermission("appointments:edit:any"),
  BloodBankController.recordDonation,
);
bloodBankRouter.get(
  `${DONATIONS}/:donationId`,
  requirePermission("appointments:view:any"),
  BloodBankController.getDonation,
);
bloodBankRouter.put(
  `${DONATIONS}/:donationId`,
  requirePermission("appointments:edit:any"),
  BloodBankController.updateDonation,
);

export default bloodBankRouter;
