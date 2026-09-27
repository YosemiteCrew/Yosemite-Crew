import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { ObservationToolSubmissionService } from "../../src/services/observationToolSubmission.service";
import { TaskService } from "../../src/services/task.service";
import { prisma } from "src/config/prisma";
import { storedRows } from "../helpers/stored-rows";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaMock = prisma as any;

// ----------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------
jest.mock("../../src/services/task.service");
jest.mock("src/config/prisma", () => ({
  prisma: {
    observationToolDefinition: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    observationToolSubmission: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    patientOrganisation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Simple id helpers — assertObjectId only requires a non-empty string.
let idCounter = 0;
const newId = () => `id-${(idCounter += 1)}`;

type Row = { id: string; organisationId: string | null };
type FindManyArgs = {
  where: {
    id: { in: string[] };
    organisationId?: string;
    OR?: { organisationId: string | null }[];
  };
};

// Tasks and appointments of two organisations, read the way Prisma applies
// the `where` the service builds.
const ORG_TASKS: Row[] = [
  { id: "task-org-a", organisationId: "org-a" },
  { id: "task-parent", organisationId: null },
  { id: "task-org-b", organisationId: "org-b" },
];
const ORG_APPOINTMENTS: Row[] = [
  { id: "appt-org-a", organisationId: "org-a" },
  { id: "appt-org-b", organisationId: "org-b" },
];
const useOrganisationTables = () => {
  (prismaMock.task.findMany as any).mockImplementation(
    async ({ where }: FindManyArgs) =>
      ORG_TASKS.filter(
        (row) =>
          where.id.in.includes(row.id) &&
          (where.OR ?? []).some(
            (option) => option.organisationId === row.organisationId,
          ),
      ),
  );
  (prismaMock.appointment.findMany as any).mockImplementation(
    async ({ where }: FindManyArgs) =>
      ORG_APPOINTMENTS.filter(
        (row) =>
          where.id.in.includes(row.id) &&
          row.organisationId === where.organisationId,
      ),
  );
};

describe("ObservationToolSubmissionService", () => {
  const toolId = newId();
  const taskId = newId();
  const companionId = newId();
  const userId = newId();
  const submissionId = newId();
  const appointmentId = newId();
  const organisationId = newId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. Creation Logic
  // ======================================================================
  describe("createSubmission", () => {
    const validBaseInput = {
      toolId,
      patientId: companionId,
      filledBy: userId,
      answers: { q1: "yes" },
    };

    it("should throw if required fields are missing", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createSubmission({} as any),
      ).rejects.toThrow("toolId is required");

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createSubmission({ toolId } as any),
      ).rejects.toThrow("patientId is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          patientId: companionId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("filledBy is required");

      await expect(
        ObservationToolSubmissionService.createSubmission({
          toolId,
          patientId: companionId,
          filledBy: userId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow("answers are required");
    });

    it("throws when the tool is missing or inactive", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        null,
      );

      await expect(
        ObservationToolSubmissionService.createSubmission(validBaseInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("uses prisma to create the submission", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      const res =
        await ObservationToolSubmissionService.createSubmission(validBaseInput);

      expect(prisma.observationToolSubmission.create).toHaveBeenCalled();
      expect(res).toEqual({ id: submissionId });
    });

    it("validates task constraints", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        { id: toolId, isActive: true, fields: [] },
      );

      (prismaMock.task.findFirst as any).mockResolvedValueOnce(null);
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Task not found");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: "other",
        patientId: companionId,
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Not allowed to submit this task");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: userId,
        patientId: companionId,
        observationToolId: "other-tool",
      });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("toolId does not match task observationToolId");

      (prismaMock.task.findFirst as any).mockResolvedValueOnce({
        id: taskId,
        assignedTo: userId,
        patientId: companionId,
        observationToolId: toolId,
      });
      (
        prismaMock.observationToolSubmission.findFirst as any
      ).mockResolvedValueOnce({ id: submissionId });
      await expect(
        ObservationToolSubmissionService.createSubmission({
          ...validBaseInput,
          taskId,
        }),
      ).rejects.toThrow("Observation already submitted for this task");
      expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
    });

    it("answers a task of another companion like a missing task, before any other check", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        { id: toolId, isActive: true, fields: [] },
      );
      (prismaMock.task.findFirst as any).mockResolvedValue({
        id: taskId,
        assignedTo: "someone-else",
        patientId: "another-companion",
        observationToolId: "another-tool",
      });
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: "existing" },
      );

      const error = await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        taskId,
      }).catch((e: unknown) => e);

      expect(error).toMatchObject({
        message: "Task not found",
        statusCode: 404,
      });
      expect(prisma.observationToolSubmission.findFirst).not.toHaveBeenCalled();
      expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
      expect(TaskService.changeStatus).not.toHaveBeenCalled();
    });

    it("creates submission and completes the linked task", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [
            { key: "q1", scoring: { points: 2 } },
            { key: "q2", scoring: { map: { yes: 3 } } },
          ],
        },
      );
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        null,
      );
      (prismaMock.task.findFirst as any).mockResolvedValue({
        id: taskId,
        assignedTo: userId,
        patientId: companionId,
        observationToolId: toolId,
      });
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      const res = await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        taskId,
        answers: { q1: "yes", q2: "yes" }, // q1 (2) + q2 (3) = 5
      });

      expect(res).toEqual({ id: submissionId });
      expect(TaskService.changeStatus).toHaveBeenCalledWith(
        taskId,
        "COMPLETED",
        userId,
        expect.objectContaining({ score: 5 }),
      );
    });

    it("passes an undefined score when no scoring fields match", async () => {
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [{ key: "q1", scoring: { points: 10 } }],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
      });

      await ObservationToolSubmissionService.createSubmission({
        ...validBaseInput,
        answers: { q1: "" }, // empty string => no points
      });

      expect(prisma.observationToolSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ score: undefined }),
        }),
      );
    });
  });

  // ======================================================================
  // 2. Linking Logic
  // ======================================================================
  describe("linkToAppointment", () => {
    const orgA = "org-a";
    const orgB = "org-b";
    const submission = {
      id: submissionId,
      patientId: companionId,
      taskId: null as string | null,
    };
    // Raised from one of org-a's tasks, so org-a may place it.
    const pmsSubmission = { ...submission, taskId: "task-org-a" };
    const appointmentOf = (patientId: string, orgId = orgA) => ({
      organisationId: orgId,
      patient: { id: patientId },
    });

    const expectNotFound = async (
      input: Parameters<
        typeof ObservationToolSubmissionService.linkToAppointment
      >[0],
      message: string,
    ) => {
      const error = await ObservationToolSubmissionService.linkToAppointment(
        input,
      ).catch((e: unknown) => e);
      expect(error).toMatchObject({ message, statusCode: 404 });
      expect(prisma.observationToolSubmission.update).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      (prismaMock.observationToolSubmission.update as any).mockResolvedValue({
        id: submissionId,
        evaluationAppointmentId: appointmentId,
      });
      useOrganisationTables();
      (prismaMock.task.findFirst as any).mockImplementation(
        storedRows(ORG_TASKS).findFirst,
      );
    });

    afterEach(() => {
      (prismaMock.task.findFirst as any).mockReset();
      (prismaMock.task.findMany as any).mockReset();
      (prismaMock.appointment.findMany as any).mockReset();
    });

    it("throws when submission not found", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        null,
      );

      await expectNotFound(
        { organisationId: null, submissionId, appointmentId },
        "Submission not found",
      );
    });

    it("throws when the appointment is already linked", async () => {
      (prismaMock.observationToolSubmission.findFirst as any)
        .mockResolvedValueOnce(submission)
        .mockResolvedValueOnce({ id: "other" });
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId),
      );

      await expect(
        ObservationToolSubmissionService.linkToAppointment({
          organisationId: null,
          submissionId,
          appointmentId,
          enforceSingleSubmissionPerAppointment: true,
        }),
      ).rejects.toThrow(
        "An observation submission is already linked to this appointment",
      );
    });

    it("links the submission to an appointment of its companion at the caller's organisation", async () => {
      (prismaMock.observationToolSubmission.findFirst as any)
        .mockResolvedValueOnce(pmsSubmission)
        .mockResolvedValueOnce(null);
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId),
      );

      const res = await ObservationToolSubmissionService.linkToAppointment({
        organisationId: orgA,
        submissionId,
        appointmentId,
        enforceSingleSubmissionPerAppointment: true,
      });

      expect(res).toEqual({
        id: submissionId,
        evaluationAppointmentId: appointmentId,
      });
      expect(prisma.patientOrganisation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: companionId,
            organisationId: orgA,
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("returns 404 for a submission whose companion is not at the caller's organisation", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        submission,
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue(null);
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId),
      );

      await expectNotFound(
        { organisationId: orgA, submissionId, appointmentId },
        "Submission not found",
      );
    });

    it("returns 404 for an appointment of another organisation on a PMS link", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        pmsSubmission,
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId, orgB),
      );

      await expectNotFound(
        { organisationId: orgA, submissionId, appointmentId },
        "Appointment not found",
      );
    });

    it.each([null, orgA])(
      "returns 404 for an appointment of another companion (organisation %s)",
      async (organisationId) => {
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue(pmsSubmission);
        (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
          id: "co1",
        });
        (prismaMock.appointment.findFirst as any).mockResolvedValue(
          appointmentOf("another-companion"),
        );

        await expectNotFound(
          { organisationId, submissionId, appointmentId },
          "Appointment not found",
        );
      },
    );

    it("returns 404 for an appointment that does not exist", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        submission,
      );
      (prismaMock.appointment.findFirst as any).mockResolvedValue(null);

      await expectNotFound(
        { organisationId: null, submissionId, appointmentId },
        "Appointment not found",
      );
    });

    it("returns 404 for an appointment at another organisation than the submission's task", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { ...submission, taskId },
      );
      (prismaMock.task.findFirst as any).mockResolvedValue({
        organisationId: orgA,
      });
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId, orgB),
      );

      await expectNotFound(
        { organisationId: null, submissionId, appointmentId },
        "Appointment not found",
      );
      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: taskId } }),
      );
    });

    it("links a parent's submission to their companion's appointment at the task's organisation", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { ...submission, taskId },
      );
      (prismaMock.task.findFirst as any).mockResolvedValue({
        organisationId: orgA,
      });
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId, orgA),
      );

      await ObservationToolSubmissionService.linkToAppointment({
        organisationId: null,
        submissionId,
        appointmentId,
      });

      expect(prisma.patientOrganisation.findFirst).not.toHaveBeenCalled();
      expect(prisma.observationToolSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { evaluationAppointmentId: appointmentId },
      });
    });

    describe("a submission the organisation cannot read", () => {
      beforeEach(() => {
        useOrganisationTables();
        (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
          id: "co1",
        });
      });

      afterEach(() => {
        (prismaMock.task.findMany as any).mockReset();
        (prismaMock.appointment.findMany as any).mockReset();
        (prismaMock.appointment.findFirst as any).mockReset();
      });

      it.each([
        ["linked to another organisation's appointment", null, "appt-org-b"],
        [
          "of a parent task linked to another organisation's appointment",
          "task-parent",
          "appt-org-b",
        ],
        ["of another organisation's task", "task-org-b", null],
        ["of a task that does not exist", "no-such-task", null],
      ])(
        "answers a submission %s like a missing one on a PMS link",
        async (_label, linkedTaskId, evaluationAppointmentId) => {
          (
            prismaMock.observationToolSubmission.findFirst as any
          ).mockResolvedValue({
            ...submission,
            taskId: linkedTaskId,
            evaluationAppointmentId,
          });
          (prismaMock.appointment.findFirst as any).mockResolvedValue(
            appointmentOf(companionId, orgA),
          );

          await expectNotFound(
            { organisationId: orgA, submissionId, appointmentId },
            "Submission not found",
          );
        },
      );

      it("links a parent task's submission at the caller's organisation", async () => {
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({
          ...submission,
          taskId: "task-parent",
          evaluationAppointmentId: "appt-org-a",
        });
        (prismaMock.task.findFirst as any).mockResolvedValue({
          organisationId: null,
        });
        (prismaMock.appointment.findFirst as any).mockResolvedValue(
          appointmentOf(companionId, orgA),
        );

        await ObservationToolSubmissionService.linkToAppointment({
          organisationId: orgA,
          submissionId,
          appointmentId,
        });

        expect(prisma.observationToolSubmission.update).toHaveBeenCalledWith({
          where: { id: submissionId },
          data: { evaluationAppointmentId: appointmentId },
        });
      });

      it("checks the organisation of the appointment the submission is on before moving it", async () => {
        // Checked on its own: with the read check satisfied, a current
        // appointment at another organisation than the target still refuses.
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({
          ...submission,
          evaluationAppointmentId: "appt-org-a",
        });
        (prismaMock.appointment.findFirst as any).mockImplementation(
          async ({ where }: { where: { id: string } }) =>
            where.id === appointmentId
              ? appointmentOf(companionId, orgA)
              : { organisationId: orgB },
        );

        await expectNotFound(
          { organisationId: orgA, submissionId, appointmentId },
          "Appointment not found",
        );
        expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
          where: { id: "appt-org-a" },
          select: { organisationId: true },
        });
      });
    });

    describe("a parent's submission that no practice has yet", () => {
      // The companion is ACTIVE at org-a and at org-b, so both can read the
      // submission. Linking it to one practice's appointment takes it away
      // from the other, and that is the parent's call.
      beforeEach(() => {
        (prismaMock.patientOrganisation.findFirst as any).mockImplementation(
          storedRows([
            { patientId: companionId, organisationId: orgA, status: "ACTIVE" },
            { patientId: companionId, organisationId: orgB, status: "ACTIVE" },
          ]).findFirst,
        );
        (prismaMock.appointment.findFirst as any).mockResolvedValue(
          appointmentOf(companionId, orgA),
        );
      });

      afterEach(() => {
        (prismaMock.patientOrganisation.findFirst as any).mockReset();
      });

      it.each([
        ["with no task", null],
        ["of the parent's own task", "task-parent"],
      ])(
        "answers a submission %s like a missing one on a PMS link",
        async (_label, linkedTaskId) => {
          (
            prismaMock.observationToolSubmission.findFirst as any
          ).mockResolvedValue({
            ...submission,
            taskId: linkedTaskId,
            evaluationAppointmentId: null,
          });

          await expectNotFound(
            { organisationId: orgA, submissionId, appointmentId },
            "Submission not found",
          );
        },
      );

      it("lets the pet parent link it", async () => {
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({ ...submission, evaluationAppointmentId: null });

        await ObservationToolSubmissionService.linkToAppointment({
          organisationId: null,
          submissionId,
          appointmentId,
        });

        expect(prisma.observationToolSubmission.update).toHaveBeenCalledWith({
          where: { id: submissionId },
          data: { evaluationAppointmentId: appointmentId },
        });
      });

      it("lets the practice whose task it answers link it", async () => {
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({
          ...pmsSubmission,
          evaluationAppointmentId: null,
        });

        await ObservationToolSubmissionService.linkToAppointment({
          organisationId: orgA,
          submissionId,
          appointmentId,
        });

        expect(prisma.task.findFirst).toHaveBeenCalledWith({
          where: { id: "task-org-a", organisationId: orgA },
          select: { id: true },
        });
        expect(prisma.observationToolSubmission.update).toHaveBeenCalledWith({
          where: { id: submissionId },
          data: { evaluationAppointmentId: appointmentId },
        });
      });
    });

    it("does not move a submission that is on another appointment for a pet parent", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { ...submission, evaluationAppointmentId: "appt-earlier" },
      );
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId, orgA),
      );

      await expectNotFound(
        { organisationId: null, submissionId, appointmentId },
        "Submission not found",
      );
    });

    it("repeats a pet parent's current link", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { ...submission, evaluationAppointmentId: appointmentId },
      );
      (prismaMock.appointment.findFirst as any).mockResolvedValue(
        appointmentOf(companionId, orgA),
      );

      await ObservationToolSubmissionService.linkToAppointment({
        organisationId: null,
        submissionId,
        appointmentId,
      });

      expect(prisma.observationToolSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { evaluationAppointmentId: appointmentId },
      });
    });

    it.each(["", "  "])(
      "rejects a blank organisation (%j) instead of treating it as a parent link",
      async (blank) => {
        await expect(
          ObservationToolSubmissionService.linkToAppointment({
            organisationId: blank,
            submissionId,
            appointmentId,
          }),
        ).rejects.toThrow("Invalid organisationId");
        expect(
          prisma.observationToolSubmission.findFirst,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("createForAppointment", () => {
    const validInput = {
      appointmentId,
      organisationId,
      toolId,
      patientId: companionId,
      filledBy: userId,
      answers: { q1: "yes" },
    };

    it("throws when required fields are missing", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.createForAppointment({} as any),
      ).rejects.toThrow("toolId is required");
    });

    it("throws Forbidden when appointment is not in the organisation", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue(null);

      await expect(
        ObservationToolSubmissionService.createForAppointment(validInput),
      ).rejects.toThrow("Forbidden");
    });

    it("throws when the tool is not found or inactive", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
        patient: { id: companionId },
      });
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        { id: toolId, isActive: false },
      );

      await expect(
        ObservationToolSubmissionService.createForAppointment(validInput),
      ).rejects.toThrow("Observation tool not found or inactive");
    });

    it("creates and links the submission to the appointment", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        id: appointmentId,
        patient: { id: companionId },
      });
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });
      (prismaMock.observationToolDefinition.findFirst as any).mockResolvedValue(
        {
          id: toolId,
          isActive: true,
          fields: [{ key: "q1", scoring: { points: 3 } }],
        },
      );
      (prismaMock.observationToolSubmission.create as any).mockResolvedValue({
        id: submissionId,
        score: 3,
        evaluationAppointmentId: appointmentId,
      });

      const res =
        await ObservationToolSubmissionService.createForAppointment(validInput);

      expect(prisma.observationToolSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evaluationAppointmentId: appointmentId,
            score: 3,
          }),
        }),
      );
      // returns the created object, never an array
      expect(Array.isArray(res)).toBe(false);
      expect(res).toEqual(
        expect.objectContaining({ evaluationAppointmentId: appointmentId }),
      );
    });

    describe("rejects spoofed identifiers", () => {
      const otherCompanionId = newId();
      const spoofTaskId = newId();

      const mockAppointmentAndCompanion = () => {
        (prismaMock.appointment.findFirst as any).mockResolvedValue({
          id: appointmentId,
          patient: { id: companionId },
        });
        (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
          id: "link1",
        });
      };

      it("rejects a companion that is not the appointment's patient", async () => {
        mockAppointmentAndCompanion();

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            patientId: otherCompanionId,
          }),
        ).rejects.toThrow("patientId does not match appointment");

        expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
      });

      it("rejects a taskId owned by another organisation", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId: newId(),
          appointmentId,
          patientId: companionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toMatchObject({ message: "Task not found", statusCode: 404 });

        expect(prisma.observationToolSubmission.create).not.toHaveBeenCalled();
      });

      it("rejects a taskId belonging to another appointment", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId: newId(),
          patientId: companionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("taskId does not match appointment");
      });

      it("rejects a taskId belonging to another patient", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId,
          patientId: otherCompanionId,
          observationToolId: toolId,
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("patientId does not match task");
      });

      it("rejects a taskId raised for a different observation tool", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: spoofTaskId,
          organisationId,
          appointmentId,
          patientId: companionId,
          observationToolId: newId(),
        });

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("toolId does not match task observationToolId");
      });

      it("rejects a taskId that does not exist", async () => {
        mockAppointmentAndCompanion();
        (prismaMock.task.findFirst as any).mockResolvedValue(null);

        await expect(
          ObservationToolSubmissionService.createForAppointment({
            ...validInput,
            taskId: spoofTaskId,
          }),
        ).rejects.toThrow("Task not found");
      });
    });
  });

  // ======================================================================
  // 3. Retrieval & Listing
  // ======================================================================
  describe("Retrieval Methods", () => {
    it("getById returns a submission for a companion of the organisation", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId, patientId: companionId },
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });

      const res = await ObservationToolSubmissionService.getById(
        submissionId,
        organisationId,
      );

      expect(res).toEqual({ id: submissionId, patientId: companionId });
      expect(prisma.patientOrganisation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: companionId,
            organisationId,
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("getById returns null for another organisation's submission, as for a missing one", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId, patientId: companionId },
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue(null);

      await expect(
        ObservationToolSubmissionService.getById(submissionId, organisationId),
      ).resolves.toBeNull();

      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        null,
      );
      await expect(
        ObservationToolSubmissionService.getById(submissionId, organisationId),
      ).resolves.toBeNull();
    });

    it("getById requires an organisation", async () => {
      await expect(
        ObservationToolSubmissionService.getById(
          submissionId,
          undefined as unknown as string,
        ),
      ).rejects.toThrow("organisationId must be a string");
      expect(prisma.observationToolSubmission.findFirst).not.toHaveBeenCalled();
    });

    it("listSubmissions refuses a companion that is not at the organisation", async () => {
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue(null);

      await expect(
        ObservationToolSubmissionService.listSubmissions({
          organisationId: "org1",
          patientId: "another-orgs-companion",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.observationToolSubmission.findMany).not.toHaveBeenCalled();
    });

    it("listSubmissions requires an organisation", async () => {
      await expect(
        ObservationToolSubmissionService.listSubmissions({
          organisationId: "",
        }),
      ).rejects.toThrow("Invalid organisationId");
      expect(prisma.observationToolSubmission.findMany).not.toHaveBeenCalled();
    });

    it("listSubmissions scopes by organisation when no companion filter is provided", async () => {
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);
      (prismaMock.patientOrganisation.findMany as any).mockResolvedValue([
        { patientId: companionId },
      ]);

      const res = await ObservationToolSubmissionService.listSubmissions({
        organisationId: "org1",
      });

      expect(prisma.patientOrganisation.findMany).toHaveBeenCalled();
      expect(res).toEqual([{ id: submissionId }]);
    });

    it("listSubmissions builds a date range and validates the companion", async () => {
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-02");
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue(
        [],
      );
      (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
        id: "co1",
      });

      await ObservationToolSubmissionService.listSubmissions({
        organisationId: "org1",
        patientId: companionId,
        toolId,
        fromDate: from,
        toDate: to,
      });

      expect(prisma.patientOrganisation.findFirst).toHaveBeenCalled();
      expect(prisma.observationToolSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: companionId,
            toolId,
            createdAt: { gte: from, lte: to },
          }),
        }),
      );
    });

    it("listForAppointment returns the appointment companion's submissions at the organisation", async () => {
      (prismaMock.observationToolSubmission.findMany as any).mockResolvedValue([
        { id: submissionId },
      ]);
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        patient: { id: companionId },
      });

      const res = await ObservationToolSubmissionService.listForAppointment(
        appointmentId,
        "org1",
      );

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: appointmentId, organisationId: "org1" },
        }),
      );
      expect(prisma.observationToolSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            evaluationAppointmentId: appointmentId,
            patientId: companionId,
          },
        }),
      );
      expect(res).toEqual([{ id: submissionId }]);
    });

    it("listForAppointment returns nothing for an appointment without a companion", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue({
        patient: null,
      });

      await expect(
        ObservationToolSubmissionService.listForAppointment(
          appointmentId,
          "org1",
        ),
      ).resolves.toEqual([]);
      expect(prisma.observationToolSubmission.findMany).not.toHaveBeenCalled();
    });

    it("listForAppointment refuses an appointment of another organisation", async () => {
      (prismaMock.appointment.findFirst as any).mockResolvedValue(null);

      await expect(
        ObservationToolSubmissionService.listForAppointment(
          appointmentId,
          "org1",
        ),
      ).rejects.toThrow("Forbidden");
      expect(prisma.observationToolSubmission.findMany).not.toHaveBeenCalled();
    });

    describe("rows the organisation cannot read", () => {
      // One submission per case, all for a companion of both organisations.
      const rows = [
        { id: "no-links", taskId: null, evaluationAppointmentId: null },
        { id: "own-task", taskId: "task-org-a", evaluationAppointmentId: null },
        {
          id: "parent-task",
          taskId: "task-parent",
          evaluationAppointmentId: null,
        },
        {
          id: "own-appointment",
          taskId: null,
          evaluationAppointmentId: "appt-org-a",
        },
        {
          id: "other-task",
          taskId: "task-org-b",
          evaluationAppointmentId: null,
        },
        {
          id: "other-appointment",
          taskId: null,
          evaluationAppointmentId: "appt-org-b",
        },
        {
          id: "parent-task-other-appointment",
          taskId: "task-parent",
          evaluationAppointmentId: "appt-org-b",
        },
        {
          id: "missing-task",
          taskId: "no-such-task",
          evaluationAppointmentId: null,
        },
        {
          id: "missing-appointment",
          taskId: null,
          evaluationAppointmentId: "no-such-appointment",
        },
      ].map((row) => ({ ...row, patientId: companionId }));
      const readable = [
        "no-links",
        "own-task",
        "parent-task",
        "own-appointment",
      ];

      beforeEach(() => {
        useOrganisationTables();
        (prismaMock.patientOrganisation.findFirst as any).mockResolvedValue({
          id: "co1",
        });
        (prismaMock.patientOrganisation.findMany as any).mockResolvedValue([
          { patientId: companionId },
        ]);
      });

      afterEach(() => {
        (prismaMock.task.findMany as any).mockReset();
        (prismaMock.appointment.findMany as any).mockReset();
      });

      it("listSubmissions leaves out another organisation's task or appointment", async () => {
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue(rows);

        const res = await ObservationToolSubmissionService.listSubmissions({
          organisationId: "org-a",
        });

        expect(res.map((row: any) => row.id)).toEqual(readable);
      });

      it("listSubmissions for one companion applies the same rule", async () => {
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue(rows);

        const res = await ObservationToolSubmissionService.listSubmissions({
          organisationId: "org-a",
          patientId: companionId,
        });

        expect(res.map((row: any) => row.id)).toEqual(readable);
      });

      it("listSubmissions reads no tasks or appointments for rows without links", async () => {
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue([rows[0]]);

        await ObservationToolSubmissionService.listSubmissions({
          organisationId: "org-a",
        });

        expect(prisma.task.findMany).not.toHaveBeenCalled();
        expect(prisma.appointment.findMany).not.toHaveBeenCalled();
      });

      it.each(rows.map((row) => [row.id, readable.includes(row.id)] as const))(
        "getById for %s returns the row only when the organisation can read it (%s)",
        async (id, visible) => {
          const row = rows.find((candidate) => candidate.id === id);
          (
            prismaMock.observationToolSubmission.findFirst as any
          ).mockResolvedValue(row);

          await expect(
            ObservationToolSubmissionService.getById(id, "org-a"),
          ).resolves.toEqual(visible ? row : null);
        },
      );

      it("listForAppointment leaves out a submission of another organisation's task", async () => {
        (prismaMock.appointment.findFirst as any).mockResolvedValue({
          patient: { id: companionId },
        });
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue([
          {
            id: "own",
            taskId: "task-org-a",
            evaluationAppointmentId: "appt-org-a",
          },
          {
            id: "other-task",
            taskId: "task-org-b",
            evaluationAppointmentId: "appt-org-a",
          },
        ]);

        const res = await ObservationToolSubmissionService.listForAppointment(
          "appt-org-a",
          "org-a",
        );

        expect(res.map((row: any) => row.id)).toEqual(["own"]);
      });
    });

    it("getByTaskId queries by taskId", async () => {
      (prismaMock.observationToolSubmission.findFirst as any).mockResolvedValue(
        { id: submissionId },
      );

      const res = await ObservationToolSubmissionService.getByTaskId(taskId);
      expect(prisma.observationToolSubmission.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskId } }),
      );
      expect(res).toEqual({ id: submissionId });
    });
  });

  // ======================================================================
  // 4. Previews & Complex Aggregation
  // ======================================================================
  describe("Previews", () => {
    describe("getPreviewByTaskId", () => {
      it("should throw if task or tool missing", async () => {
        // Task missing
        (prismaMock.task.findFirst as any).mockResolvedValueOnce(null);
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task not found");

        // Task has no observationToolId
        (prismaMock.task.findFirst as any).mockResolvedValueOnce({
          id: taskId,
        });
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Task has no observationToolId");

        // Tool missing
        (prismaMock.task.findFirst as any).mockResolvedValueOnce({
          id: taskId,
          observationToolId: toolId,
        });
        (
          prismaMock.observationToolDefinition.findFirst as any
        ).mockResolvedValueOnce(null);
        await expect(
          ObservationToolSubmissionService.getPreviewByTaskId(taskId),
        ).rejects.toThrow("Observation tool not found or inactive");
      });

      it("returns preview data with an answers subset", async () => {
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: taskId,
          observationToolId: toolId,
        });
        (
          prismaMock.observationToolDefinition.findFirst as any
        ).mockResolvedValue({
          id: toolId,
          name: "Tool",
          category: "Cat",
          isActive: true,
          fields: [{ key: "q1" }, { key: "q2" }],
        });
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockResolvedValue({
          id: submissionId,
          taskId,
          answers: { q1: "ans1" },
          createdAt: new Date(),
          score: 3,
          summary: "ok",
        });

        const res =
          await ObservationToolSubmissionService.getPreviewByTaskId(taskId);

        expect(res.taskId).toBe(taskId);
        expect(res.toolName).toBe("Tool");
        expect(res.answersPreview).toEqual({ q1: "ans1" });
      });

      it("breaks a tie on createdAt by id, the row the access check judged", async () => {
        const at = new Date("2026-09-27T10:00:00.000Z");
        (prismaMock.task.findFirst as any).mockResolvedValue({
          id: taskId,
          observationToolId: toolId,
        });
        (
          prismaMock.observationToolDefinition.findFirst as any
        ).mockResolvedValue({
          id: toolId,
          name: "Tool",
          category: "Cat",
          isActive: true,
          fields: [{ key: "q1" }],
        });
        (
          prismaMock.observationToolSubmission.findFirst as any
        ).mockImplementation(
          storedRows([
            { id: "sub-1", taskId, createdAt: at, answers: { q1: "a" } },
            { id: "sub-2", taskId, createdAt: at, answers: { q1: "b" } },
          ]).findFirst,
        );

        const res =
          await ObservationToolSubmissionService.getPreviewByTaskId(taskId);

        expect(res.submissionId).toBe("sub-2");
        expect(res.answersPreview).toEqual({ q1: "b" });
      });
    });

    describe("listTaskPreviewsForAppointment", () => {
      beforeEach(() => {
        (prismaMock.appointment.findFirst as any).mockResolvedValue({
          patient: { id: "comp-1" },
        });
      });

      it("reads only the organisation's and the parent's tasks for the appointment's companion", async () => {
        (prismaMock.task.findMany as any).mockResolvedValue([]);

        await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
          appointmentId,
          "org1",
        );

        expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: appointmentId, organisationId: "org1" },
          }),
        );
        expect(prisma.task.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              appointmentId,
              observationToolId: { not: null },
              patientId: "comp-1",
              OR: [{ organisationId: "org1" }, { organisationId: null }],
            },
          }),
        );
      });

      it("returns nothing for an appointment without a companion", async () => {
        (prismaMock.appointment.findFirst as any).mockResolvedValue({
          patient: {},
        });

        await expect(
          ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
            "org1",
          ),
        ).resolves.toEqual([]);
        expect(prisma.task.findMany).not.toHaveBeenCalled();
      });

      it("aggregates tasks, tools, and submissions", async () => {
        (prismaMock.task.findMany as any).mockResolvedValue([
          {
            id: "task-1",
            patientId: "comp-1",
            status: "PENDING",
            dueAt: new Date(),
            observationToolId: toolId,
          },
        ]);
        (
          prismaMock.observationToolDefinition.findMany as any
        ).mockResolvedValue([
          { id: toolId, name: "Tool", category: "Cat", isActive: true },
        ]);
        (
          prismaMock.observationToolSubmission.findMany as any
        ).mockResolvedValue([
          {
            id: submissionId,
            taskId: "task-1",
            toolId,
            score: 5,
            summary: "ok",
            createdAt: new Date(),
            evaluationAppointmentId: appointmentId,
          },
        ]);

        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
            "org1",
          );

        expect(res).toHaveLength(1);
        expect(res[0].taskId).toBe("task-1");
      });

      it("returns empty when no tasks", async () => {
        (prismaMock.task.findMany as any).mockResolvedValue([]);

        const res =
          await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
            appointmentId,
            "org1",
          );
        expect(res).toEqual([]);
      });
    });
  });

  // ======================================================================
  // 5. Utils Coverage (assertObjectId)
  // ======================================================================
  describe("Utils", () => {
    it("assertObjectId should throw on non-string input", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ObservationToolSubmissionService.getById(123 as any, organisationId),
      ).rejects.toThrow("must be a string");
    });
  });
});
