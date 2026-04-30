/**
 * Tests for lib/weather.ts — fallback chain + condition derivation.
 * Uses synchronous require() after jest.resetModules() to re-evaluate
 * the module with different process.env values per test group.
 */

jest.mock("@/lib/expo-location-shim", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  getCurrentPositionAsync: jest
    .fn()
    .mockResolvedValue({ coords: { latitude: 12.97, longitude: 77.59 } }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([{ city: "Bengaluru" }]),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  jest.resetModules();
  global.fetch = jest.fn() as jest.Mock;
});

afterEach(() => {
  process.env = originalEnv;
});

function requireWeather() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/weather") as typeof import("@/lib/weather");
}

function makeOpenMeteoResponse(overrides: Record<string, unknown> = {}) {
  return {
    current: {
      time: "2026-04-29T08:00",
      temperature_2m: 28,
      apparent_temperature: 30,
      relative_humidity_2m: 55,
      wind_speed_10m: 12,
      cloud_cover: 20,
      precipitation: 0,
      is_day: 1,
      ...overrides,
    },
    hourly: {
      time: ["2026-04-29T08:00"],
      precipitation_probability: [15],
    },
  };
}

function makeWeatherApiResponse(
  currentOverrides: Record<string, unknown> = {},
) {
  return {
    location: { name: "Bengaluru", localtime: "2026-04-29 09:00" },
    current: {
      temp_c: 31,
      feelslike_c: 33,
      humidity: 48,
      wind_kph: 14,
      is_day: 1,
      condition: { text: "Sunny" },
      precip_mm: 0,
      last_updated: "2026-04-29 08:45",
      ...currentOverrides,
    },
    forecast: {
      forecastday: [
        { hour: [{ time: "2026-04-29 09:00", chance_of_rain: 5 }] },
      ],
    },
  };
}

function mockFetchSuccess(body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  });
}
function mockFetchFailure(status = 500) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status });
}

// ── Open-Meteo path (no API key) ──────────────────────────────────────────────

describe("getCurrentWeather — Open-Meteo path", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_WEATHERAPI_KEY;
  });

  test("returns WeatherSnapshot with source=Open-Meteo", async () => {
    mockFetchSuccess(makeOpenMeteoResponse());
    const { getCurrentWeather } = requireWeather();
    const result = await getCurrentWeather();
    expect(result.source).toBe("Open-Meteo");
    expect(result.location).toBe("Bengaluru");
    expect(result.temperatureC).toBe(28);
    expect(result.feelsLikeC).toBe(30);
    expect(result.humidity).toBe(55);
    expect(result.condition).toBe("Sunny");
  });

  test("condition is Rain when precipitation > 0.1", async () => {
    mockFetchSuccess(
      makeOpenMeteoResponse({ precipitation: 0.5, cloud_cover: 70 }),
    );
    const result = await requireWeather().getCurrentWeather();
    expect(result.condition).toBe("Rain");
  });

  test("condition is Cloudy when cloud_cover >= 45 and no rain", async () => {
    mockFetchSuccess(
      makeOpenMeteoResponse({ cloud_cover: 60, precipitation: 0 }),
    );
    const result = await requireWeather().getCurrentWeather();
    expect(result.condition).toBe("Cloudy");
  });

  test("condition is Sunny when cloud_cover < 45 and no rain", async () => {
    mockFetchSuccess(
      makeOpenMeteoResponse({ cloud_cover: 10, precipitation: 0 }),
    );
    const result = await requireWeather().getCurrentWeather();
    expect(result.condition).toBe("Sunny");
  });

  test("throws when Open-Meteo returns non-OK response", async () => {
    mockFetchFailure(503);
    await expect(requireWeather().getCurrentWeather()).rejects.toThrow("503");
  });

  test("dayPart is Evening when is_day=0", async () => {
    mockFetchSuccess(makeOpenMeteoResponse({ is_day: 0 }));
    const result = await requireWeather().getCurrentWeather();
    expect(result.dayPart).toBe("Evening");
  });

  test("dayPart is Morning when is_day=1 and hour < 12", async () => {
    mockFetchSuccess(makeOpenMeteoResponse({ is_day: 1 }));
    const result = await requireWeather().getCurrentWeather();
    expect(result.dayPart).toBe("Morning");
  });
});

// ── WeatherAPI primary path ───────────────────────────────────────────────────

describe("getCurrentWeather — WeatherAPI primary path", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEATHERAPI_KEY = "test-key";
  });

  test("returns WeatherSnapshot with source=WeatherAPI", async () => {
    mockFetchSuccess(makeWeatherApiResponse());
    const result = await requireWeather().getCurrentWeather();
    expect(result.source).toBe("WeatherAPI");
    expect(result.temperatureC).toBe(31);
    expect(result.condition).toBe("Sunny");
  });

  test("falls back to Open-Meteo when WeatherAPI fails", async () => {
    mockFetchFailure(500);
    mockFetchSuccess(makeOpenMeteoResponse());
    const result = await requireWeather().getCurrentWeather();
    expect(result.source).toBe("Open-Meteo");
  });

  test("condition is Rain when WeatherAPI text contains 'rain'", async () => {
    mockFetchSuccess(
      makeWeatherApiResponse({
        condition: { text: "Light rain shower" },
        precip_mm: 0.3,
      }),
    );
    const result = await requireWeather().getCurrentWeather();
    expect(result.condition).toBe("Rain");
  });

  test("condition is Cloudy when WeatherAPI text contains 'cloud'", async () => {
    mockFetchSuccess(
      makeWeatherApiResponse({
        condition: { text: "Partly cloudy" },
        precip_mm: 0,
      }),
    );
    const result = await requireWeather().getCurrentWeather();
    expect(result.condition).toBe("Cloudy");
  });
});

// ── Location permission denied ────────────────────────────────────────────────

describe("getCurrentWeather — location denied", () => {
  test("throws when location permission is not granted", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shim =
      require("@/lib/expo-location-shim") as typeof import("@/lib/expo-location-shim");
    (shim.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce(
      { status: "denied" },
    );
    delete process.env.EXPO_PUBLIC_WEATHERAPI_KEY;
    await expect(requireWeather().getCurrentWeather()).rejects.toThrow(
      "Location permission",
    );
  });
});
