import axios from "axios";
import { IdexxClient } from "src/integrations/idexx/idexx.client";

jest.mock("axios");

const mockAxios = axios as jest.Mocked<typeof axios>;

describe("IdexxClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates axios instance with expected headers", () => {
    mockAxios.create.mockReturnValue({} as any);

    new IdexxClient({
      baseUrl: "https://idexx.local",
      username: "user",
      password: "pass",
      pimsId: "pims",
      pimsVersion: "1.0",
      labAccountId: "lab-123",
    });

    const authToken = Buffer.from("user:pass", "utf8").toString("base64");

    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: "https://idexx.local",
      headers: {
        Authorization: `Basic ${authToken}`,
        "X-Pims-Id": "pims",
        "X-Pims-Version": "1.0",
        "X-Lab-Account-Id": "lab-123",
      },
      timeout: 15000,
    });
  });

  it("omits lab account header when labAccountId is undefined", () => {
    mockAxios.create.mockReturnValue({} as any);

    new IdexxClient({
      username: "user",
      password: "pass",
      pimsId: "pims",
      pimsVersion: "1.0",
    });

    const authToken = Buffer.from("user:pass", "utf8").toString("base64");

    expect(mockAxios.create).toHaveBeenCalledWith({
      baseURL: "https://integration.vetconnectplus.com",
      headers: {
        Authorization: `Basic ${authToken}`,
        "X-Pims-Id": "pims",
        "X-Pims-Version": "1.0",
      },
      timeout: 15000,
    });
  });

  it("executes requests and returns response data", async () => {
    const http = {
      get: jest.fn().mockResolvedValue({ data: { ok: true } }),
      post: jest.fn().mockResolvedValue({ data: { created: true } }),
      put: jest.fn().mockResolvedValue({ data: { updated: true } }),
      delete: jest.fn().mockResolvedValue({ data: { deleted: true } }),
    };
    mockAxios.create.mockReturnValue(http as any);

    const client = new IdexxClient({
      username: "user",
      password: "pass",
      pimsId: "pims",
      pimsVersion: "1.0",
    });

    await client.validateCredentials();
    expect(http.get).toHaveBeenCalledWith("/api/v1/auth/validate");

    await expect(client.getRefVersions()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ref/versions");

    await expect(client.getRefSpecies()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ref/species");

    await expect(client.getRefBreeds()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ref/breeds");

    await expect(client.getRefGenders()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ref/genders");

    await expect(client.getRefTests()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ref/tests");

    await expect(client.createOrder({})).resolves.toEqual({ created: true });
    expect(http.post).toHaveBeenCalledWith("/api/v1/order", {});

    await expect(client.getOrder("order-1")).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/order/order-1");

    await expect(
      client.updateOrder("order-1", { foo: "bar" }),
    ).resolves.toEqual({
      updated: true,
    });
    expect(http.put).toHaveBeenCalledWith("/api/v1/order/order-1", {
      foo: "bar",
    });

    await expect(client.cancelOrder("order-1")).resolves.toEqual({
      deleted: true,
    });
    expect(http.delete).toHaveBeenCalledWith("/api/v1/order/order-1");

    await expect(client.addCensusPatient({ hello: "world" })).resolves.toEqual({
      created: true,
    });
    expect(http.post).toHaveBeenCalledWith("/api/v1/census", {
      hello: "world",
    });

    await expect(client.listCensus()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/census");

    await expect(client.deleteCensus()).resolves.toEqual({ deleted: true });
    expect(http.delete).toHaveBeenCalledWith("/api/v1/census");

    await expect(client.getCensusById("census-1")).resolves.toEqual({
      ok: true,
    });
    expect(http.get).toHaveBeenCalledWith("/api/v1/census/census-1");

    await expect(client.deleteCensusById("census-1")).resolves.toEqual({
      deleted: true,
    });
    expect(http.delete).toHaveBeenCalledWith("/api/v1/census/census-1");

    await expect(client.getCensusPatient("p 1")).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith(
      "/api/v1/census/patient?patientId=p%201",
    );

    await expect(client.deleteCensusPatient("p 1")).resolves.toEqual({
      deleted: true,
    });
    expect(http.delete).toHaveBeenCalledWith(
      "/api/v1/census/patient?patientId=p%201",
    );

    await expect(client.listIvlsDevices()).resolves.toEqual({ ok: true });
    expect(http.get).toHaveBeenCalledWith("/api/v1/ivls/devices");
  });
});
