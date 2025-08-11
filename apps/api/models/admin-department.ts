import { adminDepartment } from "@yosemite-crew/types";
import mongoose from "mongoose";

const Departments = new mongoose.Schema<adminDepartment>({
    name:{type:String, required:true}
},
{timestamps:true})


const adminDepartments = mongoose.model("adminDepartments", Departments)
export default adminDepartments