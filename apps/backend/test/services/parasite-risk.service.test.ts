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
  refreshCell,
  upsertSubscription,
} from "../../src/services/parasite-risk.service";
import { MODEL_VERSION } from "../../src/services/parasite-risk.model";

const BRISBANE = { lat: -27.47, lon: 153.03 };
const ROME = { lat: 41.9, lon: 12.5 };
/** Inside the coarse US envelope, and not a country we publish for. */
const MONTERREY = { lat: 25.67, lon: -100.31 };

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

  it("refuses a country we publish no catalogue for before touching the cell", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      getCellRisk(MONTERREY.lat, MONTERREY.lon, "MX"),
    ).rejects.toBeInstanceOf(ParasiteRiskServiceError);

    // Nothing is read or written: the coordinate falls inside the US envelope,
    // so any fallback would answer with a catalogue that does not apply there.
    expect(prisma.parasiteRiskCell.findUnique).not.toHaveBeenCalled();
    expect(fetchCellWeather).not.toHaveBeenCalled();
    expect(prisma.parasiteRiskCell.upsert).not.toHaveBeenCalled();
  });

  it("refuses a country code that contradicts the coordinate", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      getCellRisk(BRISBANE.lat, BRISBANE.lon, "US"),
    ).rejects.toBeInstanceOf(ParasiteRiskServiceError);

    // The cell is shared, so a caller must not be able to store the US
    // catalogue against an Australian square.
    expect(prisma.parasiteRiskCell.upsert).not.toHaveBeenCalled();
  });

  it("ignores a fresh cached cell computed under another region", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue({
      ...cellRow(new Date()),
      countryCode: "US",
      region: "US",
    });

    const result = await getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU");

    expect(fetchCellWeather).toHaveBeenCalledTimes(1);
    expect(result.region).toBe("AU");
  });

  it("does not fall back to another region's cell when the provider is down", async () => {
    (prisma.parasiteRiskCell.findUnique as jest.Mock).mockResolvedValue({
      ...cellRow(new Date(Date.now() - 25 * 60 * 60 * 1000)),
      countryCode: "US",
      region: "US",
    });
    (fetchCellWeather as jest.Mock).mockRejectedValue(
      new Error("provider down"),
    );

    // A stale reading beats an error page, but only one for this region.
    await expect(
      getCellRisk(BRISBANE.lat, BRISBANE.lon, "AU"),
    ).rejects.toThrow();
  });
});

describe("refreshCell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchCellWeather as jest.Mock).mockResolvedValue({
      past: weatherDays(30, 18),
      forecast: weatherDays(7, 18),
    });
    (prisma.parasiteRiskCell.upsert as jest.Mock).mockImplementation(
      async ({ create, update }) => ({
        ...cellRow(new Date()),
        ...create,
        ...update,
      }),
    );
  });

  it("refreshes a location saved with a region code in its country column", async () => {
    // A coordinate-only save persists the resolved region there, and the daily
    // sweep hands that value straight back to this function.
    await refreshCell(ROME.lat, ROME.lon, "EU");

    const [{ create }] = (prisma.parasiteRiskCell.upsert as jest.Mock).mock
      .calls[0];
    expect(create.region).toBe("EU");
  });

  it("stores the region the cell was actually modelled under", async () => {
    await refreshCell(BRISBANE.lat, BRISBANE.lon, "AU");

    const [{ create }] = (prisma.parasiteRiskCell.upsert as jest.Mock).mock
      .calls[0];
    expect(create.region).toBe("AU");
    expect(create.countryCode).toBe("AU");
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

  it("refuses a location in a country we publish no catalogue for", async () => {
    await expect(
      upsertSubscription("parent-1", {
        lat: MONTERREY.lat,
        lon: MONTERREY.lon,
        label: "Monterrey",
        countryCode: "MX",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.parasiteRiskSubscription.upsert).not.toHaveBeenCalled();
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
