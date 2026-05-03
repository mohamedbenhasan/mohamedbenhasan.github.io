export interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    time: string;
    uv_index?: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    rain: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    visibility: number[];
    uv_index?: number[];
  };
  timezone: string;
}

class WeatherService {
  private cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  private getCacheKey(lat: number, lng: number): string {
    // Round to 2 decimal places (~1.1km precision)
    return `${lat.toFixed(2)},${lng.toFixed(2)}`;
  }

  public async fetchWeather(lat: number, lng: number): Promise<WeatherData> {
    const cacheKey = this.getCacheKey(lat, lng);
    const now = Date.now();

    // Check memory cache
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Check localStorage cache
    try {
      const localCachedStr = localStorage.getItem(`weather_${cacheKey}`);
      if (localCachedStr) {
        const localCached = JSON.parse(localCachedStr);
        if (now - localCached.timestamp < this.CACHE_TTL) {
          this.cache.set(cacheKey, localCached);
          return localCached.data;
        }
      }
    } catch (e) {
      console.warn('Failed to read weather from localStorage', e);
    }

    // Fetch from Open-Meteo
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,rain,wind_speed_10m,wind_gusts_10m,visibility,uv_index&timezone=auto`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Save to cache
      const cacheEntry = { data, timestamp: now };
      this.cache.set(cacheKey, cacheEntry);
      try {
        localStorage.setItem(`weather_${cacheKey}`, JSON.stringify(cacheEntry));
      } catch (e) {
        console.warn('Failed to save weather to localStorage', e);
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
      throw error;
    }
  }
}

export const weatherService = new WeatherService();
