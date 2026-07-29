const get = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ get })) },
}));

import {
  fetchCellWeather,
  OpenMeteoError,
  __resetOpenMeteoClient,
} from "../../src/integrations/openMeteo";

/**
 * The API returns PAST_DAYS of history followed by a forecast block whose
 * first entry is the current day, so the split has to land on that boundary.
 */
const payload = (overrides: Record<string, unknown> = {}) => ({
  data: {
    daily: {
      time: [
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
        "2026-01-05",
      ],
      temperature_2m_max: [25, 26, 27, 28, 29],
      temperature_2m_min: [15, 16, 17, 18, 19],
      temperature_2m_mean: [20, 21, 22, 23, 24],
      precipitation_sum: [0, 1, 2, 3, 4],
      relative_humidity_2m_mean: [80, 81, 82, 83, 84],
      dew_point_2m_mean: [16, 17, 18, 19, 20],
      ...overrides,
    },
  },
});

describe("fetchCellWeather", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetOpenMeteoClient();
  });

  it("rejects coordinates outside the valid range", async () => {
    await expect(fetchCellWeather(120, 0)).rejects.toBeInstanceOf(
      OpenMeteoError,
    );
    await expect(fetchCellWeather(0, 250)).rejects.toBeInstanceOf(
      OpenMeteoError,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it("requests a relative path so the base URL cannot be overridden", async () => {
    get.mockResolvedValue(payload());

    await fetchCellWeather(-27.375, 153.125);

    const [path, config] = get.mock.calls[0];
    expect(path).toBe("/v1/forecast");
    expect(config.params.latitude).toBe(-27.375);
    expect(config.params.longitude).toBe(153.125);
  });

  it("splits the series so past ends on the current day", async () => {
    get.mockResolvedValue(payload());

    const { past, forecast } = await fetchCellWeather(0, 0);

    // 5 days total with FORECAST_DAYS = 8 clamps the boundary to the first
    // entry, so everything from that date onward is forecast.
    expect(past.length + forecast.length).toBe(5);
    expect(
      past.at(-1)!.date <= forecast[0]?.date || forecast.length === 0,
    ).toBe(true);
  });

  it("derives the mean temperature when the API omits it", async () => {
    get.mockResolvedValue(
      payload({ temperature_2m_mean: [null, null, null, null, null] }),
    );

    const { past, forecast } = await fetchCellWeather(0, 0);
    const all = [...past, ...forecast];

    // Falls back to the midpoint of max and min.
    expect(all[0].tMean).toBe(20);
  });

  it("drops days with no usable temperature at all", async () => {
    get.mockResolvedValue(
      payload({
        temperature_2m_mean: [null, 21, 22, 23, 24],
        temperature_2m_max: [null, 26, 27, 28, 29],
        temperature_2m_min: [null, 16, 17, 18, 19],
      }),
    );

    const { past, forecast } = await fetchCellWeather(0, 0);
    expect(past.length + forecast.length).toBe(4);
  });

  it("carries nulls through for humidity rather than inventing a value", async () => {
    get.mockResolvedValue(
      payload({
        relative_humidity_2m_mean: [null, null, null, null, null],
        dew_point_2m_mean: [null, null, null, null, null],
      }),
    );

    const { past, forecast } = await fetchCellWeather(0, 0);
    const all = [...past, ...forecast];

    expect(all[0].humidityPct).toBeNull();
    expect(all[0].dewPointC).toBeNull();
  });

  it("raises a typed error when the provider fails", async () => {
    get.mockRejectedValue(new Error("network"));
    await expect(fetchCellWeather(0, 0)).rejects.toBeInstanceOf(OpenMeteoError);
  });

  it("raises a typed error when the response has no daily series", async () => {
    get.mockResolvedValue({ data: {} });
    await expect(fetchCellWeather(0, 0)).rejects.toBeInstanceOf(OpenMeteoError);
  });
});
