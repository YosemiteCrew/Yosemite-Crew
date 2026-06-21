import { NextFunction, Request, Response, Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CatalogController } from "src/controllers/web/catalog.controller";

const router = Router();

const attachOrganisationIdFromQuery = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const organization =
    typeof req.query.organization === "string"
      ? req.query.organization
      : typeof req.query["provided-by"] === "string"
        ? req.query["provided-by"]
        : undefined;

  if (organization && !req.params.organisationId) {
    req.params.organisationId = organization.replace(/^Organization\//, "");
  }

  next();
};

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createProduct,
);

router.patch(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateProduct,
);

router.get(
  "/:id",
  authorizeCognito,
  attachOrganisationIdFromQuery,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getProductById,
);

router.get(
  "/",
  authorizeCognito,
  attachOrganisationIdFromQuery,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listProducts,
);

router.post(
  "/$resolve-selection",
  authorizeCognito,
  attachOrganisationIdFromQuery,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.resolveProductOperation,
);

router.post(
  "/$search-components",
  authorizeCognito,
  attachOrganisationIdFromQuery,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.searchCatalogOperation,
);

export default router;
