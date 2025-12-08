// src/controllers/pms/rbac.controller.ts

import { Request, Response } from "express";
import { RbacService } from "../../services/rbac.service";

export const RbacController = {
  async addPermission(req: Request, res: Response) {
    try {
      const { orgId, userId } = req.params;
      const { permission } = req.body;

      const updated = await RbacService.addExtraPermission(
        userId,
        orgId,
        permission
      );

      return res.status(200).json({
        message: "Permission added",
        data: updated,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },

  async removePermission(req: Request, res: Response) {
    try {
      const { orgId, userId } = req.params;
      const { permission } = req.body;

      const updated = await RbacService.removeExtraPermission(
        userId,
        orgId,
        permission
      );

      return res.status(200).json({
        message: "Permission removed",
        data: updated,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  },
};