import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getCognitoUserId }  from  '../middlewares/authMiddleware';
import helpers from '../utils/helpers';
import { UploadedFile } from 'express-fileupload';
import { PetCoOwnerInput,FileUrl,SharedPetDutyInput, TaskDetail,UpdateData,RecordTaskDetail,RecordType } from '@yosemite-crew/types'; // ✅ right
import { CoOwnerFhirData,FhirObservation,FhirExtension,PetDutyFhirObservationOutput,FhirComponent} from '@yosemite-crew/fhir';
import petCoOwner  from '../models/pet-co-owner';
import sharedRecord from '../models/shared-pet-duties';


const sharedDutiesController: Record<string, unknown> = {

  savePetCoOwner: async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const fhirDataRaw = typeof body.data === 'string' ? body.data : '';
      const inputFhirData = JSON.parse(fhirDataRaw) as Record<string, unknown>;
      const fhirData: CoOwnerFhirData = inputFhirData;

     let fileArray: unknown[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          fileArray = req.files;
        } else if (typeof req.files === 'object') {
          // If multer is configured with fields, req.files is an object: { fieldname: File[] }
          // Try to get all files from all fields
          fileArray = Object.values(req.files).flat();
        }
      }
      const vaccineFileUrl = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray as unknown as UploadedFile[])
        : [];

      const profileImage: FileUrl[] = (vaccineFileUrl as unknown[]).map((file) => {
        if (
          typeof file === 'object' &&
          file !== null &&
          typeof (file as { url?: unknown }).url === 'string' &&
          typeof (file as { originalname?: unknown }).originalname === 'string' &&
          typeof (file as { mimetype?: unknown }).mimetype === 'string'
        ) {
          return {
            url: (file as { url: string }).url,
            originalname: (file as { originalname: string }).originalname,
            mimetype: (file as { mimetype: string }).mimetype
          };
        }
        // Optionally handle invalid file objects
        return {
          url: '',
          originalname: '',
          mimetype: ''
        };
      });
    const cognitoUserId = getCognitoUserId(req);
    const recordPayload: PetCoOwnerInput = {
              firstName: fhirData.name?.[0]?.given?.[0] || '',
              lastName: fhirData.name?.[0]?.family || '',
              relationToPetOwner: fhirData.relationship?.[0]?.coding?.[0]?.display || 'Co-owner',
              profileImage, // already typed as FileUrl[]
              createdBy: cognitoUserId,
    };

    const result = await petCoOwner.create(recordPayload);
      if (result) {
        return res.status(200).json({
          status: 1,
          message: 'Pet Co-owner saved successfully',
        });
      } else {
        return res.status(200).json({
          status: 0,
          message: 'Failed to save Pet Co-owner',
        });
      }
   } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error saving Pet Co-owner';
      return res.status(200).json({ status: 0, message: 'Internal server error', error: errorMessage });
    }
  },

  saveSharedDuties: async (req: Request, res: Response) => {
    try {
    const body = req.body as Record<string, unknown>;
    const inputFhirData = typeof body.data === 'string' ? body.data : '';

    if (!inputFhirData) {
      return res.status(400).json({ status: 0, message: 'Missing FHIR data in request body.' });
    }
    const parsedFhirData = JSON.parse(inputFhirData ?? '') as unknown;
    // Optionally, add runtime validation here if needed
    const fhirData: FhirObservation = parsedFhirData as FhirObservation;
    const userId = getCognitoUserId(req);

    if (!fhirData || typeof fhirData !== 'object') {
      throw new Error('Invalid or missing FHIR data.');
    }

    // Extract petId from FHIR subject reference
    const petId = fhirData.subject?.reference?.split('/')?.[1];
    if (!petId) throw new Error('Invalid or missing pet reference in FHIR data.');

    // Extract ownerId from FHIR extension
    const ownerIdExtension = fhirData.extension?.find(
      (ext) => ext.url === 'http://example.org/fhir/StructureDefinition/ownerId'
    );
    const ownerId = ownerIdExtension?.valueString;
    if (!ownerId) throw new Error('Missing ownerId in FHIR extension.');

    // Parse and validate effectiveDateTime
    const taskDateTime = new Date(fhirData.effectiveDateTime ?? '');
    if (isNaN(taskDateTime.getTime())) throw new Error('Invalid or missing effectiveDateTime.');

    const taskDate = taskDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const taskTime = taskDateTime.toISOString().split('T')[1].slice(0, 5); // HH:mm

    // Extract repeat and reminder
    const repeatTaskComp = fhirData.component?.find((c) =>
      c.code?.coding?.some((code) => code.code === 'repeat')
    );
    const taskReminderComp = fhirData.component?.find((c) =>
      c.code?.coding?.some((code) => code.code === 'reminder')
    );

    const repeatTask = repeatTaskComp?.valueString || 'none';
    const taskReminder = taskReminderComp?.valueString || 'none';

    // syncWithCalendar from extensions
    const syncWithCalendarExt = fhirData.extension?.find(
      (ext) => ext.url === 'http://example.org/fhir/StructureDefinition/syncWithCalendar'
    );
    const syncWithCalendar = syncWithCalendarExt?.valueBoolean ?? false;

    // Extract taskDetails (excluding repeat/reminder)
    const taskDetails: TaskDetail[] = (fhirData.component || [])
      .filter((comp) => {
        const code = comp.code?.coding?.[0]?.code;
        return code !== 'repeat' && code !== 'reminder';
      })
      .map((comp) => ({
        name: comp.code?.text || comp.code?.coding?.[0]?.display || 'Unnamed Component',
        value: comp.valueString ?? comp.valueQuantity?.value ?? null,
        unit: comp.valueQuantity?.unit ?? null,
        code: comp.code?.coding?.[0]?.code ?? null,
      }));

    // Construct input payload
    const recordPayload: SharedPetDutyInput = {
      petId,
      userId,
      ownerId,
      taskName: fhirData.code?.text || 'Pet Observation',
      taskDate,
      taskTime,
      repeatTask,
      taskReminder,
      taskDetails,
      syncWithCalendar,
    };

    const newRecord = await sharedRecord.create(recordPayload);

    if (!newRecord) {
      return res.status(500).json({ status: 0, message: 'Failed to save shared pet duty.' });
    }

    return res.status(201).json({
      status: 1,
      message: 'Pet duty added successfully.',
      data: newRecord,
    });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error saving shared pet duty';
      return res.status(500).json({ status: 0, message: errorMessage });
    }
  },
 
 editSharedDuties: async (req: Request, res: Response) => {
    try {
      const body = req.body as { data?: string };
      const inputFhirData = body?.data;
      const id = req.query.taskId as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid ID format');
      }

      const parsedFhirData = JSON.parse(inputFhirData ?? '') as unknown;
    // Optionally, add runtime validation here if needed
    const fhirData: FhirObservation = parsedFhirData as FhirObservation;

      const petRef = fhirData.subject?.reference;
        const petId = typeof petRef === "string" ? petRef.split("/")[1] : null;
        if (!petId || !mongoose.Types.ObjectId.isValid(petId)) {
          throw new Error("Invalid or missing pet reference in FHIR data.");
        }
      
      const ownerId = fhirData.extension?.find(
        (ext: FhirExtension) => ext.url === "http://example.org/fhir/StructureDefinition/ownerId"
      )?.valueString;

      const syncWithCalendar = !!fhirData.extension?.find(
        (ext: FhirExtension) => ext.url === "http://example.org/fhir/StructureDefinition/syncWithCalendar"
      )?.valueBoolean;
      if (!ownerId) {
      throw new Error('Missing ownerId in FHIR extension');
       }

        const taskDateTime = new Date(fhirData.effectiveDateTime ?? '');
        if (isNaN(taskDateTime.getTime())) throw new Error("Invalid effectiveDateTime");
      
        const taskDate = taskDateTime.toISOString().split("T")[0];
        const taskTime = taskDateTime.toISOString().split("T")[1]?.slice(0, 5);
      
        const repeatTask =
          fhirData.component?.find((c): boolean => {
            if (!c.code?.coding) return false;
            return c.code.coding.some((code) => code.code === 'repeat');
          })?.valueString || 'none';

        const taskReminder =
          fhirData.component?.find((c): boolean => {
            if (!c.code?.coding) return false;
            return c.code.coding.some((code) => code.code === 'reminder');
          })?.valueString || 'none';
              
    // Extract taskDetails (excluding repeat/reminder)
    const taskDetails: TaskDetail[] = (fhirData.component || [])
          .filter((comp) => {
            const code = comp.code?.coding?.[0]?.code;
            return code !== 'repeat' && code !== 'reminder';
          })
          .map((comp) => ({
            name: comp.code?.text || comp.code?.coding?.[0]?.display || 'Unnamed Component',
            value: comp.valueString ?? comp.valueQuantity?.value ?? null,
            unit: comp.valueQuantity?.unit ?? null,
            code: comp.code?.coding?.[0]?.code ?? null,
          }));

        const updateData: UpdateData = {
          petId: mongoose.Types.ObjectId.isValid(petId) ? petId : undefined,
          ownerId: ownerId || undefined,
          taskName: fhirData.code?.text?.trim() || "Pet Observation",
          taskDate,
          taskTime,
          repeatTask,
          taskReminder,
          taskDetails,
          syncWithCalendar
        };

     const updatedshreddutiesRecord = await sharedRecord.findOneAndUpdate(
        { _id: id },
        updateData as mongoose.UpdateQuery<typeof sharedRecord.schema>,
        { new: true }
    );
    if (!updatedshreddutiesRecord) {
        return res.status(404).json({ message: "Shared duty task not found" });
      }

  
    const updatedFhir: PetDutyFhirObservationOutput = {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "activity",
                  display: "Activity"
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://example.org/fhir/CodeSystem/pet-duties',
                code: updatedshreddutiesRecord.taskName,
                display: updatedshreddutiesRecord.taskName
              }
            ],
            text: updatedshreddutiesRecord.taskName
          },
          subject: {
            reference: `Pet/${String(updatedshreddutiesRecord.petId)}`
          },
          effectiveDateTime: `${String(updatedshreddutiesRecord.taskDate || '')}T${String(updatedshreddutiesRecord.taskTime || '00:00')}:00`,
          extension: [
            {
              url: 'http://example.org/fhir/StructureDefinition/ownerId',
              valueString: updatedshreddutiesRecord.ownerId
            },
            {
              url: 'http://example.org/fhir/StructureDefinition/syncWithCalendar',
              valueBoolean: updatedshreddutiesRecord.syncWithCalendar || false
            }
          ],
         component: [
            {
              code: {
                coding: [
                  {
                    system: "http://example.org/fhir/task-metadata",
                    code: "repeat",
                    display: "Repeat Task"
                  }
                ],
                text: "Repeat Task"
              },
              valueString: updatedshreddutiesRecord.repeatTask ?? ''
            },
            {
              code: {
                coding: [
                  {
                    system: "http://example.org/fhir/task-metadata",
                    code: "reminder",
                    display: "Task Reminder"
                  }
                ],
                text: "Task Reminder"
              },
              valueString: updatedshreddutiesRecord.taskReminder ?? ''
            }
          ]
        };
      
      return res.status(200).json(updatedFhir);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return res.status(200).json({
        status: 0,
        message: "Error updating shared duty record",
        error: errorMessage
      });
    }
  },

  getSharedDuties: async (req: Request, res: Response) => {
    try {
      const userId = getCognitoUserId(req);
      if (!userId) {
        return res.status(400).json({ message: "userId is required." });
      }

      const rawRecords = await sharedRecord.find({ userId }).lean();

      const records: RecordType[] = (rawRecords as unknown as RecordType[]).map((record) => ({
        ...record,
        taskDate: (typeof record.taskDate === 'string')
          ? record.taskDate
          : (record.taskDate && typeof record.taskDate === 'object' && 'toISOString' in record.taskDate)
            ? (record.taskDate as Date).toISOString().split('T')[0]
            : '',
      }));

      if (!records.length) {
        return res.status(404).json({ message: "No Shared pet duty record found for this user." });
      }

      const observations: FhirObservation[] = records.map((record: RecordType): FhirObservation => {
        const taskComponents: FhirComponent[] = (record.taskDetails || []).map((detail: RecordTaskDetail): FhirComponent => {
          const numericValue = typeof detail.value === "string"
            ? (isNaN(parseFloat(detail.value)) ? undefined : parseFloat(detail.value))
            : typeof detail.value === "number"
              ? detail.value
              : undefined;

          return {
            code: {
              coding: [{
                system: "http://example.org/fhir/task-metadata",
                code: detail.code || "unknown",
                display: detail.name,
              }],
              text: detail.name,
            },
            ...(detail.unit && numericValue !== undefined
              ? { valueQuantity: { value: numericValue, unit: detail.unit } }
              : { valueString: detail.value !== null && detail.value !== undefined ? String(detail.value) : "" }
            )
          };
        });

        const staticComponents: FhirComponent[] = [
          {
            code: {
              coding: [{
                system: "http://example.org/fhir/task-metadata",
                code: "repeat",
                display: "Repeat Task"
              }],
              text: "Repeat Task"
            },
            valueString: record.repeatTask || "none"
          },
          {
            code: {
              coding: [{
                system: "http://example.org/fhir/task-metadata",
                code: "reminder",
                display: "Task Reminder"
              }],
              text: "Task Reminder"
            },
            valueString: record.taskReminder || "none"
          }
        ];

        return {
          resourceType: "Observation",
          code: {
            coding: [{
              system: "http://example.org/fhir/task-type",
              code: "shared-duty",
              display: record.taskName
            }],
            text: record.taskName
          },
          subject: {
            reference: `Pet/${record.petId}`
          },
          effectiveDateTime: `${record.taskDate}T${record.taskTime || "00:00"}:00+05:30`,
          extension: [
            {
              url: "http://example.org/fhir/StructureDefinition/ownerId",
              valueString: record.ownerId
            },
            {
              url: "http://example.org/fhir/StructureDefinition/syncWithCalendar",
              valueBoolean: record.syncWithCalendar || false
            }
          ],
          component: [...staticComponents, ...taskComponents]
        };
      });

      return res.status(200).json({ resourceType: "Bundle", type: "collection", entry: observations });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Internal server error";
      return res.status(500).json({ message: "Internal server error", error: errorMessage });
    }
  },
  

  deleteSharedDuties: async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId as string;

      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(200).json({ status: 0, message: "Invalid Task ID" });
      }
       const PetDuty = await sharedRecord.findOne({ _id: taskId }).lean();
      if (!PetDuty) {
          return res.status(200).json({ status: 0,message: `No task found with ID ${taskId}`});
      }
      const result = await sharedRecord.deleteOne({ _id: taskId });
        if (result.deletedCount === 0) {
           return res.status(200).json({ status: 0,message: "Error while deleting task"});
        }
      return res.status(200).json({ status: 1,message: "Pet Duty deleted successfully" });
    } catch (error: unknown) {
      return res.status(200).json({
        status: 0,
        message: error instanceof Error ? error.message : "An error occurred while deleting task",
      });
    }
  },

  deletePetCoOwner: async (req: Request, res: Response) => {
    const CoOwnerId = req.query.CoOwnerId as string;
    try {
      if (!mongoose.Types.ObjectId.isValid(CoOwnerId)) {
          return res.status(200).json({ status: 0,message: "Invalid Co Owner ID format"});
      }
        const data = await petCoOwner.find({ _id: CoOwnerId }); 
        if (data.length === 0) {
         return res.status(200).json({ status: 0,message: `No pet co owner found with ID ${CoOwnerId}`});
      }
    if (Array.isArray(data[0].profileImage) && data[0].profileImage.length > 0) {
      const profileImage = data[0].profileImage;

      for (const image of profileImage) {
        if (image.url) {
          await helpers.deleteFiles(image.url);
        }
      }
    }
    const result = await petCoOwner.deleteOne({ _id: { $eq: CoOwnerId } });
    if (result.deletedCount === 0) {
           return res.status(200).json({ status: 0,message: "Error while deleting pet co owner"});
        }
 
    } catch (error: unknown) {
       return res.status(200).json({
        status: 0,
        message: error instanceof Error ? error.message : "An error occurred while deleting task",
      });
    }
  }
}

export default sharedDutiesController;
