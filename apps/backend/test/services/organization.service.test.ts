import { Types } from "mongoose";
import type { OrganizationDocument } from "../../src/models/organization";
import OrganizationModel from "../../src/models/organization";
import { OrganizationService } from "../../src/services/organization.service";
import { Organization } from "@yosemite-crew/types";

// --- Mock external dependencies before imports that depend on them ---
jest.mock("../../src/services/user-organization.service", () => ({
    UserOrganizationService: { deleteAllByOrganizationId: jest.fn() },
}));
jest.mock("../../src/services/speciality.service", () => ({
    SpecialityService: { deleteAllByOrganizationId: jest.fn() },
}));
jest.mock("../../src/services/organisation-room.service", () => ({
    OrganisationRoomService: { deleteAllByOrganizationId: jest.fn() },
}));

import { UserOrganizationService } from "../../src/services/user-organization.service";
import { SpecialityService } from "../../src/services/speciality.service";
import { OrganisationRoomService } from "../../src/services/organisation-room.service";

jest.mock("../../src/models/organization", () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        findOneAndUpdate: jest.fn(),
        findOneAndDelete: jest.fn(),
    },
}));

const mockedOrganizationModel = OrganizationModel as unknown as {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
};

// --- Helper to create mock documents ---
const createMockDoc = (overrides: Partial<Organization> = {}) => {
    const base = {
        _id: new Types.ObjectId(),
        name: "Test Clinic",
        type: "HOSPITAL" as Organization["type"],
        phoneNo: "123-456-7890",
        taxId: "TAX-001",
        address: {
            addressLine: "123 Test St",
            city: "Test City",
            state: "Test State",
            country: "Test Country",
            postalCode: "12345",
        },
        isVerified: true,
        isActive: true,
        healthAndSafetyCertNo: "HS-001",
        animalWelfareComplianceCertNo: "AW-001",
        fireAndEmergencyCertNo: "FE-001",
        ...overrides,
    };
    return {
        ...base,
        toObject(this: typeof base) {
            return {
                _id: this._id,
                name: this.name,
                type: this.type,
                phoneNo: this.phoneNo,
                taxId: this.taxId,
                address: this.address,
                isVerified: this.isVerified,
                isActive: this.isActive,
                healthAndSafetyCertNo: this.healthAndSafetyCertNo,
                animalWelfareComplianceCertNo: this.animalWelfareComplianceCertNo,
                fireAndEmergencyCertNo: this.fireAndEmergencyCertNo,
                DUNSNumber: this.DUNSNumber,
                website: this.website,
                imageURL: this.imageURL,
            };
        },
    } as unknown as OrganizationDocument;
};

