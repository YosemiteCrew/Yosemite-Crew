jest.mock("src/config/prisma", () => ({
  prisma: {
    parasiteRiskCell: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    parasiteRiskSubscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("src/integrations/openMeteo", () => ({
  fetchCellWeather: jest.fn(),
}));

import { prisma } from "src/config/prisma";
import { fetchCellWeather } from "src/integrations/openMeteo";
import {
  deleteSubscription,
  getCellRisk,
  ParasiteRiskServiceError,
  upsertSubscription,
} from "../../src/services/parasite-risk.service";
import { MODEL_VERSION } from "../../src/services/parasite-risk.model";

const BRISBANE = { lat: -27.47, lon: 153.03 };

const weatherDays = (count: number, tMean: number) =>
  Array.from({ length: count }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    tMean,
    tMax: tMean + 5,
    tMin: tMean - 5,
    precipitationMm: 2,
    humidityPct: 80,
    dewPointC: tMean - 4,
  }));

const cellRow = (computedAt: Date) => ({
  id: "cell-1",
  latBucket: -27.375,
  lonBucket: 153.125,
  countryCode: "AU",
  region: "AU",
  modelVersion: MODEL_VERSION,
  overallTier: "HIGH",
  degraded: false,
  readings: [
    {
      parasiteId: "paralysis_tick",
      group: "TICK",
      index: 60,
      tier: "HIGH",
      trend: "STEADY",
    },
  ],
  computedAt,
});

describe("getCellRisk", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchCellWeather as jest.Mock).mockResolvedValue({
      past: weatherDays(30, 22),
      forecast: weatherDays(7, 22),
    });
    (prisma.parasiteRiskCell.upsert as jest.Mock).mockImplementation(
      async ({ create, update }) => ({
        ...cellRow(new Date()),
        ...create,
        ...update,
      }),
    );
  });

  it("serves a fresh cached cell without calling the weather provider", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(
      cellRow(new Date()),
    );

    const result = await getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU");

    expect(fetchCellWeather).not.toHaveBeenCalled();
    expect(result.overallTier).toBe("HIGH");
  });

  it("recomputes when the cached cell is older than a day", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(
      cellRow(stale),
    );

    await getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU");

    expect(fetchCellWeather).toHaveBeenCalledTimes(1);
  });

  it("falls back to the stale reading when the weather provider is down", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(
      cellRow(stale),
    );
    (fetchCellWeather as jest.Mock).mockRejectedValue(
      new Error("provider down"),
    );

    // Yesterday's answer beats an error page, and these models move slowly.
    const result = await getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU");
    expect(result.overallTier).toBe("HIGH");
  });

  it("propagates the failure when there is no cached reading to fall back on", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);
    (fetchCellWeather as jest.Mock).mockRejectedValue(
      new Error("provider down"),
    );

    await expect(
      getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU"),
    ).rejects.toThrow();
  });

  it("snaps the coordinate to its grid cell before looking anything up", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);

    await getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU");

    const [{ where }] = (prisma.parasiteRiskCell.findUnique as jest.Mock).mock
      .calls[0];
    const key = where.latBucket_lonBucket_modelVersion;

    // Cell centres, not the caller's exact position.
    expect(key.latBucket).toBe(-27.375);
    expect(key.lonBucket).toBe(153.125);
    expect(key.modelVersion).toBe(MODEL_VERSION);
  });

  it("rejects a location outside every published region", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);

    // Mid-Atlantic: no country code, and outside all region envelopes.
    await expect(getCellRisk(0, -30)).rejects.toBeInstanceOf(
      ParasiteRiskServiceError,
    );
  });

  it("infers the region from the coordinate when no country code is given", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      getCellRisk(BRISBANE.lat, BRISBANE.lon),
    ).resolves.toBeDefined();
  });
});

describe("upsertSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.parasiteRiskSubscription.findUnique as jest.Mock).mockResolvedValue(
      null,
    );
    (prisma.parasiteRiskSubscription.count as jest.Mock).mockResolvedValue(0);
    (prisma.parasiteRiskSubscription.upsert as jest.Mock).mockImplementation(
      async ({ create }) => ({
        id: "sub-1",
        createdAt: new Date(),
        alertTier: "HIGH",
        ...create,
      }),
    );
  });

  it("requires a label", async () => {
    await expect(
      upsertSubscription("parent-1", {
        lat: BRISBANE.lat,
        lon: BRISBANE.lon,
        label: "   ",
        countryCode: "AU",
      }),
    ).rejects.toBeInstanceOf(ParasiteRiskServiceError);
  });

  it("caps the number of followed locations", async () => {
    (prisma.parasiteRiskSubscription.count as jest.Mock).mockResolvedValue(5);

    await expect(
      upsertSubscription("parent-1", {
        lat: BRISBANE.lat,
        lon: BRISBANE.lon,
        label: "Brisbane",
        countryCode: "AU",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not count against the cap when updating an existing location", async () => {
    (prisma.parasiteRiskSubscription.findUnique as jest.Mock).mockResolvedValue(
      {
        id: "sub-1",
      },
    );
    (prisma.parasiteRiskSubscription.count as jest.Mock).mockResolvedValue(5);

    await expect(
      upsertSubscription("parent-1", {
        lat: BRISBANE.lat,
        lon: BRISBANE.lon,
        label: "Brisbane",
        countryCode: "AU",
      }),
    ).resolves.toBeDefined();
  });

  it("stores the snapped cell rather than the exact coordinate", async () => {
    await upsertSubscription("parent-1", {
      lat: BRISBANE.lat,
      lon: BRISBANE.lon,
      label: "Brisbane",
      countryCode: "AU",
    });

    const [{ create }] = (prisma.parasiteRiskSubscription.upsert as jest.Mock)
      .mock.calls[0];
    expect(create.latBucket).toBe(-27.375);
    expect(create.lonBucket).toBe(153.125);
  });
});

describe("deleteSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses to delete another parent's location", async () => {
    (prisma.parasiteRiskSubscription.deleteMany as jest.Mock).mockResolvedValue(
      {
        count: 0,
      },
    );

    await expect(
      deleteSubscription("parent-1", "sub-belonging-to-someone-else"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("scopes the delete to the requesting parent", async () => {
    (prisma.parasiteRiskSubscription.deleteMany as jest.Mock).mockResolvedValue(
      {
        count: 1,
      },
    );

    await deleteSubscription("parent-1", "sub-1");

    const [{ where }] = (
      prisma.parasiteRiskSubscription.deleteMany as jest.Mock
    ).mock.calls[0];
    expect(where).toEqual({ id: "sub-1", parentId: "parent-1" });
  });
});
