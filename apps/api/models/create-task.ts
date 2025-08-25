import { ITask } from '@yosemite-crew/types';
import mongoose, { Schema } from 'mongoose';



const taskSchema: Schema = new Schema({
  taskTitle: { type: String, required: true },
  taskCategory: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  assignedTo: { type: String, required: true },
  assignedDepartment: { type: String, required: true },
  patientName: { type: String, required: true },
  parentName: { type: String, required: false },
  appointmentId: { type: String, required: true },
  taskStatus: { type: String, default: 'Pending' },
  uploadedFiles: {
    type: [
      {
        name: { type: String, required: true },
        type: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
}, {
  timestamps: true // Automatically manage createdAt and updatedAt fields
});

export default mongoose.model<ITask>('Task', taskSchema);