import { Router } from "express";
import { BloodBankController } from "src/controllers/web/blood-bank.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const bloodBankRouter = Router({ mergeParams: true });
const DONORS = "/pms/organisation/:organisationId/blood-bank/donors";
const DONATIONS = "/pms/organisation/:organisationId/blood-bank/donations";

bloodBankRouter.get(
  DONORS,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodBankController.listDonors,
);
bloodBankRouter.post(
  DONORS,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodBankController.registerDonor,
);
bloodBankRouter.get(
  `${DONORS}/:donorId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodBankController.getDonor,
);
bloodBankRouter.put(
  `${DONORS}/:donorId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodBankController.updateDonor,
);
bloodBankRouter.get(
  DONATIONS,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodBankController.listDonations,
);
bloodBankRouter.post(
  DONATIONS,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodBankController.recordDonation,
);
bloodBankRouter.get(
  `${DONATIONS}/:donationId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BloodBankController.getDonation,
);
bloodBankRouter.put(
  `${DONATIONS}/:donationId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BloodBankController.updateDonation,
);

export default bloodBankRouter;
