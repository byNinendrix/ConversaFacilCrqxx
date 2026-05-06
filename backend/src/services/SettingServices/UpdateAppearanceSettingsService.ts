import AppError from "../../errors/AppError";
import UpdateSettingService from "./UpdateSettingService";
import GetAppearanceSettingsService from "./GetAppearanceSettingsService";
import {
  APPEARANCE_COLOR_KEYS,
  APPEARANCE_SETTING_KEYS,
  AppearanceMode,
  AppearancePalette,
  AppearancePayload,
  DEFAULT_APPEARANCE_SETTINGS
} from "./AppearanceThemeDefaults";

interface Request {
  companyId: number;
  defaultMode: unknown;
  palettes: unknown;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const normalizeColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized.toUpperCase() : fallback;
};

const normalizePalette = (
  rawPalette: unknown,
  fallbackPalette: AppearancePalette
): AppearancePalette => {
  const palette = (rawPalette && typeof rawPalette === "object"
    ? rawPalette
    : {}) as Record<string, unknown>;

  return APPEARANCE_COLOR_KEYS.reduce((acc, colorKey) => {
    acc[colorKey] = normalizeColor(palette[colorKey], fallbackPalette[colorKey]);
    return acc;
  }, {} as AppearancePalette);
};

const normalizeMode = (rawMode: unknown): AppearanceMode => {
  if (rawMode === "light" || rawMode === "dark") {
    return rawMode;
  }

  throw new AppError("Modo de tema inválido. Use 'light' ou 'dark'.", 400);
};

const UpdateAppearanceSettingsService = async ({
  companyId,
  defaultMode,
  palettes
}: Request): Promise<AppearancePayload> => {
  const mode = normalizeMode(defaultMode);
  const parsedPalettes = (palettes && typeof palettes === "object"
    ? palettes
    : {}) as { light?: unknown; dark?: unknown };

  const normalizedLightPalette = normalizePalette(
    parsedPalettes.light,
    DEFAULT_APPEARANCE_SETTINGS.palettes.light
  );

  const normalizedDarkPalette = normalizePalette(
    parsedPalettes.dark,
    DEFAULT_APPEARANCE_SETTINGS.palettes.dark
  );

  await UpdateSettingService({
    key: APPEARANCE_SETTING_KEYS.defaultMode,
    value: mode,
    companyId
  });

  await UpdateSettingService({
    key: APPEARANCE_SETTING_KEYS.lightPalette,
    value: JSON.stringify(normalizedLightPalette),
    companyId
  });

  await UpdateSettingService({
    key: APPEARANCE_SETTING_KEYS.darkPalette,
    value: JSON.stringify(normalizedDarkPalette),
    companyId
  });

  return GetAppearanceSettingsService({ companyId });
};

export default UpdateAppearanceSettingsService;

