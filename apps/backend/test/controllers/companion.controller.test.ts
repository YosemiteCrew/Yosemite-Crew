import { Types } from "mongoose"
import { CompanionController } from '../../src/controllers/app/companion.controller'
import { CompanionService, CompanionServiceError } from '../../src/services/companion.service'

jest.mock('../../src/services/companion.service', () => {
  const actual = jest.requireActual('../../src/services/companion.service')
  return {
    ...actual,
    CompanionService: {
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
})

const mockedCompanionService = CompanionService as unknown as {
  create: jest.Mock
  getById: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
  return res
}

const patientPayload = { resourceType: "Patient" }

describe("CompanionController", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createCompanionMobile", () => {
    it("requires auth", async () => {
      const req = { body: patientPayload } as any
      const res = createResponse()

      await CompanionController.createCompanionMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: "Authentication required for mobile companion creation." })
      expect(mockedCompanionService.create).not.toHaveBeenCalled()
    })

    it("creates companion when authenticated", async () => {
      const req = { body: patientPayload, userId: "user-1" } as any
      const res = createResponse()
      mockedCompanionService.create.mockResolvedValueOnce({ response: { id: "cmp-1" } })

      await CompanionController.createCompanionMobile(req, res as any)

      expect(mockedCompanionService.create).toHaveBeenCalledWith(patientPayload, { authUserId: "user-1" })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ id: "cmp-1" })
    })

    it("maps CompanionServiceError errors", async () => {
      const req = { body: patientPayload, userId: "user-1" } as any
      const res = createResponse()
      mockedCompanionService.create.mockRejectedValueOnce(new CompanionServiceError("bad", 422))

      await CompanionController.createCompanionMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith({ message: "bad" })
    })
  })

  describe("createCompanionPMS", () => {
    it("requires parentId", async () => {
      const req = { body: patientPayload } as any
      const res = createResponse()

      await CompanionController.createCompanionPMS(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Valid parentId is required to create companion through PMS." })
    })

    it("creates companion when parentId is valid", async () => {
      const parentId = new Types.ObjectId().toHexString()
      const req = { body: { payload: patientPayload, parentId } } as any
      const res = createResponse()
      mockedCompanionService.create.mockResolvedValueOnce({ response: { id: "cmp-2" } })

      await CompanionController.createCompanionPMS(req, res as any)

      expect(mockedCompanionService.create).toHaveBeenCalledWith(
        patientPayload,
        { parentMongoId: expect.any(Types.ObjectId) }
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ id: "cmp-2" })
    })

    it("maps CompanionServiceError errors", async () => {
      const parentId = new Types.ObjectId().toHexString()
      const req = { body: { payload: patientPayload, parentId } } as any
      const res = createResponse()
      mockedCompanionService.create.mockRejectedValueOnce(new CompanionServiceError("bad", 422))

      await CompanionController.createCompanionPMS(req, res as any)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith({ message: "bad" })
    })
  })

  describe("getCompanionById", () => {
    it("requires id", async () => {
      const req = { params: {} } as any
      const res = createResponse()

      await CompanionController.getCompanionById(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Companion ID is required." })
    })

    it("returns 404 when not found", async () => {
      const req = { params: { id: "cmp-1" } } as any
      const res = createResponse()
      mockedCompanionService.getById.mockResolvedValueOnce(null)

      await CompanionController.getCompanionById(req, res as any)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: "Companion not found." })
    })

    it("returns companion response", async () => {
      const req = { params: { id: "cmp-1" } } as any
      const res = createResponse()
      mockedCompanionService.getById.mockResolvedValueOnce({ response: { id: "cmp-1" } })

      await CompanionController.getCompanionById(req, res as any)

      expect(mockedCompanionService.getById).toHaveBeenCalledWith("cmp-1")
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ id: "cmp-1" })
    })
  })

  describe("updateCompanion", () => {
    it("requires id", async () => {
      const req = { params: {}, body: patientPayload } as any
      const res = createResponse()

      await CompanionController.updateCompanion(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Companion ID is required." })
    })

    it("updates companion", async () => {
      const req = { params: { id: "cmp-1" }, body: patientPayload } as any
      const res = createResponse()
      mockedCompanionService.update.mockResolvedValueOnce({ response: { id: "cmp-1", name: "Updated" } })

      await CompanionController.updateCompanion(req, res as any)

      expect(mockedCompanionService.update).toHaveBeenCalledWith("cmp-1", patientPayload)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ id: "cmp-1", name: "Updated" })
    })

    it("maps CompanionServiceError", async () => {
      const req = { params: { id: "cmp-1" }, body: patientPayload } as any
      const res = createResponse()
      mockedCompanionService.update.mockRejectedValueOnce(new CompanionServiceError("nope", 422))

      await CompanionController.updateCompanion(req, res as any)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith({ message: "nope" })
    })
  })

  describe("deleteCompanion", () => {
    it("requires id", async () => {
      const req = { params: {}, headers: {} } as any
      const res = createResponse()

      await CompanionController.deleteCompanion(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Companion ID is required." })
    })

    it("deletes companion", async () => {
      const req = { params: { id: "cmp-1" }, headers: { "x-user-id": "user-123" } } as any
      const res = createResponse()
      mockedCompanionService.delete.mockResolvedValueOnce(undefined)

      await CompanionController.deleteCompanion(req, res as any)

      expect(mockedCompanionService.delete).toHaveBeenCalledWith("cmp-1", {
        authUserId: "user-123",
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalled()
    })

    it("maps CompanionServiceError", async () => {
      const req = { params: { id: "cmp-1" }, headers: { "x-user-id": "user-123" } } as any
      const res = createResponse()
      mockedCompanionService.delete.mockRejectedValueOnce(new CompanionServiceError("boom", 403))

      await CompanionController.deleteCompanion(req, res as any)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({ message: "boom" })
    })
  })
})
