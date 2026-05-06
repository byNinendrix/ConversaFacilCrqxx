import Redis from "ioredis";
import { REDIS_URI_CONNECTION } from "../config/redis";
import util from "util";
import * as crypto from "crypto";
import { logger } from "../utils/logger";

type MemoryCacheEntry = {
  value: string;
  expiresAt: number | null;
};

const redis = new Redis(REDIS_URI_CONNECTION, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1
});

const memoryCache = new Map<string, MemoryCacheEntry>();
let redisReady = false;
let lastRedisWarnAt = 0;

const REDIS_WARN_INTERVAL_MS = 60 * 1000;

const shouldExpire = (entry: MemoryCacheEntry | undefined): boolean =>
  Boolean(entry?.expiresAt && entry.expiresAt <= Date.now());

const setMemoryValue = (
  key: string,
  value: string,
  option?: string,
  optionValue?: string | number
) => {
  let expiresAt: number | null = null;
  if (option !== undefined && optionValue !== undefined) {
    const normalizedOption = String(option).trim().toUpperCase();
    const parsedOptionValue = Number(optionValue);
    if (Number.isFinite(parsedOptionValue) && parsedOptionValue > 0) {
      expiresAt =
        normalizedOption === "PX"
          ? Date.now() + parsedOptionValue
          : Date.now() + parsedOptionValue * 1000;
    }
  }

  memoryCache.set(key, {
    value,
    expiresAt
  });
};

const getMemoryValue = (key: string): string | null => {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (shouldExpire(entry)) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
};

const getMemoryKeys = (pattern: string): string[] => {
  const escapedPattern = String(pattern || "")
    .split("*")
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${escapedPattern}$`);

  const keys: string[] = [];
  memoryCache.forEach((entry, key) => {
    if (shouldExpire(entry)) {
      memoryCache.delete(key);
      return;
    }
    if (regex.test(key)) {
      keys.push(key);
    }
  });
  return keys;
};

const markRedisUnavailable = (error?: any) => {
  redisReady = false;
  const now = Date.now();
  if (now - lastRedisWarnAt >= REDIS_WARN_INTERVAL_MS) {
    lastRedisWarnAt = now;
    logger.warn(
      {
        event: "cache_redis_unavailable",
        error: String(error?.message || error || "unknown")
      },
      "Redis unavailable for cache layer, using memory fallback"
    );
  }
};

redis.on("ready", () => {
  redisReady = true;
});

redis.on("error", error => {
  markRedisUnavailable(error);
});

const withRedisFallback = async <T>(
  command: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> => {
  if (!redisReady || redis.status !== "ready") {
    return fallback();
  }

  try {
    return await command();
  } catch (error) {
    markRedisUnavailable(error);
    return fallback();
  }
};

function encryptParams(params: any) {
  const str = JSON.stringify(params);
  return crypto.createHash("sha256").update(str).digest("base64");
}

export function setFromParams(
  key: string,
  params: any,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const finalKey = `${key}:${encryptParams(params)}`;
  if (option !== undefined && optionValue !== undefined) {
    return set(finalKey, value, option, optionValue);
  }
  return set(finalKey, value);
}

export function getFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return get(finalKey);
}

export function delFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return del(finalKey);
}

export function set(
  key: string,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const setPromisefy = util.promisify(redis.set).bind(redis);
  return withRedisFallback(
    async () => {
      if (option !== undefined && optionValue !== undefined) {
        return setPromisefy(key, value, option, optionValue);
      }
      return setPromisefy(key, value);
    },
    async () => {
      setMemoryValue(key, value, option, optionValue);
      return "OK";
    }
  );
}

export function get(key: string) {
  const getPromisefy = util.promisify(redis.get).bind(redis);
  return withRedisFallback(
    async () => getPromisefy(key),
    async () => getMemoryValue(key)
  );
}

export function getKeys(pattern: string) {
  const getKeysPromisefy = util.promisify(redis.keys).bind(redis);
  return withRedisFallback(
    async () => getKeysPromisefy(pattern),
    async () => getMemoryKeys(pattern)
  );
}

export function del(key: string) {
  const delPromisefy = util.promisify(redis.del).bind(redis);
  return withRedisFallback(
    async () => delPromisefy(key),
    async () => Number(memoryCache.delete(key))
  );
}

export async function delFromPattern(pattern: string) {
  const all = await getKeys(pattern);
  for (let item of all) {
    del(item);
  }
}

export const cacheLayer = {
  set,
  setFromParams,
  get,
  getFromParams,
  getKeys,
  del,
  delFromParams,
  delFromPattern
};
