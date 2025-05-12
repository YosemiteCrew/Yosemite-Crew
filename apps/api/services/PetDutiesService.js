const { sharedRecord } = require('../models/petDuties'); // adjust the path as needed
const { mongoose } = require('mongoose'); // for ObjectId validation

class PetDutiesService {

  static async saveFromFhirObservation(fhirData, userId) {
    try {
      if (!fhirData || typeof fhirData !== "object") {
        throw new Error("Invalid or missing FHIR data.");
      }
  
      // Extract petId from FHIR subject reference: "Pet/<petId>"
      const petId = fhirData.subject?.reference?.split("/")[1];
      if (!petId) throw new Error("Invalid or missing pet reference in FHIR data.");
  
      // Extract ownerId from FHIR extension
      const ownerIdExtension = fhirData.extension?.find(
        ext => ext.url === "http://example.org/fhir/StructureDefinition/ownerId"
      );
      const ownerId = ownerIdExtension?.valueString || null;
      if (!ownerId) throw new Error("Missing ownerId in FHIR extension.");
  
      //  Extract and validate effectiveDateTime
      const taskDateTime = new Date(fhirData.effectiveDateTime);
      if (isNaN(taskDateTime)) throw new Error("Invalid or missing effectiveDateTime.");
      
      const taskDate = taskDateTime.toISOString().split('T')[0]; // YYYY-MM-DD
      const taskTime = taskDateTime.toISOString().split('T')[1].slice(0, 5); // HH:mm
  
      //  Extract repeat and reminder from components (optional)
      const repeatTaskComp = fhirData.component?.find(c =>
        c.code?.coding?.some(code => code.code === "repeat")
      );
      const taskReminderComp = fhirData.component?.find(c =>
        c.code?.coding?.some(code => code.code === "reminder")
      );
  
      const repeatTask = repeatTaskComp?.valueString || "none";
      const taskReminder = taskReminderComp?.valueString || "none";
  
      // Extract syncWithCalendar from FHIR extension (default: false)
      const syncWithCalendarExt = fhirData.extension?.find(
        ext => ext.url === "http://example.org/fhir/StructureDefinition/syncWithCalendar"
      );
      const syncWithCalendar = syncWithCalendarExt?.valueBoolean ?? false;
  
      //  Collect other component details
      const taskDetails = (fhirData.component || []).filter(comp => {
        const code = comp.code?.coding?.[0]?.code;
        return code !== "repeat" && code !== "reminder";
      }).map(comp => ({
        name: comp.code?.text || comp.code?.coding?.[0]?.display || "Unnamed Component",
        value: comp.valueString ?? comp.valueQuantity?.value ?? null,
        unit: comp.valueQuantity?.unit || null,
        code: comp.code?.coding?.[0]?.code || null
      }));
  
      const newRecord = await sharedRecord.create({
        petId,
        userId: userId || null,
        ownerId,
        taskName: fhirData.code?.text || "Pet Observation",
        taskDate,
        taskTime,
        repeatTask,
        taskReminder,
        taskDetails,
        syncWithCalendar
      });
  
      return newRecord;
  
    } catch (error) {
      console.error("Error in saveFromFhirObservation:", error.message);
      throw error;
    }
  }

