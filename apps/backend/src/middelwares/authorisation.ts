import { Request, Response, NextFunction } from "express";
import { WebUser as User } from "../models/webUser";
import { Role } from "../models/role";

export async function loadPermissions(
    req: Request & { user?: any }, 
    res: Response, 
    next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await User.findOne({ cognitoId: req.user.sub })
  if (!user) return res.status(403).json({ message: "User not found" });

  const role = await Role.findOne({name : user.role});
  if (!role) return res.status(403).json({ message: "Role not found" });

  const merged: Record<string, Set<string>> = {};

  // Add role permissions
  for (const [resource, actions] of Object.entries(role.permissions)) {
    if (!merged[resource]) merged[resource] = new Set();
    (actions as string[]).forEach((a) => merged[resource].add(a));
  }

  // Add extra user-specific permissions
  for (const [resource, actions] of Object.entries(user.extraPermissions || {})) {
    if (!merged[resource]) merged[resource] = new Set();
    (actions as string[]).forEach((a) => merged[resource].add(a));
  }

  req.user.permissions = Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, Array.from(v)])
  );

  next();
}

export function authorize (resource: string, action: string) {

    return (
        req : Request & { user?: any }, 
        res : Response, 
        next : NextFunction
    ) => {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        // Check if user is allowed to perform a given operation on a given resource
        const perms = req.user.permissions[resource] || [];
        if (!perms.includes(action)) {
        return res.status(403).json({ message: "Forbidden" });
        }

        next();
    }
    
}