describe("OrganizationService", () => {
    beforeEach(() => jest.resetAllMocks());

    const mockFHIROrganization = {
        resourceType: "Organization" as const,
        name: "Test Vet Clinic",
        phoneNo: "123-456-7890",
        identifier: [
            {
                system: "http://example.org/fhir/NamingSystem/organisation-tax-id",
                value: "TAX123",
            },
        ],
        type: [
            {
                coding: [
                    {
                        system: "http://example.org/organization-types",
                        code: "VET",
                        display: "Veterinary Business",
                    },
                ],
            },
        ],
        address: [
            {
                line: ["123 Test St"],
                city: "Test City",
                state: "Test State",
                country: "Test Country",
                postalCode: "12345",
            },
        ],
        telecom: [{ system: "phone" as const, value: "123-456-7890" }],
        extension: [
            {
                url: "http://example.org/fhir/StructureDefinition/taxId",
                valueString: "TAX123",
            },
            {
                url: "http://example.org/fhir/StructureDefinition/healthAndSafetyCertificationNumber",
                valueString: "HS-909",
            },
            {
                url: "http://example.org/fhir/StructureDefinition/animalWelfareComplianceCertificationNumber",
                valueString: "AW-909",
            },
            {
                url: "http://example.org/fhir/StructureDefinition/fireAndEmergencyCertificationNumber",
                valueString: "FE-909",
            },
        ],
    };

    // --- UPSERT TESTS ---
    describe("upsert", () => {
        it("creates a new organization when no existing document is found", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const createdDoc = createMockDoc({ name: "Test Vet Clinic12" });
            mockedOrganizationModel.create.mockResolvedValueOnce(createdDoc);

            const payload = {
                ...mockFHIROrganization,
                name: "Test Vet Clinic12",
                identifier: [{ value: createdDoc._id.toString() }],
            } as any;

            const result = await OrganizationService.upsert(payload);
            expect(result.created).toBe(true);
            expect(mockedOrganizationModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Test Vet Clinic12",
                    phoneNo: "123-456-7890",
                    address: expect.objectContaining({
                        addressLine: "123 Test St",
                        city: "Test City",
                        state: "Test State",
                    }),
                })
            );
        });

        it("updates existing organization when document is found", async () => {
            const existingDoc = createMockDoc();
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(existingDoc);

            const result = await OrganizationService.upsert({
                ...mockFHIROrganization,
                id: existingDoc._id.toString(),
            } as any);

            expect(result.created).toBe(false);
            expect(mockedOrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: existingDoc._id.toString() },
                { $set: expect.any(Object) },
                { new: true, sanitizeFilter: true }
            );
        });

        it("throws error when organization name is missing", async () => {
            await expect(
                OrganizationService.upsert({ ...mockFHIROrganization, name: "" } as any)
            ).rejects.toMatchObject({
                message: "Organization name cannot be empty.",
            });
        });

        it("uses identifier as tax ID when tax extension missing", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const createdDoc = createMockDoc({ name: "Clinic X" });
            mockedOrganizationModel.create.mockResolvedValueOnce(createdDoc);

            const payload = { ...mockFHIROrganization, extension: [], identifier: [{ value: "TAX-ABC-123" }] } as any;
            const result = await OrganizationService.upsert(payload);

            expect(result.created).toBe(true);
            expect(mockedOrganizationModel.create.mock.calls[0][0].taxId).toBe("TAX-ABC-123");
        });

        it("ignores incomplete typeCoding (missing system or code)", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const createdDoc = createMockDoc({ name: "Clinic Type Test" });
            mockedOrganizationModel.create.mockResolvedValueOnce(createdDoc);

            const payload = { ...mockFHIROrganization, type: "UNKNOWN" } as any;
            const result = await OrganizationService.upsert(payload);

            expect(result.created).toBe(true);
            const created = mockedOrganizationModel.create.mock.calls[0][0];
            expect(created.typeCoding).toBeUndefined();
            expect(created.type).toBe("HOSPITAL");
        });

        it("accepts full typeCoding and preserves typeCoding/code", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const createdDoc = createMockDoc({ name: "Clinic Full Type" });
            mockedOrganizationModel.create.mockResolvedValueOnce(createdDoc);

            const payload = { ...mockFHIROrganization } as any;
            const result = await OrganizationService.upsert(payload);

            expect(result.created).toBe(true);
            const created = mockedOrganizationModel.create.mock.calls[0][0];
            expect(created.typeCoding).toBeDefined();
        });

        it("prunes undefined properties from nested objects", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const createdDoc = createMockDoc({ name: "Clinic Prune Test" });
            mockedOrganizationModel.create.mockResolvedValueOnce(createdDoc);

            const payload = {
                ...mockFHIROrganization,
                address: [{ line: ["123"], city: "City", state: "State", country: null, postalCode: "00000" }],
            } as any;

            const result = await OrganizationService.upsert(payload);
            expect(result.created).toBe(true);
            const createArg = mockedOrganizationModel.create.mock.calls[0][0];
            expect(createArg.address).toBeDefined();
            expect(createArg.address).not.toHaveProperty("country");
        });

        it("throws when organization name contains invalid character $", async () => {
            await expect(
                OrganizationService.upsert({ ...mockFHIROrganization, name: "Bad$Name" } as any)
            ).rejects.toMatchObject({
                message: "Invalid character in Organization name.",
            });
        });

        it("treats blank phoneNo as undefined", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            await expect(
                OrganizationService.upsert({ ...mockFHIROrganization, phoneNo: "   ", telecom: [] } as any)
            ).rejects.toMatchObject({
                message: "Phone number cannot be empty.",
            });
        });
    });

    // --- LIST TESTS ---
    describe("listAll", () => {
        it("returns empty array when no documents exist", async () => {
            mockedOrganizationModel.find.mockResolvedValueOnce([]);
            const result = await OrganizationService.listAll();
            expect(result).toEqual([]);
        });

        it("returns all organizations", async () => {
            const docs = [createMockDoc({ name: "Clinic 1" }), createMockDoc({ name: "Clinic 2" })];
            mockedOrganizationModel.find.mockResolvedValueOnce(docs);

            const result = await OrganizationService.listAll();
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ name: "Clinic 1" });
        });
    });

    // --- UPDATE TESTS ---
    describe("update", () => {
        it("updates existing organization", async () => {
            const existing = createMockDoc({ name: "Old Name" });
            const updated = createMockDoc({ name: "New Name" });
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(updated);

            const result = await OrganizationService.update(existing._id.toString(), {
                ...mockFHIROrganization,
                name: "New Name",
            } as any);

            expect(result).toMatchObject({ name: "New Name" });
        });

        it("returns null when organization not found", async () => {
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(null);
            const result = await OrganizationService.update("missing", mockFHIROrganization as any);
            expect(result).toBeNull();
        });

        it("accepts FHIR ID for update", async () => {
            const document = createMockDoc({ fhirId: "org-to-update" } as any);
            mockedOrganizationModel.findOneAndUpdate.mockResolvedValueOnce(document);

            const result = await OrganizationService.update("org-to-update", mockFHIROrganization as any);
            expect(result).toBeTruthy();
        });

        it("throws when id is empty", async () => {
            await expect(OrganizationService.update("", mockFHIROrganization as any)).rejects.toMatchObject({
                message: "Organization identifier is required.",
            });
        });

        it("throws when name is null", async () => {
            const payload = { ...mockFHIROrganization, name: null } as any;
            await expect(OrganizationService.update("org-to-update", payload)).rejects.toMatchObject({
                message: "Organization name cannot be empty.",
            });
        });

        it("throws when name is not string", async () => {
            const payload = { ...mockFHIROrganization, name: 123 } as any;
            await expect(OrganizationService.update("org-to-update", payload)).rejects.toMatchObject({
                message: "Organization name must be a string.",
            });
        });

        it("throws when id has invalid format", async () => {
            await expect(OrganizationService.update("invalid$id", mockFHIROrganization as any)).rejects.toMatchObject({
                message: "Invalid character in Identifier.",
            });
        });
    });

    // --- DELETE TESTS ---
    describe("deleteById", () => {
        it("returns true when document is deleted", async () => {
            (UserOrganizationService.deleteAllByOrganizationId as jest.Mock).mockResolvedValue(true);
            (SpecialityService.deleteAllByOrganizationId as jest.Mock).mockResolvedValue(true);
            (OrganisationRoomService.deleteAllByOrganizationId as jest.Mock).mockResolvedValue(true);

            const doc = createMockDoc({ name: "Delete Clinic" });
            mockedOrganizationModel.findOneAndDelete.mockResolvedValueOnce(doc);

            const result = await OrganizationService.deleteById(doc._id.toString());
            expect(result).toBe(true);
        });

        it("returns false when no document found", async () => {
            mockedOrganizationModel.findOneAndDelete.mockResolvedValueOnce(null);
            const result = await OrganizationService.deleteById("missing");
            expect(result).toBe(false);
        });

        it("throws when id empty", async () => {
            await expect(OrganizationService.deleteById("")).rejects.toMatchObject({
                message: "Organization identifier is required.",
            });
        });

        it("throws when id invalid", async () => {
            await expect(OrganizationService.deleteById("invalid$id")).rejects.toMatchObject({
                message: "Invalid character in Identifier.",
            });
        });

        it("throws invalid identifier format", async () => {
            await expect(OrganizationService.deleteById("invalid#id")).rejects.toMatchObject({
                message: "Invalid identifier format.",
            });
        });
    });

    // --- GET TESTS ---
    describe("getById", () => {
        it("returns null when no document is found", async () => {
            mockedOrganizationModel.findOne.mockResolvedValueOnce(null);
            const result = await OrganizationService.getById("missing-id");
            expect(result).toBeNull();
        });

        it("returns domain organization when found", async () => {
            const doc = createMockDoc({ name: "Found Clinic" });
            mockedOrganizationModel.findOne.mockResolvedValueOnce(doc);

            const result = await OrganizationService.getById(doc._id.toString());
            expect(result).toMatchObject({ name: "Found Clinic" });
        });

        it("accepts FHIR ID for lookup", async () => {
            const doc = createMockDoc({ fhirId: "org-1234" } as any);
            mockedOrganizationModel.findOne.mockResolvedValueOnce(doc);

            const result = await OrganizationService.getById("org-1234");
            expect(result).toBeTruthy();
        });

        it("maps stored type to allowed organization type", async () => {
            const doc = createMockDoc({ name: "Typed Clinic", type: "HOSPITAL" });
            mockedOrganizationModel.findOne.mockResolvedValueOnce(doc);
            const result = await OrganizationService.getById(doc._id.toString());
            expect(result).toBeTruthy();
        });

        it("throws when id empty", async () => {
            await expect(OrganizationService.getById("")).rejects.toMatchObject({
                message: "Organization identifier is required.",
            });
        });

        it("throws when id invalid", async () => {
            await expect(OrganizationService.getById("invalid$id")).rejects.toMatchObject({
                message: "Invalid character in Identifier.",
            });
        });
    });
});
