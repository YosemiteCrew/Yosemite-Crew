import "express";
import { ParamsFlatDictionary } from "express-serve-static-core";

declare module "express" {
  interface Request {
    params: ParamsFlatDictionary;
  }
}