  static async getDutiesByUserId(userId) {
    const records = await sharedRecord.find({ userId: { $eq: userId } });

    return records.map(record => {
      const components = (record.taskDetails || []).map(detail => ({
        code: {
          coding: [
            {
              system: "http://example.org/fhir/task-metadata",
              code: detail.code || "unknown",
              display: detail.name || "Task Detail"
            }
          ],
          text: detail.name
        },
        ...(detail.value !== null && { valueString: String(detail.value) }),
        ...(detail.unit && { valueQuantity: { value: Number(detail.value), unit: detail.unit } })
      }));

      return {
        resourceType: "Observation",
        status: "final",
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
              system: "http://example.org/fhir/task-type",
              code: "shared-duty",
              display: record.taskName
            }
          ],
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
            valueString: record.repeatTask || "none"
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
            valueString: record.taskReminder || "none"
          },
          ...components
        ]
      };
    });
  }

  static async updateDutyByIdFromFhir(taskId, fhirData) {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new Error("Invalid task ID format.");
    }
  
    const petRef = fhirData.subject?.reference;
    const petId = typeof petRef === "string" ? petRef.split("/")[1] : null;
    if (!petId || !mongoose.Types.ObjectId.isValid(petId)) {
      throw new Error("Invalid or missing pet reference in FHIR data.");
    }
  
    const ownerId = fhirData.extension?.find(
      ext => ext.url === "http://example.org/fhir/StructureDefinition/ownerId"
    )?.valueString;
  
    const syncWithCalendar = !!fhirData.extension?.find(
      ext => ext.url === "http://example.org/fhir/StructureDefinition/syncWithCalendar"
    )?.valueBoolean;
  
    const taskDateTime = new Date(fhirData.effectiveDateTime);
    if (isNaN(taskDateTime)) throw new Error("Invalid effectiveDateTime");
  
    const taskDate = taskDateTime.toISOString().split("T")[0];
    const taskTime = taskDateTime.toISOString().split("T")[1]?.slice(0, 5);
  
    const repeatTask = fhirData.component?.find(c =>
      c.code?.coding?.some(code => code.code === "repeat")
    )?.valueString || "none";
  
    const taskReminder = fhirData.component?.find(c =>
      c.code?.coding?.some(code => code.code === "reminder")
    )?.valueString || "none";
  
    const taskDetails = (fhirData.component || [])
      .filter(comp => {
        const code = comp.code?.coding?.[0]?.code;
        return code !== "repeat" && code !== "reminder";
      })
      .map(comp => ({
        name: comp.code?.text || comp.code?.coding?.[0]?.display || "Unnamed Component",
        value: comp.valueString ?? comp.valueQuantity?.value ?? null,
        unit: comp.valueQuantity?.unit || null,
        code: comp.code?.coding?.[0]?.code || null
      }))
      .filter(detail => detail.value !== null); // remove null-only entries
  
    // Construct safe update object
    const updateData = {
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
  
    // Clean undefined fields before update
    Object.keys(updateData).forEach(
      key => updateData[key] === undefined && delete updateData[key]
    );
  
    const updated = await sharedRecord.findOneAndUpdate(
      { _id: taskId },
      updateData,
      { new: true }
    );
  
    if (!updated) return null;
  
    // Convert updated record to FHIR Observation
    return {
      resourceType: "Observation",
      status: "final",
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
            system: "http://example.org/fhir/task-type",
            code: "shared-duty",
            display: updated.taskName
          }
        ],
        text: updated.taskName
      },
      subject: {
        reference: `Pet/${updated.petId}`
      },
      effectiveDateTime: `${updated.taskDate}T${updated.taskTime || "00:00"}:00+05:30`,
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/ownerId",
          valueString: updated.ownerId
        },
        {
          url: "http://example.org/fhir/StructureDefinition/syncWithCalendar",
          valueBoolean: updated.syncWithCalendar || false
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
          valueString: updated.repeatTask
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
          valueString: updated.taskReminder
        },
        ...(updated.taskDetails || []).map(detail => ({
          code: {
            coding: [
              {
                system: "http://example.org/fhir/task-metadata",
                code: detail.code || "extra",
                display: detail.name || "Extra Detail"
              }
            ],
            text: detail.name
          },
          ...(detail.unit
            ? { valueQuantity: { value: detail.value, unit: detail.unit } }
            : { valueString: String(detail.value) })
        }))
      ]
    };
  }
  
 

    static async deletePetDuties(taskId) {
        const PetDutyToDelete = await PetDutiesService.getPetDutiesById(taskId);
        if (!PetDutyToDelete) {
          return null;
        }
        const result = await sharedRecord.deleteOne({ _id: taskId });
        if (result.deletedCount === 0) {
          throw new Error("Pet Task not found");
        }
        return PetDutyToDelete;  
      }


    static async getPetDutiesById(taskId) {
        try {
          const PetDuty = await sharedRecord.findOne({ _id: taskId }).lean();
          return PetDuty;
        } catch (error) {
          throw new Error('Error while fetching feedback: ' + error.message);
        }
      }

  }
  

module.exports = PetDutiesService;