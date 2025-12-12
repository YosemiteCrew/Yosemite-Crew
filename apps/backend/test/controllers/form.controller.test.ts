import { FormController } from "src/controllers/web/form.controller";
import { FormService, FormServiceError } from "src/services/form.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

jest.mock("src/services/form.service", () => {
  const actual = jest.requireActual("src/services/form.service");
  return {
    ...actual,
    FormService: {
      create: jest.fn(),
      getFormForAdmin: jest.fn(),
      getFormForUser: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      archive: jest.fn(),
      submitFHIR: jest.fn(),
      getSubmission: jest.fn(),
      listSubmissions: jest.fn(),
    },
  };
});

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

const mockedService = FormService as unknown as {
  create: jest.Mock;
  getFormForAdmin: jest.Mock;
  getFormForUser: jest.Mock;
  update: jest.Mock;
  publish: jest.Mock;
  unpublish: jest.Mock;
  archive: jest.Mock;
  submitFHIR: jest.Mock;
  getSubmission: jest.Mock;
  listSubmissions: jest.Mock;
};

const mockedAuthUser = AuthUserMobileService as unknown as {
  getByProviderUserId: jest.Mock;
};

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("FormController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createForm", () => {
    it("requires a user id", async () => {
      const res = mockResponse();

      await FormController.createForm(
        { params: { orgId: "org" }, body: {}, headers: {} } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized: User ID missing",
      });
    });

    it("creates a form", async () => {
      const res = mockResponse();
      mockedService.create.mockResolvedValueOnce({ id: "f1" });

      await FormController.createForm(
        {
          params: { orgId: "org-1" },
          headers: { "x-user-id": "user-1" },
          body: { name: "Form" },
        } as any,
        res as any,
      );

      expect(mockedService.create).toHaveBeenCalledWith(
        "org-1",
        { name: "Form" },
        "user-1",
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "f1" });
    });

    it("maps service errors", async () => {
      const res = mockResponse();
      mockedService.create.mockRejectedValueOnce(
        new FormServiceError("bad", 422),
      );

      await FormController.createForm(
        {
          params: { orgId: "org-1" },
          headers: { "x-user-id": "user-1" },
          body: {},
        } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ message: "bad" });
    });
  });

  describe("getFormForAdmin", () => {
    it("returns form", async () => {
      const res = mockResponse();
      mockedService.getFormForAdmin.mockResolvedValueOnce({ id: "f1" });

      await FormController.getFormForAdmin(
        { params: { orgId: "org-1", formId: "form-1" } } as any,
        res as any,
      );

      expect(mockedService.getFormForAdmin).toHaveBeenCalledWith(
        "org-1",
        "form-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1" });
    });

    it("handles known errors", async () => {
      const res = mockResponse();
      mockedService.getFormForAdmin.mockRejectedValueOnce(
        new FormServiceError("missing", 404),
      );

      await FormController.getFormForAdmin(
        { params: { orgId: "org-1", formId: "form-1" } } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "missing" });
    });
  });

  describe("getFormForClient", () => {
    it("returns form", async () => {
      const res = mockResponse();
      mockedService.getFormForUser.mockResolvedValueOnce({ id: "f1" });

      await FormController.getFormForClient(
        { params: { formId: "form-1" } } as any,
        res as any,
      );

      expect(mockedService.getFormForUser).toHaveBeenCalledWith("form-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1" });
    });
  });

  describe("updateForm", () => {
    it("requires authentication", async () => {
      const res = mockResponse();

      await FormController.updateForm(
        {
          params: { formId: "form-1", orgId: "org-1" },
          body: {},
          headers: {},
        } as any,
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized: User ID missing",
      });
    });

    it("updates form when authenticated", async () => {
      const res = mockResponse();
      mockedService.update.mockResolvedValueOnce({ id: "f1" });

      await FormController.updateForm(
        {
          params: { formId: "form-1", orgId: "org-1" },
          body: {},
          userId: "user-1",
          headers: {},
        } as any,
        res as any,
      );

      expect(mockedService.update).toHaveBeenCalledWith(
        "form-1",
        {},
        "user-1",
        "org-1",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1" });
    });
  });

  describe("publish/unpublish/archive", () => {
    it("publishes a form", async () => {
      const res = mockResponse();
      mockedService.publish.mockResolvedValueOnce({ formId: "f1", version: 1 });

      await FormController.publishForm(
        { params: { formId: "f1" }, userId: "u1", headers: {} } as any,
        res as any,
      );

      expect(mockedService.publish).toHaveBeenCalledWith("f1", "u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ formId: "f1", version: 1 });
    });

    it("unpublishes a form", async () => {
      const res = mockResponse();
      mockedService.unpublish.mockResolvedValueOnce({
        id: "f1",
        status: "draft",
      });

      await FormController.unpublishForm(
        { params: { formId: "f1" }, userId: "u1", headers: {} } as any,
        res as any,
      );

      expect(mockedService.unpublish).toHaveBeenCalledWith("f1", "u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1", status: "draft" });
    });

    it("archives a form", async () => {
      const res = mockResponse();
      mockedService.archive.mockResolvedValueOnce({
        id: "f1",
        status: "archived",
      });

      await FormController.archiveForm(
        { params: { formId: "f1" }, userId: "u1", headers: {} } as any,
        res as any,
      );

      expect(mockedService.archive).toHaveBeenCalledWith("f1", "u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "f1", status: "archived" });
    });
  });

  describe("submitForm", () => {
    it("rejects missing auth user", async () => {
      const res = mockResponse();
      mockedAuthUser.getByProviderUserId.mockResolvedValueOnce(null);

      await FormController.submitForm(
        { headers: { "x-user-id": "u1" }, body: {} } as any,
        res as any,
      );

      expect(mockedAuthUser.getByProviderUserId).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized: User not found",
      });
    });

    it("submits form when auth user exists", async () => {
      const res = mockResponse();
      mockedAuthUser.getByProviderUserId.mockResolvedValueOnce({
        id: "auth-1",
      });
      mockedService.submitFHIR.mockResolvedValueOnce({ id: "sub-1" });

      await FormController.submitForm(
        { headers: { "x-user-id": "u1" }, body: { formId: "f1" } } as any,
        res as any,
      );

      expect(mockedService.submitFHIR).toHaveBeenCalledWith({ formId: "f1" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: "sub-1" });
    });
  });

  describe("submissions", () => {
    it("gets a submission", async () => {
      const res = mockResponse();
      mockedService.getSubmission.mockResolvedValueOnce({ id: "s1" });

      await FormController.getFormSubmissions(
        { params: { formId: "f1" } } as any,
        res as any,
      );

      expect(mockedService.getSubmission).toHaveBeenCalledWith("f1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: "s1" });
    });

    it("lists submissions", async () => {
      const res = mockResponse();
      mockedService.listSubmissions.mockResolvedValueOnce([{ id: "s1" }]);

      await FormController.listFormSubmissions(
        { params: { formId: "f1" } } as any,
        res as any,
      );

      expect(mockedService.listSubmissions).toHaveBeenCalledWith("f1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: "s1" }]);
    });
  });
});
