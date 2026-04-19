import type { FastifyRequest } from "fastify";
import { prisma } from "../db.js";

type IpApiFields = {
  status: string;
  message?: string;
  city?: string;
  regionName?: string;
  countryCode?: string;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; cityId: string | null }>();

function clientIpFromRequest(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const rip = req.socket.remoteAddress;
  return rip && rip !== "::1" ? rip : "127.0.0.1";
}

function normalizedCityKey(city: string, region: string, countryCode: string): string {
  const raw = `${city}|${region}|${countryCode}`
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.slice(0, 120) || `geo-${Date.now()}`;
}

export function getClientIp(req: FastifyRequest): string {
  return clientIpFromRequest(req);
}

export async function getCityHintForIp(clientIp: string): Promise<{
  cityId: string | null;
  city: { id: string; name: string; state: string | null } | null;
  created: boolean;
  source: "cache" | "ip-api" | "unavailable";
}> {
  const cached = cache.get(clientIp);
  if (cached && cached.expires > Date.now()) {
    if (!cached.cityId) {
      return { cityId: null, city: null, created: false, source: "cache" };
    }
    const row = await prisma.city.findUnique({ where: { id: cached.cityId } });
    return {
      cityId: row?.id ?? null,
      city: row ? { id: row.id, name: row.name, state: row.state } : null,
      created: false,
      source: "cache",
    };
  }

  const url = `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,message,city,regionName,countryCode`;
  let data: IpApiFields;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const res = await fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
    data = (await res.json()) as IpApiFields;
  } catch {
    cache.set(clientIp, { expires: Date.now() + 60_000, cityId: null });
    return { cityId: null, city: null, created: false, source: "unavailable" };
  }

  if (data.status !== "success" || !data.city?.trim()) {
    cache.set(clientIp, { expires: Date.now() + CACHE_TTL_MS, cityId: null });
    return { cityId: null, city: null, created: false, source: "unavailable" };
  }

  const cityName = data.city.trim();
  const region = data.regionName?.trim() ?? "";
  const cc = data.countryCode?.trim() ?? "XX";
  const normalizedName = normalizedCityKey(cityName, region, cc);

  let row = await prisma.city.findUnique({ where: { normalizedName } });
  let created = false;
  if (!row) {
    row = await prisma.city.create({
      data: {
        name: cityName,
        state: region || null,
        normalizedName,
      },
    });
    created = true;
  }

  cache.set(clientIp, { expires: Date.now() + CACHE_TTL_MS, cityId: row.id });
  return {
    cityId: row.id,
    city: { id: row.id, name: row.name, state: row.state },
    created,
    source: "ip-api",
  };
}
