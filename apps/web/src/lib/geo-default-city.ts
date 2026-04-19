import { api } from "@/lib/api";

export const GEO_STORAGE_KEY = "auctit_geo_city_id";

export type CityOption = { id: string; name: string };

/** Prefer stored geo, then IP hint, then first city. Refetches `/v1/cities` if hint returns a newly created city not yet in `cities`. */
export async function pickDefaultCityWithList(cities: CityOption[]): Promise<{
  defaultId: string;
  cities: CityOption[];
}> {
  if (cities.length === 0) return { defaultId: "", cities: [] };

  const stored = typeof window !== "undefined" ? localStorage.getItem(GEO_STORAGE_KEY) : null;
  if (stored && cities.some((c) => c.id === stored)) {
    return { defaultId: stored, cities };
  }

  try {
    const r = await api<{ cityId: string | null }>("/v1/geo/city-hint");
    if (r.cityId) {
      localStorage.setItem(GEO_STORAGE_KEY, r.cityId);
      if (cities.some((c) => c.id === r.cityId)) {
        return { defaultId: r.cityId, cities };
      }
      const fresh = await api<{ cities: CityOption[] }>("/v1/cities");
      if (fresh.cities.some((c) => c.id === r.cityId)) {
        return { defaultId: r.cityId, cities: fresh.cities };
      }
    }
  } catch {
    /* ignore */
  }

  return { defaultId: cities[0]!.id, cities };
}
