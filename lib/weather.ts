import * as Location from '@/lib/expo-location-shim';

import { todayWeather, type WeatherSnapshot } from '@/lib/wardrobe';

const weatherApiKey = process.env.EXPO_PUBLIC_WEATHERAPI_KEY;

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    cloud_cover: number;
    precipitation: number;
    is_day: number;
  };
  hourly?: {
    time: string[];
    precipitation_probability: number[];
  };
}

interface WeatherApiResponse {
  location: {
    name: string;
    localtime: string;
  };
  current: {
    temp_c: number;
    feelslike_c: number;
    humidity: number;
    wind_kph: number;
    is_day: number;
    condition: {
      text: string;
    };
    precip_mm: number;
    last_updated: string;
  };
  forecast?: {
    forecastday?: Array<{
      hour?: Array<{
        time: string;
        chance_of_rain: number;
      }>;
    }>;
  };
}

async function getDeviceLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Location permission was not granted.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const [place] = await Location.reverseGeocodeAsync(position.coords);
  const locationName =
    place?.city ??
    place?.district ??
    place?.region ??
    place?.subregion ??
    todayWeather.location;

  return {
    coords: position.coords,
    locationName,
  };
}

function deriveConditionFromClouds(precipitation: number, cloudCover: number): WeatherSnapshot['condition'] {
  if (precipitation > 0.1) {
    return 'Rain';
  }

  if (cloudCover >= 45) {
    return 'Cloudy';
  }

  return 'Sunny';
}

function deriveConditionFromWeatherApi(text: string, precipitation: number): WeatherSnapshot['condition'] {
  const normalized = text.toLowerCase();

  if (precipitation > 0.1 || normalized.includes('rain') || normalized.includes('drizzle')) {
    return 'Rain';
  }

  if (
    normalized.includes('cloud') ||
    normalized.includes('overcast') ||
    normalized.includes('mist') ||
    normalized.includes('fog')
  ) {
    return 'Cloudy';
  }

  return 'Sunny';
}

function deriveDayPart(isDay: number, hours: number): WeatherSnapshot['dayPart'] {
  if (isDay === 0 || hours >= 18) {
    return 'Evening';
  }

  if (hours >= 12) {
    return 'Afternoon';
  }

  return 'Morning';
}

function getOpenMeteoRainChance(data: OpenMeteoResponse) {
  const currentTime = data.current?.time;

  if (!currentTime || !data.hourly) {
    return todayWeather.rainChance;
  }

  const hourIndex = data.hourly.time.findIndex((value) => value === currentTime);

  if (hourIndex === -1) {
    return todayWeather.rainChance;
  }

  return data.hourly.precipitation_probability[hourIndex] ?? todayWeather.rainChance;
}

function getWeatherApiRainChance(data: WeatherApiResponse) {
  const localtime = data.location.localtime;
  const hours = data.forecast?.forecastday?.[0]?.hour;

  if (!localtime || !hours || hours.length === 0) {
    return todayWeather.rainChance;
  }

  const matchingHour = hours.find((hour) => hour.time === localtime);

  if (!matchingHour) {
    const localHour = new Date(localtime).getHours();
    const nearestHour = hours.find((hour) => new Date(hour.time).getHours() === localHour);

    return nearestHour?.chance_of_rain ?? todayWeather.rainChance;
  }

  return matchingHour.chance_of_rain;
}

async function getWeatherFromWeatherApi(coords: { latitude: number; longitude: number }) {
  if (!weatherApiKey) {
    throw new Error('EXPO_PUBLIC_WEATHERAPI_KEY is not configured.');
  }

  const params = new URLSearchParams({
    key: weatherApiKey,
    q: `${coords.latitude},${coords.longitude}`,
    days: '1',
    aqi: 'no',
    alerts: 'no',
  });
  const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`WeatherAPI request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as WeatherApiResponse;
  const date = new Date(data.location.localtime);

  return {
    location: data.location.name,
    temperatureC: Math.round(data.current.temp_c),
    condition: deriveConditionFromWeatherApi(data.current.condition.text, data.current.precip_mm),
    rainChance: getWeatherApiRainChance(data),
    dayPart: deriveDayPart(data.current.is_day, date.getHours()),
    feelsLikeC: Math.round(data.current.feelslike_c),
    humidity: data.current.humidity,
    windKph: Math.round(data.current.wind_kph),
    source: 'WeatherAPI',
    lastUpdated: data.current.last_updated,
  } satisfies WeatherSnapshot;
}

async function getWeatherFromOpenMeteo(
  coords: { latitude: number; longitude: number },
  locationName: string
) {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,cloud_cover,precipitation,is_day',
    hourly: 'precipitation_probability',
    timezone: 'auto',
    forecast_days: '1',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const current = data.current;

  if (!current) {
    throw new Error('Open-Meteo response did not include current conditions.');
  }

  const date = new Date(current.time);

  return {
    location: locationName,
    temperatureC: Math.round(current.temperature_2m),
    condition: deriveConditionFromClouds(current.precipitation, current.cloud_cover),
    rainChance: getOpenMeteoRainChance(data),
    dayPart: deriveDayPart(current.is_day, date.getHours()),
    feelsLikeC: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windKph: Math.round(current.wind_speed_10m),
    source: 'Open-Meteo',
    lastUpdated: current.time,
  } satisfies WeatherSnapshot;
}

export async function getCurrentWeather() {
  const { coords, locationName } = await getDeviceLocation();

  if (weatherApiKey) {
    try {
      return await getWeatherFromWeatherApi(coords);
    } catch {
      return getWeatherFromOpenMeteo(coords, locationName);
    }
  }

  return getWeatherFromOpenMeteo(coords, locationName);
}
