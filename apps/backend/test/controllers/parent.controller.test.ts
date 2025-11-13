import { ParentController } from '../../src/controllers/app/parent.controller'
import { ParentService, ParentServiceError } from '../../src/services/parent.service'

jest.mock('../../src/services/parent.service', () => {
  const actual = jest.requireActual('../../src/services/parent.service')
  return {
    ...actual,
    ParentService: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }
})

const mockedParentService = ParentService as unknown as {
  create: jest.Mock
  get: jest.Mock
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

const relatedPersonPayload = { resourceType: "RelatedPerson" }

describe("ParentController", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("createParentMobile", () => {
    it("requires auth", async () => {
      const req = { body: relatedPersonPayload } as any
      const res = createResponse()

      await ParentController.createParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" })
    })

    it("creates parent for authenticated user", async () => {
      const req = { userId: "user-1", body: relatedPersonPayload } as any
      const res = createResponse()
      mockedParentService.create.mockResolvedValueOnce({ response: { id: "p1" } })

      await ParentController.createParentMobile(req, res as any)

      expect(mockedParentService.create).toHaveBeenCalledWith(relatedPersonPayload, {
        source: "mobile",
        authUserId: "user-1",
      })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ id: "p1" })
    })

    it("maps ParentServiceError", async () => {
      const req = { userId: "user-1", body: relatedPersonPayload } as any
      const res = createResponse()
      mockedParentService.create.mockRejectedValueOnce(new ParentServiceError("boom", 400))

      await ParentController.createParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "boom" })
    })
  })

  describe("getParentMobile", () => {
    it("requires auth", async () => {
      const req = { params: { id: "p1" } } as any
      const res = createResponse()

      await ParentController.getParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" })
    })

    it("requires id", async () => {
      const req = { userId: "user-1", params: {} } as any
      const res = createResponse()

      await ParentController.getParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Parent ID is required." })
    })

    it("returns 404 when not found", async () => {
      const req = { userId: "user-1", params: { id: "p1" } } as any
      const res = createResponse()
      mockedParentService.get.mockResolvedValueOnce(null)

      await ParentController.getParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found." })
    })

    it("returns parent response", async () => {
      const req = { userId: "user-1", params: { id: "p1" } } as any
      const res = createResponse()
      mockedParentService.get.mockResolvedValueOnce({ response: { id: "p1" } })

      await ParentController.getParentMobile(req, res as any)

      expect(mockedParentService.get).toHaveBeenCalledWith("p1", {
        source: "mobile",
        authUserId: "user-1",
      })
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith({ id: "p1" })
    })
  })

  describe("deleteParentMobile", () => {
    it("requires auth", async () => {
      const req = { params: { id: "p1" } } as any
      const res = createResponse()

      await ParentController.deleteParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" })
    })

    it("requires id", async () => {
      const req = { userId: "user-1", params: {} } as any
      const res = createResponse()

      await ParentController.deleteParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "Parent ID is required." })
    })

    it("returns 404 when parent not found", async () => {
      const req = { userId: "user-1", params: { id: "p1" } } as any
      const res = createResponse()
      mockedParentService.delete.mockResolvedValueOnce(null)

      await ParentController.deleteParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found." })
    })

    it("deletes parent", async () => {
      const req = { userId: "user-1", params: { id: "p1" } } as any
      const res = createResponse()
      mockedParentService.delete.mockResolvedValueOnce({ id: "p1" })

      await ParentController.deleteParentMobile(req, res as any)

      expect(mockedParentService.delete).toHaveBeenCalledWith("p1", {
        source: "mobile",
        authUserId: "user-1",
      })
      expect(res.status).toHaveBeenCalledWith(204)
      expect(res.send).toHaveBeenCalled()
    })

    it("maps ParentServiceError", async () => {
      const req = { userId: "user-1", params: { id: "p1" } } as any
      const res = createResponse()
      mockedParentService.delete.mockRejectedValueOnce(new ParentServiceError("boom", 422))

      await ParentController.deleteParentMobile(req, res as any)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith({ message: "boom" })
    })
  })

  describe("createParentPMS", () => {
    it("creates parent without auth", async () => {
      const req = { body: relatedPersonPayload } as any
      const res = createResponse()
      mockedParentService.create.mockResolvedValueOnce({ response: { id: "p2" } })

      await ParentController.createParentPMS(req, res as any)

      expect(mockedParentService.create).toHaveBeenCalledWith(relatedPersonPayload, { source: "pms" })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith({ id: "p2" })
    })

    it("propagates ParentServiceError", async () => {
      const req = { body: relatedPersonPayload } as any
      const res = createResponse()
      mockedParentService.create.mockRejectedValueOnce(new ParentServiceError("nope", 400))

      await ParentController.createParentPMS(req, res as any)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ message: "nope" })
    })
  })
})
