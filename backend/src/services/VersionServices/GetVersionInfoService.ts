import fs from "fs";
import path from "path";

export interface VersionHistoryItem {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export interface VersionInfoPayload {
  version: string;
  history: VersionHistoryItem[];
}

interface RawVersionHistoryFile {
  currentVersion?: unknown;
  history?: unknown;
}

const FALLBACK_VERSION = "5.3.5";

const HISTORY_FILE_PATH = path.resolve(
  process.cwd(),
  "config",
  "version-history.json"
);

const toSafeString = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
};

const normalizeHistoryItem = (
  item: unknown,
  index: number
): VersionHistoryItem | null => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const row = item as Record<string, unknown>;
  const version = toSafeString(row.version);
  if (!version) {
    return null;
  }

  const date = toSafeString(row.date, "-");
  const title = toSafeString(row.title, `Release ${version}`);
  const changes = Array.isArray(row.changes)
    ? row.changes
        .map(change => toSafeString(change))
        .filter(Boolean)
    : [];

  return {
    version,
    date,
    title,
    changes
  };
};

const GetVersionInfoService = async (): Promise<VersionInfoPayload> => {
  try {
    const rawContent = await fs.promises.readFile(HISTORY_FILE_PATH, "utf-8");
    const parsed: RawVersionHistoryFile = JSON.parse(rawContent);

    const history = Array.isArray(parsed.history)
      ? parsed.history
          .map((item, index) => normalizeHistoryItem(item, index))
          .filter((item): item is VersionHistoryItem => Boolean(item))
      : [];

    const currentVersion = toSafeString(
      parsed.currentVersion,
      history[0]?.version || FALLBACK_VERSION
    );

    return {
      version: currentVersion,
      history
    };
  } catch (error) {
    return {
      version: FALLBACK_VERSION,
      history: []
    };
  }
};

export default GetVersionInfoService;
