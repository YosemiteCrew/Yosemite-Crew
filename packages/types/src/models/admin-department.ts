import { Document } from "mongoose"

export type adminDepartment = Document& {
    name:string;
    _id?:string;
    __v?:number
}


export type AdminDepartmentItem = {
  _id: string;
  name: string;
};

export type AdminFHIRHealthcareService = {
  resourceType: "HealthcareService";
  id: string;
  name: string;
};
