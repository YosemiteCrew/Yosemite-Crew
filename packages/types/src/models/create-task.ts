import { Document } from "mongoose";

export type ITask = Document & {
  taskTitle: string;
  taskCategory: string;
  description: string;
  priority: string;
  startDate: Date;
  endDate: Date;
  assignedTo: string;
  assignedDepartment: string;
  patientName: string;
  parentName: string;
  appointmentId: string;
  taskStatus: string;
  uploadedFiles?: {
    name: string;
    type: string;
    date: Date;
  }[];
}


export type FormTaskData = {
  taskTitle: string;
  taskCategory: string;
  description: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  assignedTo: string;
  assignedDepartment: string;
  patientName: string;
  parentName: string;
  appointmentId: string;
};

export type UploadedFileForCreateTask = {
  url: string;
  contentType: string;
  fileName: string;
};
